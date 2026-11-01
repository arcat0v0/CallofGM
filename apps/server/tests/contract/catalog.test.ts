import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createCatalogRoutes } from "@/modules/catalog/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import {
  mediaAssets,
  modules,
  scenes,
  tracks,
  handouts
} from "@/platform/db/schema";
import { eq } from "drizzle-orm";
import { seedGmPassword } from "../helpers/setup";

describe("Catalog contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "catalog-test-password";
  let gmToken = "";
  let playerToken = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    container = new Container();
    await container.startupService.startup();
    await seedGmPassword(container.db, gmPassword);

    app = new Elysia()
      .onError(({ error, code, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return {
            code: error.code,
            message: error.message,
            metadata: error.metadata
          };
        }
        if (code === "VALIDATION") {
          set.status = 400;
          return {
            code: "VALIDATION_FAILED",
            message: error.message
          };
        }
        set.status = 500;
        return {
          code: "INTERNAL_SERVER_ERROR",
          message: (error as Error).message
        };
      })
      .use(createIdentityRoutes(container))
      .use(createCatalogRoutes(container));

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword })
      })
    );
    const loginBody = await loginRes.json();
    gmToken = loginBody.sessionToken;

    const playerRes = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "catalog-player-fingerprint" })
      })
    );
    const playerBody = await playerRes.json();
    playerToken = playerBody.token;

    await container.db.insert(mediaAssets).values({
      id: "media-asset-id",
      purpose: "test",
      storageKey: "test-key",
      filename: "test.png",
      mimeType: "image/png",
      size: 100,
      sha256: "dummy-hash",
      createdAt: Date.now()
    });
    await container.db.insert(mediaAssets).values({
      id: "audio-asset-id",
      purpose: "audio",
      storageKey: "audio-key",
      filename: "test.mp3",
      mimeType: "audio/mpeg",
      size: 100,
      sha256: "dummy-audio-hash",
      createdAt: Date.now()
    });
  });

  afterAll(async () => {
    container.dbContext.sqlite.close();
  });

  test("Unauthorized - no token", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Module",
          description: "Test Desc",
          ruleId: "coc7e"
        })
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  test("Unauthorized - player token", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${playerToken}`
        },
        body: JSON.stringify({
          name: "Test Module",
          description: "Test Desc",
          ruleId: "coc7e"
        })
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  test("Module CRUD and validation checks", async () => {
    const createRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Original Name",
          description: "Original Description",
          ruleId: "coc7e"
        })
      })
    );
    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.id).toBeDefined();
    expect(createBody.name).toBe("Original Name");
    expect(createBody.description).toBe("Original Description");
    expect(createBody.ruleId).toBe("coc7e");

    const getRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${createBody.id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.id).toBe(createBody.id);

    const patchRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${createBody.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Updated Name",
          description: "Updated Description"
        })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.name).toBe("Updated Name");
    expect(patchBody.description).toBe("Updated Description");

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${createBody.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(deleteRes.status).toBe(200);

    const getRes2 = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${createBody.id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(getRes2.status).toBe(404);
  });

  test("Scenes with media assets validation", async () => {
    const modRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Module for Scenes",
          description: "Description",
          ruleId: "coc7e"
        })
      })
    );
    const mod = await modRes.json();

    const sceneFailRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/scenes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Scene Fail",
          sortOrder: 1,
          bgAssetId: "non-existent-asset-id"
        })
      })
    );
    expect(sceneFailRes.status).toBe(404);
    const sceneFailBody = await sceneFailRes.json();
    expect(sceneFailBody.code).toBe("MEDIA_NOT_FOUND");

    const sceneSuccessRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/scenes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Scene Success",
          sortOrder: 1,
          bgAssetId: "media-asset-id"
        })
      })
    );
    expect(sceneSuccessRes.status).toBe(200);
    const sceneSuccess = await sceneSuccessRes.json();
    expect(sceneSuccess.bgAssetId).toBe("media-asset-id");

    const listRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/scenes`, {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.length).toBe(1);
    expect(list.items[0].id).toBe(sceneSuccess.id);

    const updateFailRes = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules/scenes/${sceneSuccess.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gmToken}`
          },
          body: JSON.stringify({
            bgAssetId: "another-invalid-id"
          })
        }
      )
    );
    expect(updateFailRes.status).toBe(404);

    const updateSuccessRes = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules/scenes/${sceneSuccess.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gmToken}`
          },
          body: JSON.stringify({
            name: "Updated Scene Name"
          })
        }
      )
    );
    expect(updateSuccessRes.status).toBe(200);
    const updatedScene = await updateSuccessRes.json();
    expect(updatedScene.name).toBe("Updated Scene Name");

    const deleteRes = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules/scenes/${sceneSuccess.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${gmToken}` }
        }
      )
    );
    expect(deleteRes.status).toBe(200);
  });

  test("Tracks with media assets validation", async () => {
    const modRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Module for Tracks",
          description: "Description",
          ruleId: "coc7e"
        })
      })
    );
    const mod = await modRes.json();

    const trackFailRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Track Fail",
          audioAssetId: "non-existent-asset-id",
          type: "bgm",
          duration: 120
        })
      })
    );
    expect(trackFailRes.status).toBe(404);

    const trackSuccessRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Track Success",
          audioAssetId: "audio-asset-id",
          type: "bgm",
          duration: 120
        })
      })
    );
    expect(trackSuccessRes.status).toBe(200);
    const trackSuccess = await trackSuccessRes.json();

    const listRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/tracks`, {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.length).toBe(1);

    const deleteRes = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules/tracks/${trackSuccess.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${gmToken}` }
        }
      )
    );
    expect(deleteRes.status).toBe(200);
  });

  test("Handouts with media assets validation", async () => {
    const modRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Module for Handouts",
          description: "Description",
          ruleId: "coc7e"
        })
      })
    );
    const mod = await modRes.json();

    const handoutFailRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/handouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          title: "Handout Fail",
          content: "Some content",
          imageAssetId: "non-existent-asset-id"
        })
      })
    );
    expect(handoutFailRes.status).toBe(404);

    const handoutSuccessRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/handouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          title: "Handout Success",
          content: "Some content",
          imageAssetId: "media-asset-id"
        })
      })
    );
    expect(handoutSuccessRes.status).toBe(200);
    const handoutSuccess = await handoutSuccessRes.json();

    const listRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/handouts`, {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.length).toBe(1);

    const deleteRes = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules/handouts/${handoutSuccess.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${gmToken}` }
        }
      )
    );
    expect(deleteRes.status).toBe(200);
  });

  test("Cascade deletion", async () => {
    const modRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Cascade Module",
          description: "Description",
          ruleId: "coc7e"
        })
      })
    );
    const mod = await modRes.json();

    const sceneRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/scenes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Scene to cascade",
          sortOrder: 1
        })
      })
    );
    const scene = await sceneRes.json();

    const trackRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "Track to cascade",
          audioAssetId: "audio-asset-id",
          type: "bgm",
          duration: 60
        })
      })
    );
    const track = await trackRes.json();

    const handoutRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}/handouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          title: "Handout to cascade",
          content: "content"
        })
      })
    );
    const handout = await handoutRes.json();

    const dbSceneBefore = await container.db
      .select()
      .from(scenes)
      .where(eq(scenes.id, scene.id));
    expect(dbSceneBefore.length).toBe(1);

    const dbTrackBefore = await container.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, track.id));
    expect(dbTrackBefore.length).toBe(1);

    const dbHandoutBefore = await container.db
      .select()
      .from(handouts)
      .where(eq(handouts.id, handout.id));
    expect(dbHandoutBefore.length).toBe(1);

    await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );

    const dbSceneAfter = await container.db
      .select()
      .from(scenes)
      .where(eq(scenes.id, scene.id));
    expect(dbSceneAfter.length).toBe(0);

    const dbTrackAfter = await container.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, track.id));
    expect(dbTrackAfter.length).toBe(0);

    const dbHandoutAfter = await container.db
      .select()
      .from(handouts)
      .where(eq(handouts.id, handout.id));
    expect(dbHandoutAfter.length).toBe(0);
  });

  test("Deleting module referenced by a session returns 409 MODULE_IN_USE", async () => {
    const modRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({
          name: "Referenced Module",
          description: "Desc",
          ruleId: "coc7e",
        }),
      })
    );
    const mod = await modRes.json();

    const { sessions } = await import("@/platform/db/schema");
    await container.db.insert(sessions).values({
      id: "sess-for-mod-test",
      moduleId: mod.id,
      status: "active",
      phase: "free_discussion",
      createdAt: Date.now(),
    });

    const delRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${gmToken}` },
      })
    );
    expect(delRes.status).toBe(409);
    const delBody = await delRes.json();
    expect(delBody.code).toBe("MODULE_IN_USE");
    expect(delBody.message).not.toContain("FOREIGN KEY");

    await container.db.delete(sessions).where((await import("drizzle-orm")).eq(sessions.id, "sess-for-mod-test"));
    await app.handle(
      new Request(`http://localhost/api/v1/gm/modules/${mod.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${gmToken}` },
      })
    );
  });

  test("Pagination (cursor/offset)", async () => {
    const listBefore = await app.handle(
      new Request("http://localhost/api/v1/gm/modules?limit=100", {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    const listBeforeBody = await listBefore.json();
    for (const mod of listBeforeBody.items) {
      await app.handle(
        new Request(`http://localhost/api/v1/gm/modules/${mod.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${gmToken}` }
        })
      );
    }

    const createdIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = await app.handle(
        new Request("http://localhost/api/v1/gm/modules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gmToken}`
          },
          body: JSON.stringify({
            name: `Module ${i}`,
            description: `Desc ${i}`,
            ruleId: "coc7e"
          })
        })
      );
      const body = await res.json();
      createdIds.push(body.id);
    }

    const modulesInDb = await container.db.select().from(modules);
    const sortedDbIds = modulesInDb
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt - b.createdAt;
        }
        return a.id.localeCompare(b.id);
      })
      .map(m => m.id);

    const page1Res = await app.handle(
      new Request("http://localhost/api/v1/gm/modules?limit=2", {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json();
    expect(page1.items.length).toBe(2);
    expect(page1.items[0].id).toBe(sortedDbIds[0]);
    expect(page1.items[1].id).toBe(sortedDbIds[1]);
    expect(page1.nextCursor).toBe(sortedDbIds[1]);

    const page2Res = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules?limit=2&cursor=${page1.nextCursor}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${gmToken}` }
        }
      )
    );
    expect(page2Res.status).toBe(200);
    const page2 = await page2Res.json();
    expect(page2.items.length).toBe(2);
    expect(page2.items[0].id).toBe(sortedDbIds[2]);
    expect(page2.items[1].id).toBe(sortedDbIds[3]);
    expect(page2.nextCursor).toBe(sortedDbIds[3]);

    const page3Res = await app.handle(
      new Request(
        `http://localhost/api/v1/gm/modules?limit=2&cursor=${page2.nextCursor}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${gmToken}` }
        }
      )
    );
    expect(page3Res.status).toBe(200);
    const page3 = await page3Res.json();
    expect(page3.items.length).toBe(1);
    expect(page3.items[0].id).toBe(sortedDbIds[4]);
    expect(page3.nextCursor).toBeNull();

    const offsetRes = await app.handle(
      new Request("http://localhost/api/v1/gm/modules?limit=2&offset=2", {
        method: "GET",
        headers: { Authorization: `Bearer ${gmToken}` }
      })
    );
    expect(offsetRes.status).toBe(200);
    const offsetBody = await offsetRes.json();
    expect(offsetBody.items.length).toBe(2);
    expect(offsetBody.items[0].id).toBe(sortedDbIds[2]);
    expect(offsetBody.items[1].id).toBe(sortedDbIds[3]);
  });
});
