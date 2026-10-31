import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createMediaRoutes } from "@/modules/media/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import {
  modules,
  scenes,
  tracks,
  handouts,
  sessions,
  sessionClaims,
  sessionCharacters,
  characterPortraits,
  characters,
  sessionAudioState,
  mediaAssets
} from "@/platform/db/schema";
import { rm } from "fs/promises";
import { existsSync } from "fs";
import { seedGmPassword } from "../helpers/setup";

describe("Media Storage contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "media-test-password";
  let gmToken = "";
  let playerToken = "";
  let playerId = "";

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
      .use(createMediaRoutes(container));

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
        body: JSON.stringify({ fingerprint: "media-player-fingerprint" })
      })
    );
    const playerBody = await playerRes.json();
    playerToken = playerBody.token;
    playerId = playerBody.playerId;
  });

  afterAll(async () => {
    container.dbContext.sqlite.close();
    if (existsSync("data/uploads")) {
      await rm("data/uploads", { recursive: true, force: true });
    }
  });

  test("Upload media - Unauthorized (no token)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: "image/png"
      }),
      "test.png"
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        body: formData
      })
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  test("Upload media - Success (GM with PNG)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0
          ])
        ],
        { type: "image/png" }
      ),
      "image.png"
    );
    formData.append("purpose", "scene_bg");
    formData.append("filename", "image.png");

    const response = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmToken}`
        },
        body: formData
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.mimeType).toBe("image/png");
    expect(body.purpose).toBe("scene_bg");
    expect(body.size).toBe(12);
  });

  test("Upload media - Unsupported Mime Type", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], {
        type: "application/octet-stream"
      }),
      "bad.bin"
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmToken}`
        },
        body: formData
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("UNSUPPORTED_MIME_TYPE");
  });

  test("Upload media - Size Exceeded limit", async () => {
    const largeData = new Uint8Array(10 * 1024 * 1024 + 100);
    largeData.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([largeData], { type: "image/png" }),
      "large.png"
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmToken}`
        },
        body: formData
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("FILE_SIZE_EXCEEDED");
  });

  test("Download media - GM unrestricted access", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9, 9
          ])
        ],
        { type: "image/png" }
      ),
      "gm-only.png"
    );
    formData.append("purpose", "private");
    formData.append("filename", "gm-only.png");

    const uploadRes = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmToken}`
        },
        body: formData
      })
    );
    const asset = await uploadRes.json();

    const downloadRes = await app.handle(
      new Request(`http://localhost/api/v1/media/${asset.id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${gmToken}`
        }
      })
    );

    expect(downloadRes.status).toBe(200);
    const buffer = await downloadRes.arrayBuffer();
    expect(buffer.byteLength).toBe(12);
  });

  test("Download media - Player unauthorized forbidden access", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 1, 1, 1
          ])
        ],
        { type: "image/png" }
      ),
      "secret.png"
    );
    formData.append("purpose", "handout");

    const uploadRes = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmToken}`
        },
        body: formData
      })
    );
    const asset = await uploadRes.json();

    const downloadRes = await app.handle(
      new Request(`http://localhost/api/v1/media/${asset.id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${playerToken}`
        }
      })
    );

    expect(downloadRes.status).toBe(403);
    const body = await downloadRes.json();
    expect(body.code).toBe("UNAUTHORIZED_MEDIA_ACCESS");
  });

  test("Download media - Player authorized access via active session", async () => {
    const bgData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2, 2, 2, 2
    ]);
    const audioData = new Uint8Array([
      0x49, 0x44, 0x33, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3
    ]);
    const portraitData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 4, 4, 4
    ]);
    const handoutData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 5, 5, 5
    ]);

    const uploadAsset = async (data: Uint8Array, name: string) => {
      const fd = new FormData();
      fd.append("file", new Blob([data]), name);
      const res = await app.handle(
        new Request("http://localhost/api/v1/media/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${gmToken}` },
          body: fd
        })
      );
      return res.json();
    };

    const bgAsset = await uploadAsset(bgData, "bg.png");
    const audioAsset = await uploadAsset(audioData, "audio.mp3");
    const portraitAsset = await uploadAsset(portraitData, "portrait.png");
    const handoutAsset = await uploadAsset(handoutData, "handout.png");

    await container.db.insert(modules).values({
      id: "media-m-1",
      name: "Media Test Module",
      description: "Desc",
      ruleId: "coc7e",
      createdAt: Date.now()
    });

    await container.db.insert(scenes).values({
      id: "media-s-1",
      moduleId: "media-m-1",
      name: "Media Test Scene",
      sortOrder: 1,
      bgAssetId: bgAsset.id,
      createdAt: Date.now()
    });

    await container.db.insert(sessions).values({
      id: "media-sess-1",
      moduleId: "media-m-1",
      status: "active",
      phase: "free_discussion",
      currentSceneId: "media-s-1",
      createdAt: Date.now()
    });

    await container.db.insert(characters).values({
      id: "media-char-1",
      name: "Media Test Character",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: "{}",
      createdAt: Date.now()
    });

    await container.db.insert(characterPortraits).values({
      id: "media-cp-1",
      characterId: "media-char-1",
      expressionKey: "default",
      portraitAssetId: portraitAsset.id,
      isDefault: 1,
      createdAt: Date.now()
    });

    await container.db.insert(sessionCharacters).values({
      id: "media-sc-1",
      sessionId: "media-sess-1",
      characterId: "media-char-1",
      kind: "pc",
      stateJson: "{}",
      createdAt: Date.now()
    });

    await container.db.insert(sessionClaims).values({
      id: "media-claim-1",
      sessionId: "media-sess-1",
      playerId: playerId,
      role: "pc",
      characterId: "media-char-1",
      releasedAt: null,
      createdAt: Date.now()
    });

    await container.db.insert(tracks).values({
      id: "media-t-1",
      moduleId: "media-m-1",
      name: "Media Test Track",
      audioAssetId: audioAsset.id,
      type: "bgm",
      duration: 120,
      createdAt: Date.now()
    });

    await container.db.insert(sessionAudioState).values({
      id: "media-sas-1",
      sessionId: "media-sess-1",
      trackId: "media-t-1",
      playing: 1,
      loop: 1,
      createdAt: Date.now()
    });

    await container.db.insert(handouts).values({
      id: "media-h-1",
      moduleId: "media-m-1",
      title: "Media Test Handout",
      content: "Handout Content",
      imageAssetId: handoutAsset.id,
      createdAt: Date.now()
    });

    const checkDownload = async (assetId: string) => {
      const res = await app.handle(
        new Request(`http://localhost/api/v1/media/${assetId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${playerToken}` }
        })
      );
      expect(res.status).toBe(200);
      return res.arrayBuffer();
    };

    const bgBuf = await checkDownload(bgAsset.id);
    expect(bgBuf.byteLength).toBe(12);

    const audioBuf = await checkDownload(audioAsset.id);
    expect(audioBuf.byteLength).toBe(14);

    const portraitBuf = await checkDownload(portraitAsset.id);
    expect(portraitBuf.byteLength).toBe(12);

    // 情报图片在发放前不可读（防止秘密情报经可猜 URL 泄漏）
    const beforeGrant = await app.handle(
      new Request(`http://localhost/api/v1/media/${handoutAsset.id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${playerToken}` }
      })
    );
    expect(beforeGrant.status).toBe(403);

    // 公开发放后可读
    const { handoutGrants } = await import("@/platform/db/schema");
    await container.db.insert(handoutGrants).values({
      id: "media-hg-1",
      sessionId: "media-sess-1",
      handoutId: "media-h-1",
      isPublic: 1,
      createdAt: Date.now()
    });

    const handoutBuf = await checkDownload(handoutAsset.id);
    expect(handoutBuf.byteLength).toBe(12);
  });
});
