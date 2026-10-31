import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import * as xlsx from "xlsx";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createCharactersRoutes } from "@/modules/characters/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import { seedGmPassword } from "../helpers/setup";
import {
  mediaAssets,
  gmLoginSessions,
  importStagings,
} from "@/platform/db/schema";

interface TestCharacterResponse {
  id: string;
  name: string;
  kind: string;
  sheetJson: string;
  portraits: Array<{ id: string }>;
}

describe("Characters contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "characters-test-password";
  let gmToken = "";

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
      .use(createCharactersRoutes(container));

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword })
      })
    );
    const loginBody = await loginRes.json() as { sessionToken: string };
    gmToken = loginBody.sessionToken;

    await container.db.insert(mediaAssets).values({
      id: "media-asset-id",
      purpose: "portrait",
      storageKey: "test-key",
      filename: "test.png",
      mimeType: "image/png",
      size: 100,
      sha256: "dummy-hash",
      createdAt: Date.now()
    });
  });

  afterAll(async () => {
    container.dbContext.sqlite.close();
  });

  test("Unauthorized - no token", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/v1/gm/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "手动角色",
          kind: "pc",
          ruleId: "coc7e",
          sheetData: {
            attributes: {
              str: 50,
              con: 60,
              siz: 70,
              dex: 80,
              app: 50,
              int: 60,
              pow: 70,
              edu: 80,
              luck: 50
            },
            skills: {
              "侦查": 25
            }
          }
        })
      })
    );
    expect(res.status).toBe(401);
  });

  test("Manual CRUD and portraits management", async () => {
    const createRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "手动角色",
          kind: "pc",
          ruleId: "coc7e",
          sheetData: {
            attributes: {
              str: 50,
              con: 60,
              siz: 70,
              dex: 80,
              app: 50,
              int: 60,
              pow: 70,
              edu: 80,
              luck: 50
            },
            skills: {
              "侦查": 25
            }
          }
        })
      })
    );
    expect(createRes.status).toBe(200);
    const character = await createRes.json() as TestCharacterResponse;
    expect(character.id).toBeDefined();
    expect(character.name).toBe("手动角色");
    expect(character.kind).toBe("pc");

    const listRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(listRes.status).toBe(200);
    const listPage = await listRes.json() as { items: TestCharacterResponse[] };
    const list = listPage.items ?? listPage as unknown as TestCharacterResponse[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((c: { id: string }) => c.id === character.id)).toBe(true);

    const getRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(getRes.status).toBe(200);
    const got = await getRes.json() as TestCharacterResponse;
    expect(got.name).toBe("手动角色");
    expect(got.portraits).toEqual([]);

    const patchRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          name: "更新的角色",
          kind: "npc"
        })
      })
    );
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json() as TestCharacterResponse;
    expect(updated.name).toBe("更新的角色");
    expect(updated.kind).toBe("npc");

    const addPortraitRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}/portraits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          expressionKey: "default",
          portraitAssetId: "media-asset-id",
          isDefault: true
        })
      })
    );
    expect(addPortraitRes.status).toBe(200);
    const portrait = await addPortraitRes.json() as { id: string; isDefault: number };
    expect(portrait.id).toBeDefined();
    expect(portrait.isDefault).toBe(1);

    const getWithPortraitRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(getWithPortraitRes.status).toBe(200);
    const gotWithPortrait = await getWithPortraitRes.json() as TestCharacterResponse;
    expect(gotWithPortrait.portraits.length).toBe(1);
    expect(gotWithPortrait.portraits[0]!.id).toBe(portrait.id);

    const deletePortraitRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/portraits/${portrait.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(deletePortraitRes.status).toBe(200);

    const getAfterPortraitDelete = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(getAfterPortraitDelete.status).toBe(200);
    const gotAfterPortraitDelete = await getAfterPortraitDelete.json() as TestCharacterResponse;
    expect(gotAfterPortraitDelete.portraits.length).toBe(0);

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(getAfterDelete.status).toBe(404);
  });

  test("Excel sheet preview and confirm import end-to-end", async () => {
    const wb = xlsx.utils.book_new();
    const wsData = [
      ["调查员姓名", "张三"],
      ["力量 (STR)", 60],
      ["体质 (CON)", 70],
      ["体型 (SIZ)", 80],
      ["敏捷 (DEX)", 50],
      ["外貌 (APP)", 40],
      ["智力 (INT)", 65],
      ["意志 (POW)", 75],
      ["教育 (EDU)", 85],
      ["幸运 (LUCK)", 90],
      ["侦查", 30],
      ["图书馆", 40],
      ["心理学", 50]
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    const excelBuffer = xlsx.write(wb, { type: "array", bookType: "xlsx" });

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      "test.xlsx"
    );
    formData.append("ruleId", "coc7e");

    const previewRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters/import/preview", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        },
        body: formData
      })
    );
    expect(previewRes.status).toBe(200);
    const previewBody = await previewRes.json() as {
      importToken: string;
      preview: {
        characterName: string;
        sheetData: {
          attributes: {
            str: number;
            con: number;
            siz: number;
            pow: number;
          };
          skills: Record<string, number>;
        };
        errors: unknown[];
      };
    };
    expect(previewBody.importToken).toBeDefined();
    expect(previewBody.preview.characterName).toBe("张三");
    expect(previewBody.preview.sheetData.attributes.str).toBe(60);
    expect(previewBody.preview.sheetData.attributes.con).toBe(70);
    expect(previewBody.preview.sheetData.attributes.siz).toBe(80);
    expect(previewBody.preview.sheetData.attributes.pow).toBe(75);
    expect(previewBody.preview.sheetData.skills["侦查"]).toBe(30);
    expect(previewBody.preview.sheetData.skills["图书馆"]).toBe(40);
    expect(previewBody.preview.sheetData.skills["心理学"]).toBe(50);
    expect(previewBody.preview.errors.length).toBe(0);

    const confirmRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters/import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          importToken: previewBody.importToken,
          kind: "pc",
          ruleId: "coc7e"
        })
      })
    );
    expect(confirmRes.status).toBe(200);
    const confirmedCharacter = await confirmRes.json() as TestCharacterResponse;
    expect(confirmedCharacter.id).toBeDefined();
    expect(confirmedCharacter.name).toBe("张三");
    expect(confirmedCharacter.kind).toBe("pc");

    const getImportedRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/characters/${confirmedCharacter.id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gmToken}`
        }
      })
    );
    expect(getImportedRes.status).toBe(200);
    const gotImported = await getImportedRes.json() as TestCharacterResponse;
    expect(gotImported.name).toBe("张三");
    const sheet = JSON.parse(gotImported.sheetJson) as {
      attributes: { str: number; con: number; siz: number; pow: number };
      skills: Record<string, number>;
    };
    expect(sheet.attributes.str).toBe(60);
    expect(sheet.attributes.con).toBe(70);
    expect(sheet.attributes.siz).toBe(80);
    expect(sheet.attributes.pow).toBe(75);
    expect(sheet.skills["侦查"]).toBe(30);
  });

  test("Import confirm rejects staging owned by another GM session", async () => {
    await container.db.insert(gmLoginSessions).values({
      id: "other-gm-session",
      sessionTokenHash: "foreign-gm-session-hash",
      expiresAt: Date.now() + 60 * 60 * 1000,
      revokedAt: null,
      createdAt: Date.now(),
    });
    await container.db.insert(importStagings).values({
      id: "foreign-staging",
      characterName: "Foreign Owner",
      sheetJson: JSON.stringify({
        attributes: {
          str: 50,
          con: 50,
          siz: 50,
          dex: 50,
          app: 50,
          int: 50,
          pow: 50,
          edu: 50,
          luck: 50,
        },
        skills: {},
      }),
      ruleId: "coc7e",
      errorsJson: "[]",
      expiresAt: Date.now() + 60 * 60 * 1000,
      consumedAt: null,
      gmSessionId: "other-gm-session",
      createdAt: Date.now(),
    });

    const confirmRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters/import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`
        },
        body: JSON.stringify({
          importToken: "foreign-staging",
          kind: "pc",
          ruleId: "coc7e"
        })
      })
    );
    expect(confirmRes.status).toBe(403);
    const body = await confirmRes.json() as { code: string };
    expect(body.code).toBe("STAGING_OWNER_MISMATCH");
  });

  test("Create and update character reject invalid kind and ruleId", async () => {
    const badKindRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`,
        },
        body: JSON.stringify({
          name: "测试人物",
          kind: "INVALID_KIND",
          ruleId: "coc7e",
          sheetData: {
            attributes: { str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50, luck: 50 },
            skills: {},
          },
        }),
      })
    );
    expect(badKindRes.status).toBe(400);

    const badRuleRes = await app.handle(
      new Request("http://localhost/api/v1/gm/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gmToken}`,
        },
        body: JSON.stringify({
          name: "测试人物",
          kind: "pc",
          ruleId: "unregistered_rule",
          sheetData: {},
        }),
      })
    );
    expect(badRuleRes.status).toBe(400);
  });
});
