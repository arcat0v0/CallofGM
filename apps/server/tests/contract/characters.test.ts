import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import * as xlsx from "xlsx";
import { Container } from "@/bootstrap/container";
import { createCharactersRoutes } from "@/modules/characters/transport/routes";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { importStagings, mediaAssets } from "@/platform/db/schema";
import { AppError } from "@/platform/errors/app-error";
import { gmUserIdRef, seedAccounts } from "../helpers/setup";

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
		await seedAccounts(container.db, gmPassword);

		app = new Elysia()
			.onError(({ error, code, set }) => {
				if (error instanceof AppError) {
					set.status = error.statusCode;
					return {
						code: error.code,
						message: error.message,
						metadata: error.metadata,
					};
				}
				if (code === "VALIDATION") {
					set.status = 400;
					return {
						code: "VALIDATION_FAILED",
						message: error.message,
					};
				}
				set.status = 500;
				return {
					code: "INTERNAL_SERVER_ERROR",
					message: (error as Error).message,
				};
			})
			.use(createIdentityRoutes(container))
			.use(createCharactersRoutes(container));

		const loginRes = await app.handle(
			new Request("http://localhost/api/v1/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "gm", password: gmPassword }),
			}),
		);
		const loginBody = (await loginRes.json()) as { sessionToken: string };
		gmToken = loginBody.sessionToken;

		await container.db.insert(mediaAssets).values({
			id: "media-asset-id",
			purpose: "portrait",
			storageKey: "test-key",
			filename: "test.png",
			mimeType: "image/png",
			size: 100,
			sha256: "dummy-hash",
			createdAt: Date.now(),
			ownerId: gmUserIdRef(container.db),
			deletedAt: null,
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
							luck: 50,
						},
						skills: {
							侦查: 25,
						},
					},
				}),
			}),
		);
		expect(res.status).toBe(401);
	});

	test("Manual CRUD and portraits management", async () => {
		const createRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
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
							luck: 50,
						},
						skills: {
							侦查: 25,
						},
					},
				}),
			}),
		);
		expect(createRes.status).toBe(200);
		const character = (await createRes.json()) as TestCharacterResponse;
		expect(character.id).toBeDefined();
		expect(character.name).toBe("手动角色");
		expect(character.kind).toBe("pc");

		const listRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
			}),
		);
		expect(listRes.status).toBe(200);
		const listPage = (await listRes.json()) as {
			items: TestCharacterResponse[];
		};
		const list =
			listPage.items ?? (listPage as unknown as TestCharacterResponse[]);
		expect(list.length).toBeGreaterThan(0);
		expect(list.some((c: { id: string }) => c.id === character.id)).toBe(true);

		const getRes = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
			}),
		);
		expect(getRes.status).toBe(200);
		const got = (await getRes.json()) as TestCharacterResponse;
		expect(got.name).toBe("手动角色");
		expect(got.portraits).toEqual([]);

		const patchRes = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					name: "更新的角色",
					kind: "npc",
				}),
			}),
		);
		expect(patchRes.status).toBe(200);
		const updated = (await patchRes.json()) as TestCharacterResponse;
		expect(updated.name).toBe("更新的角色");
		expect(updated.kind).toBe("npc");

		const addPortraitRes = await app.handle(
			new Request(
				`http://localhost/api/v1/gm/characters/${character.id}/portraits`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${gmToken}`,
					},
					body: JSON.stringify({
						expressionKey: "default",
						portraitAssetId: "media-asset-id",
						isDefault: true,
					}),
				},
			),
		);
		expect(addPortraitRes.status).toBe(200);
		const portrait = (await addPortraitRes.json()) as {
			id: string;
			isDefault: number;
		};
		expect(portrait.id).toBeDefined();
		expect(portrait.isDefault).toBe(1);

		const getWithPortraitRes = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
			}),
		);
		expect(getWithPortraitRes.status).toBe(200);
		const gotWithPortrait =
			(await getWithPortraitRes.json()) as TestCharacterResponse;
		expect(gotWithPortrait.portraits.length).toBe(1);
		expect(gotWithPortrait.portraits[0]!.id).toBe(portrait.id);

		const deletePortraitRes = await app.handle(
			new Request(
				`http://localhost/api/v1/gm/characters/${character.id}/portraits/${portrait.id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${gmToken}`,
					},
				},
			),
		);
		expect(deletePortraitRes.status).toBe(200);

		const getAfterPortraitDelete = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
			}),
		);
		expect(getAfterPortraitDelete.status).toBe(200);
		const gotAfterPortraitDelete =
			(await getAfterPortraitDelete.json()) as TestCharacterResponse;
		expect(gotAfterPortraitDelete.portraits.length).toBe(0);

		const { sessions, sessionCharacters } = await import(
			"@/platform/db/schema"
		);
		const { modules } = await import("@/platform/db/schema");
		await container.db
			.insert(modules)
			.values({
				id: "mod-ref-test",
				name: "Mod Ref",
				description: "",
				ruleId: "coc7e",
				createdAt: Date.now(),
				ownerId: gmUserIdRef(container.db),
				deletedAt: null,
				updatedAt: Date.now(),
			})
			.onConflictDoNothing();
		await container.db
			.insert(sessions)
			.values({
				id: "sess-ref-test",
				moduleId: "mod-ref-test",
				status: "active",
				phase: "free_discussion",
				createdAt: Date.now(),
				ownerId: gmUserIdRef(container.db),
				ruleId: "coc7e",
				deletedAt: null,
				sharePcSheets: 1,
				obSeePcState: 1,
				portraitLayout: "auto",
				portraitScale: "md",
				growthConfirmedAt: null,
				lastEventId: 0,
			})
			.onConflictDoNothing();
		await container.db.insert(sessionCharacters).values({
			id: "sc-ref-test",
			sessionId: "sess-ref-test",
			characterId: character.id,
			kind: "pc",
			stateJson: "{}",
			createdAt: Date.now(),
			deletedAt: null,
			name: "",
			background: "",
			ruleId: "coc7e",
			sheetJson: "{}",
			baseSheetVersion: 1,
			baseProfileVersion: 1,
		});

		const deleteReferencedRes = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${gmToken}` },
			}),
		);
		expect(deleteReferencedRes.status).toBe(200);

		const snapshotRow = await container.db
			.select()
			.from(sessionCharacters)
			.where(
				(await import("drizzle-orm")).eq(sessionCharacters.id, "sc-ref-test"),
			);
		expect(snapshotRow).toHaveLength(1);
		expect(snapshotRow[0]!.deletedAt).toBeNull();

		const getAfterDelete = await app.handle(
			new Request(`http://localhost/api/v1/gm/characters/${character.id}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
			}),
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
			["心理学", 50],
		];
		const ws = xlsx.utils.aoa_to_sheet(wsData);
		xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
		const excelBuffer = xlsx.write(wb, { type: "array", bookType: "xlsx" });

		const formData = new FormData();
		formData.append(
			"file",
			new Blob([excelBuffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"test.xlsx",
		);
		formData.append("ruleId", "coc7e");

		const previewRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters/import/preview", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${gmToken}`,
				},
				body: formData,
			}),
		);
		expect(previewRes.status).toBe(200);
		const previewBody = (await previewRes.json()) as {
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
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					importToken: previewBody.importToken,
					kind: "pc",
					ruleId: "coc7e",
				}),
			}),
		);
		expect(confirmRes.status).toBe(200);
		const confirmedCharacter =
			(await confirmRes.json()) as TestCharacterResponse;
		expect(confirmedCharacter.id).toBeDefined();
		expect(confirmedCharacter.name).toBe("张三");
		expect(confirmedCharacter.kind).toBe("pc");

		const getImportedRes = await app.handle(
			new Request(
				`http://localhost/api/v1/gm/characters/${confirmedCharacter.id}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${gmToken}`,
					},
				},
			),
		);
		expect(getImportedRes.status).toBe(200);
		const gotImported = (await getImportedRes.json()) as TestCharacterResponse;
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

	test("Import confirm rejects staging owned by another GM", async () => {
		const { users } = await import("@/platform/db/schema");
		const otherOwnerId = crypto.randomUUID();
		await container.db.insert(users).values({
			id: otherOwnerId,
			username: "other-gm",
			usernameNormalized: "other-gm",
			passwordHash: "x",
			role: "gm",
			disabledAt: null,
			deletedAt: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		await container.db.insert(importStagings).values({
			id: "foreign-staging",
			ownerId: otherOwnerId,
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
			createdAt: Date.now(),
		});

		const confirmRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters/import/confirm", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					importToken: "foreign-staging",
					kind: "pc",
					ruleId: "coc7e",
				}),
			}),
		);
		const body = (await confirmRes.json()) as { code: string };
		expect(body.code).toBe("STAGING_OWNER_MISMATCH");
	});

	test("Create and update character reject invalid kind and ruleId", async () => {
		const badKindRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					name: "测试人物",
					kind: "INVALID_KIND",
					ruleId: "coc7e",
					sheetData: {
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
					},
				}),
			}),
		);
		expect(badKindRes.status).toBe(400);

		const badRuleRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					name: "测试人物",
					kind: "pc",
					ruleId: "unregistered_rule",
					sheetData: {},
				}),
			}),
		);
		expect(badRuleRes.status).toBe(400);
	});

	function excelRows(
		nameLabel: string,
		nameValue: string,
		overrides: { omit?: string } = {},
	): unknown[][] {
		const rows: unknown[][] = [[nameLabel, nameValue]];
		const attributes: Array<[string, number, string]> = [
			["力量 (STR)", 60, "力量"],
			["体质 (CON)", 70, "体质"],
			["体型 (SIZ)", 80, "体型"],
			["敏捷 (DEX)", 50, "敏捷"],
			["外貌 (APP)", 40, "外貌"],
			["智力 (INT)", 65, "智力"],
			["意志 (POW)", 75, "意志"],
			["教育 (EDU)", 85, "教育"],
			["幸运 (LUCK)", 90, "幸运"],
		];
		for (const [label, value, key] of attributes) {
			if (overrides.omit === key) {
				continue;
			}
			rows.push([label, value]);
		}
		rows.push(["侦查", 30]);
		return rows;
	}

	async function previewRows(rows: unknown[][]): Promise<{
		importToken: string;
		preview: {
			characterName: string;
			sheetData: {
				attributes: Record<string, number>;
				skills: Record<string, number>;
			};
			errors: Array<{ cell: string; message: string }>;
			warnings: Array<{ cell: string; message: string }>;
		};
	}> {
		const wb = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), "Sheet1");
		const excelBuffer = xlsx.write(wb, { type: "array", bookType: "xlsx" });
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([excelBuffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"sheet.xlsx",
		);
		formData.append("ruleId", "coc7e");
		const res = await app.handle(
			new Request("http://localhost/api/v1/gm/characters/import/preview", {
				method: "POST",
				headers: { Authorization: `Bearer ${gmToken}` },
				body: formData,
			}),
		);
		expect(res.status).toBe(200);
		return (await res.json()) as {
			importToken: string;
			preview: {
				characterName: string;
				sheetData: {
					attributes: Record<string, number>;
					skills: Record<string, number>;
				};
				errors: Array<{ cell: string; message: string }>;
				warnings: Array<{ cell: string; message: string }>;
			};
		};
	}

	async function confirmImport(body: unknown): Promise<Response> {
		return app.handle(
			new Request("http://localhost/api/v1/gm/characters/import/confirm", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify(body),
			}),
		);
	}

	test("Excel import: missing optional attributes fall back to 50 without blocking", async () => {
		const rows = excelRows("姓名", "容错角色").filter(
			(row) => row[0] !== "外貌 (APP)" && row[0] !== "幸运 (LUCK)",
		);
		const preview = await previewRows(rows);
		expect(preview.preview.errors).toHaveLength(0);
		expect(preview.preview.sheetData.attributes.app).toBe(50);
		expect(preview.preview.sheetData.attributes.luck).toBe(50);

		const res = await confirmImport({
			importToken: preview.importToken,
			kind: "pc",
		});
		expect(res.status).toBe(200);
		const created = (await res.json()) as TestCharacterResponse;
		expect(created.name).toBe("容错角色");
	});

	test("Excel import: missing core attribute is a hard error and blocks confirm", async () => {
		const preview = await previewRows(
			excelRows("姓名", "缺关键属性角色", { omit: "体质" }),
		);
		expect(preview.preview.errors.some((error) => error.cell === "CON")).toBe(
			true,
		);
		const res = await confirmImport({
			importToken: preview.importToken,
			kind: "pc",
		});
		expect(res.status).toBe(400);
	});

	test("Excel import: characterId updates the existing character instead of creating a duplicate", async () => {
		const createRes = await app.handle(
			new Request("http://localhost/api/v1/gm/characters", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${gmToken}`,
				},
				body: JSON.stringify({
					name: "旧名字",
					kind: "pc",
					ruleId: "coc7e",
					sheetData: {
						attributes: {
							str: 10,
							con: 10,
							siz: 10,
							dex: 10,
							app: 10,
							int: 10,
							pow: 10,
							edu: 10,
							luck: 10,
						},
						skills: {},
					},
				}),
			}),
		);
		expect(createRes.status).toBe(200);
		const existing = (await createRes.json()) as TestCharacterResponse;

		const preview = await previewRows(excelRows("姓名", "新名字"));
		const res = await confirmImport({
			importToken: preview.importToken,
			kind: "pc",
			characterId: existing.id,
		});
		expect(res.status).toBe(200);
		const updated = (await res.json()) as TestCharacterResponse;
		expect(updated.id).toBe(existing.id);
		expect(updated.name).toBe("新名字");
		expect(
			(JSON.parse(updated.sheetJson) as { attributes: { str: number } })
				.attributes.str,
		).toBe(60);
	});

	test("Excel import: fuzzy name label emits a warning while player-name labels are ignored", async () => {
		const fuzzy = await previewRows(excelRows("调查员姓名（必填）", "王五"));
		expect(fuzzy.preview.characterName).toBe("王五");
		expect(fuzzy.preview.warnings).toHaveLength(1);

		const ignored = await previewRows(excelRows("玩家姓名", "赵六"));
		expect(ignored.preview.characterName).toBe("无名氏");
		expect(ignored.preview.warnings).toHaveLength(0);
	});
});
