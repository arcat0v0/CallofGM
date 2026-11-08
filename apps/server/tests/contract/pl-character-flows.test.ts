import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterDetailDto,
	CharacterDto,
	CharacterHistoryResponse,
	coc7e,
} from "@cogm/shared";
import type { WorkSheet } from "xlsx";
import { createApp } from "@/app";
import {
	gmUserIdRef,
	listenTestApp,
	loginToken,
	seedPlayers,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const PASSWORD = "pl-flow-password";

describe("PL character ownership, versions and growth", () => {
	let ctx: TestContext;
	let server: TestServer;
	let plToken = "";
	let otherToken = "";
	let plUserId = "";
	let otherUserId = "";
	let moduleId = "";
	let fullApp: ReturnType<typeof createApp>;

	function api(path: string, init: RequestInit & { token?: string } = {}) {
		const { token, ...rest } = init;
		return ctx.app.handle(
			new Request(`http://localhost${path}`, {
				...rest,
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...rest.headers,
				},
			}),
		);
	}

	function fullApi(path: string, init: RequestInit & { token?: string } = {}) {
		const { token, ...rest } = init;
		return fullApp.handle(
			new Request(`http://localhost${path}`, {
				...rest,
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...rest.headers,
				},
			}),
		);
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		server = listenTestApp(ctx.app);
		fullApp = createApp(ctx.container);

		const accounts = await seedPlayers(ctx.container.db, PASSWORD, [
			"flow-a",
			"flow-b",
		]);
		plUserId = accounts.get("flow-a")!.userId;
		otherUserId = accounts.get("flow-b")!.userId;
		plToken = await loginToken(ctx.app, "flow-a", PASSWORD);
		otherToken = await loginToken(ctx.app, "flow-b", PASSWORD);

		const moduleRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "PL 流程模组",
				description: "",
				ruleId: "coc7e",
			}),
		});
		moduleId = ((await moduleRes.json()) as { id: string }).id;
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	async function createPlCharacter(name: string, token = plToken) {
		const res = await api("/api/v1/pl/characters", {
			method: "POST",
			token,
			body: JSON.stringify({
				name,
				ruleId: "coc7e",
				background: "调查员背景",
				sheetData: {
					attributes: {
						str: 50,
						con: 50,
						siz: 50,
						dex: 50,
						app: 50,
						int: 60,
						pow: 60,
						edu: 70,
						luck: 50,
					},
					skills: { 侦查: 40 },
				},
			}),
		});
		expect(res.status).toBe(200);
		return CharacterDto.parse(await res.json());
	}

	function completeCoc7eSheet() {
		return coc7e.normalizeCoc7eSheet({
			schemaVersion: 2,
			era: "1920s",
			age: 42,
			occupation: {
				presetId: "occ-220",
				name: "记者",
				skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
				creditMin: 9,
				creditMax: 30,
				skillKeys: ["历史", "图书馆"],
				choiceSelections: {},
				freeSkillKeys: [],
			},
			movementModifier: -2,
			attributes: {
				str: 60,
				con: 65,
				siz: 70,
				dex: 55,
				app: 45,
				int: 80,
				pow: 60,
				edu: 75,
				luck: 50,
			},
			skills: { 侦查: 65, "格斗(斗殴)": 45, 克苏鲁神话: 3 },
			customSkills: {
				"语言(法语)": { base: 1 },
				"母语(英语)": { base: 0, formula: "edu" },
			},
			weapons: [
				{
					name: "点三八左轮",
					skillKey: "射击(手枪)",
					damage: "1D10",
					range: "15码",
					attacks: "1",
					ammo: 6,
					malfunction: 100,
					impale: false,
					applyDamageBonus: false,
				},
			],
			armor: { name: "皮夹克", value: 1, locations: "躯干", penalty: 0 },
			gear: [
				{ name: "笔记本", quantity: 2 },
				{ name: "手电筒", quantity: 1 },
			],
			spells: [
				{
					name: "心灵感应",
					mpCost: "3",
					sanCost: "1D3",
					castingTime: "1轮",
					effect: "读取表层思绪",
				},
			],
			mythosTomes: [
				{
					name: "无名祭祀书",
					sanLoss: "1D6",
					mythosGain: 2,
					studyHours: 12,
					spells: "心灵感应",
				},
			],
			encounters: [
				{
					name: "深潜者",
					sanLoss: "1/1D6",
					mythosGain: 1,
					count: 2,
					notes: "港口遭遇",
				},
			],
			assets: {
				currency: "$",
				spendingLevel: 10,
				cash: 82.5,
				otherAssets: 2050,
				details: [{ category: "residence", name: "公寓", value: 2000 }],
			},
		});
	}

	function expectCompleteCoc7eSheet(sheet: coc7e.Coc7eCharacterSheet) {
		expect(sheet.schemaVersion).toBe(2);
		expect(sheet.era).toBe("1920s");
		expect(sheet.age).toBe(42);
		expect(sheet.occupation).toEqual({
			presetId: "occ-220",
			name: "记者",
			skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
			creditMin: 9,
			creditMax: 30,
			skillKeys: ["历史", "图书馆"],
			choiceSelections: {},
			freeSkillKeys: [],
		});
		expect(sheet.movementModifier).toBe(-2);
		expect(sheet.attributes.str).toBe(60);
		expect(sheet.attributes.edu).toBe(75);
		expect(sheet.skills["侦查"]).toBe(65);
		expect(sheet.skills["格斗(斗殴)"]).toBe(45);
		expect(sheet.customSkills["语言(法语)"]).toEqual({ base: 1 });
		expect(sheet.customSkills["母语(英语)"]).toEqual({
			base: 0,
			formula: "edu",
		});
		expect(sheet.weapons[0]).toMatchObject({
			name: "点三八左轮",
			skillKey: "射击(手枪)",
			damage: "1D10",
			ammo: 6,
		});
		expect(sheet.armor).toEqual({
			name: "皮夹克",
			value: 1,
			locations: "躯干",
			penalty: 0,
		});
		expect(sheet.gear[0]).toEqual({ name: "笔记本", quantity: 2 });
		expect(sheet.spells[0]?.name).toBe("心灵感应");
		expect(sheet.mythosTomes[0]?.name).toBe("无名祭祀书");
		expect(sheet.mythosTomes[0]?.mythosGain).toBe(2);
		expect(sheet.encounters[0]?.name).toBe("深潜者");
		expect(sheet.encounters[0]?.count).toBe(2);
		expect(sheet.assets.cash).toBe(82.5);
		expect(sheet.assets.details[0]).toEqual({
			category: "residence",
			name: "公寓",
			value: 2000,
		});
	}

	function countCharacters(): number {
		return (
			ctx.container.dbContext.sqlite
				.query<{ count: number }, []>(
					"select count(*) as count from characters",
				)
				.get()?.count ?? 0
		);
	}

	function countReviews(): number {
		return (
			ctx.container.dbContext.sqlite
				.query<{ count: number }, []>(
					"select count(*) as count from character_reviews",
				)
				.get()?.count ?? 0
		);
	}

	test("PL 创建人物：归属自己、kind 固定为 pc、规则必填", async () => {
		const created = await createPlCharacter("PL 自建卡");
		expect(created.ownerId).toBe(plUserId);
		expect(created.ownerKind).toBe("pl");
		expect(created.kind).toBe("pc");
		expect(created.ruleId).toBe("coc7e");
		expect(created.version).toBe(1);
		expect(created.background).toBe("调查员背景");

		const missingRule = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ name: "无规则", sheetData: {} }),
		});
		expect(missingRule.status).toBe(400);
	});

	test("跨账号隔离：他人人物不可读、不可改、不可删", async () => {
		const mine = await createPlCharacter("隔离测试卡");

		const readByOther = await api(`/api/v1/pl/characters/${mine.id}`, {
			token: otherToken,
		});
		expect(readByOther.status).toBe(404);

		const patchByOther = await api(`/api/v1/pl/characters/${mine.id}`, {
			method: "PATCH",
			token: otherToken,
			body: JSON.stringify({ name: "被篡改" }),
		});
		expect(patchByOther.status).toBe(403);

		const deleteByOther = await api(`/api/v1/pl/characters/${mine.id}`, {
			method: "DELETE",
			token: otherToken,
		});
		expect(deleteByOther.status).toBe(403);

		const readByOwner = await api(`/api/v1/pl/characters/${mine.id}`, {
			token: plToken,
		});
		expect(readByOwner.status).toBe(200);

		const listMine = await api("/api/v1/pl/characters?limit=100", {
			token: plToken,
		});
		const listBody = (await listMine.json()) as {
			items: Array<{ id: string }>;
		};
		expect(listBody.items.some((item) => item.id === mine.id)).toBe(true);

		const listOther = await api("/api/v1/pl/characters?limit=100", {
			token: otherToken,
		});
		const otherBody = (await listOther.json()) as {
			items: Array<{ id: string }>;
		};
		expect(otherBody.items.some((item) => item.id === mine.id)).toBe(false);
	});

	test("版本与历史：每次修改递增版本并留下追加式记录", async () => {
		const created = await createPlCharacter("版本测试卡");

		const updated = await api(`/api/v1/pl/characters/${created.id}`, {
			method: "PATCH",
			token: plToken,
			body: JSON.stringify({
				background: "改后的背景",
				expectedVersion: created.version,
			}),
		});
		expect(updated.status).toBe(200);
		const afterUpdate = CharacterDto.parse(await updated.json());
		expect(afterUpdate.version).toBe(created.version + 1);
		expect(afterUpdate.background).toBe("改后的背景");

		const stale = await api(`/api/v1/pl/characters/${created.id}`, {
			method: "PATCH",
			token: plToken,
			body: JSON.stringify({
				background: "基于旧版本",
				expectedVersion: created.version,
			}),
		});
		expect(stale.status).toBe(409);

		const historyRes = await api(
			`/api/v1/pl/characters/${created.id}/history`,
			{
				token: plToken,
			},
		);
		expect(historyRes.status).toBe(200);
		const history = CharacterHistoryResponse.parse(await historyRes.json());
		expect(history.versions.length).toBeGreaterThanOrEqual(1);
	});

	test("GM 不能读取 PL 私密人物库，但不能代替 PL 建卡", async () => {
		const created = await createPlCharacter("GM 越权测试");

		const gmRead = await api(`/api/v1/pl/characters/${created.id}`, {
			token: ctx.gmToken,
		});
		expect(gmRead.status).toBe(404);

		const gmList = await api("/api/v1/pl/characters?limit=100", {
			token: ctx.gmToken,
		});
		const gmListBody = (await gmList.json()) as {
			items: Array<{ id: string }>;
		};
		expect(gmListBody.items.some((item) => item.id === created.id)).toBe(false);
	});

	test("admin 不参与人物管理", async () => {
		const adminList = await api("/api/v1/pl/characters", {
			token: ctx.adminToken,
		});
		expect(adminList.status).toBe(403);
	});

	test("GM 可将自己预建的 PC 分配给 PL，分配后归属 PL", async () => {
		const gmCreate = await api("/api/v1/gm/characters", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "预建 PC",
				kind: "pc",
				ruleId: "coc7e",
				background: "",
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
		});
		expect(gmCreate.status).toBe(200);
		const gmCharacter = CharacterDto.parse(await gmCreate.json());
		expect(gmCharacter.ownerKind).toBe("gm");

		const assign = await api(`/api/v1/gm/characters/${gmCharacter.id}/owner`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ ownerId: otherUserId }),
		});
		expect(assign.status).toBe(200);

		const readByTarget = await api(`/api/v1/pl/characters/${gmCharacter.id}`, {
			token: otherToken,
		});
		expect(readByTarget.status).toBe(200);
		const assigned = CharacterDetailDto.parse(await readByTarget.json());
		expect(assigned.ownerId).toBe(otherUserId);
		expect(assigned.ownerKind).toBe("pl");
	});

	test("结团成长确认：写入主卡并记录成长条目，重复确认被拒", async () => {
		const character = await createPlCharacter("成长测试卡");

		const link = await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: character.id }),
		});
		expect(link.status).toBe(200);

		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [character.id] }),
		});
		expect(sessionRes.status).toBe(200);
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const inSession = await api(
			`/api/v1/pl/characters/${character.id}/history`,
			{ token: plToken },
		);
		expect(inSession.status).toBe(200);

		const early = await api(`/api/v1/gm/sessions/${sessionId}/growth/confirm`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ gains: [{ skillKey: "侦查", delta: 5 }] }),
		});
		expect(early.status).toBe(400);

		await api(`/api/v1/gm/sessions/${sessionId}/status`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ status: "preparing" }),
		});
		await api(`/api/v1/gm/sessions/${sessionId}/status`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ status: "active" }),
		});
		const end = await api(`/api/v1/gm/sessions/${sessionId}/status`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ status: "ended" }),
		});
		expect(end.status).toBe(200);

		const confirm = await api(
			`/api/v1/gm/sessions/${sessionId}/growth/confirm`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({ gains: [{ skillKey: "侦查", delta: 5 }] }),
			},
		);
		const confirmBody = (await confirm.json()) as {
			characters: Array<{
				characterId: string;
				applied: Array<{
					skillKey: string;
					oldValue: number;
					newValue: number;
				}>;
			}>;
		};
		expect(confirm.status).toBe(200);
		const applied = confirmBody.characters.find(
			(c) => c.characterId === character.id,
		);
		expect(applied?.applied[0]).toEqual({
			skillKey: "侦查",
			oldValue: 40,
			newValue: 45,
		});

		const detail = await api(`/api/v1/pl/characters/${character.id}`, {
			token: plToken,
		});
		const afterGrowth = CharacterDetailDto.parse(await detail.json());
		const sheet = JSON.parse(afterGrowth.sheetJson) as {
			skills: Record<string, number>;
		};
		expect(sheet.skills["侦查"]).toBe(45);
		expect(afterGrowth.version).toBe(character.version + 1);

		const again = await api(`/api/v1/gm/sessions/${sessionId}/growth/confirm`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ gains: [{ skillKey: "侦查", delta: 5 }] }),
		});
		expect(again.status).toBe(400);
	});

	test("GM 终生字段修改需记录审计并可见", async () => {
		const character = await createPlCharacter("审计测试卡");

		const stale = await api(
			`/api/v1/gm/characters/${character.id}/permanent-field`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					field: "str",
					value: 65,
					reason: "过期修改",
					expectedVersion: character.version + 99,
				}),
			},
		);
		expect(stale.status).toBe(409);
		const audit = await api(
			`/api/v1/gm/characters/${character.id}/permanent-field`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					field: "str",
					value: 70,
					reason: "剧情奖励",
					expectedVersion: character.version,
				}),
			},
		);
		expect(audit.status).toBe(200);

		const historyRes = await api(
			`/api/v1/pl/characters/${character.id}/history`,
			{
				token: plToken,
			},
		);
		const history = CharacterHistoryResponse.parse(await historyRes.json());
		expect(history.audits.length).toBeGreaterThanOrEqual(1);
		expect(history.audits[0]!.field).toBe("str");
		expect(history.audits[0]!.reason).toBe("剧情奖励");
	});

	test("PL Excel 新导入归属玩家且固定为 PC", async () => {
		const xlsx = await import("xlsx");
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(
			workbook,
			xlsx.utils.aoa_to_sheet([
				["姓名", "导入的新调查员"],
				["力量", 60],
				["体质", 55],
				["体型", 65],
				["敏捷", 50],
				["外貌", 45],
				["智力", 70],
				["意志", 60],
				["教育", 75],
				["幸运", 50],
				["侦查", 55],
			]),
			"Sheet1",
		);
		const form = new FormData();
		form.append(
			"file",
			new Blob(
				[
					xlsx.write(workbook, {
						type: "array",
						bookType: "xlsx",
					}) as ArrayBuffer,
				],
				{
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			),
			"new.xlsx",
		);
		form.append("ruleId", "coc7e");
		const preview = await ctx.app.handle(
			new Request("http://localhost/api/v1/pl/characters/import/preview", {
				method: "POST",
				headers: { Authorization: `Bearer ${plToken}` },
				body: form,
			}),
		);
		expect(preview.status).toBe(200);
		const previewBody = (await preview.json()) as { importToken: string };
		const confirm = await api("/api/v1/pl/characters/import/confirm", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				importToken: previewBody.importToken,
				kind: "npc",
			}),
		});
		expect(confirm.status).toBe(200);
		const created = CharacterDto.parse(await confirm.json());
		expect(created.ownerId).toBe(plUserId);
		expect(created.ownerKind).toBe("pl");
		expect(created.kind).toBe("pc");
		expect(created.name).toBe("导入的新调查员");
	});

	test("PL Excel 更新只覆盖明确字段并保留武器、资产和法术", async () => {
		const xlsx = await import("xlsx");
		const created = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "导入前的旧卡",
				background: "旧背景",
				ruleId: "coc7e",
				sheetData: completeCoc7eSheet(),
			}),
		});
		expect(created.status).toBe(200);
		const existing = CharacterDto.parse(await created.json());
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(
			workbook,
			{
				"!ref": "A1:CI181",
				E3: { t: "s", v: "导入后的新卡" },
				U3: { t: "n", v: 66 },
				F16: { t: "s", v: "会计" },
				R16: { t: "n", v: 7 },
			} as unknown as WorkSheet,
			"人物卡",
		);
		const buffer = xlsx.write(workbook, {
			type: "array",
			bookType: "xlsx",
		}) as ArrayBuffer;
		const form = new FormData();
		form.append(
			"file",
			new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"update.xlsx",
		);
		form.append("ruleId", "coc7e");
		const preview = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/pl/characters/import/preview?characterId=${encodeURIComponent(existing.id)}`,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${plToken}` },
					body: form,
				},
			),
		);
		expect(preview.status).toBe(200);
		const previewBody = (await preview.json()) as {
			importToken: string;
			preview: { errors: unknown[]; providedFields: string[] };
		};
		expect(previewBody.preview.errors).toEqual([]);
		expect(previewBody.preview.providedFields).toContain("attributes.str");
		expect(previewBody.preview.providedFields).toContain("skills.会计");
		const confirm = await api("/api/v1/pl/characters/import/confirm", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				importToken: previewBody.importToken,
				kind: "pc",
				characterId: existing.id,
				expectedVersion: existing.version,
			}),
		});
		expect(confirm.status).toBe(200);
		const updated = CharacterDto.parse(await confirm.json());
		const updatedSheet = coc7e.Coc7eCharacterSheet.parse(
			JSON.parse(updated.sheetJson),
		);
		expect(updated.name).toBe("导入后的新卡");
		expect(updatedSheet.attributes.str).toBe(66);
		expect(updatedSheet.skills["会计"]).toBe(7);
		expect(updatedSheet.weapons[0]?.name).toBe("点三八左轮");
		expect(updatedSheet.assets.details[0]?.name).toBe("公寓");
		expect(updatedSheet.spells[0]?.name).toBe("心灵感应");
	});

	test("软删除：删除后列表不可见，回收站可见且可恢复", async () => {
		const character = await createPlCharacter("软删除测试卡");

		const del = await api(`/api/v1/pl/characters/${character.id}`, {
			method: "DELETE",
			token: plToken,
		});
		expect(del.status).toBe(200);

		const afterDelete = await api(`/api/v1/pl/characters/${character.id}`, {
			token: plToken,
		});
		expect(afterDelete.status).toBe(404);

		const rows = await ctx.container.dbContext.sqlite
			.query<{ deleted_at: number | null }, [string]>(
				"select deleted_at from characters where id = ?",
			)
			.get(character.id);
		expect(rows?.deleted_at).not.toBeNull();
	});

	test("PL 只看到自己参团的团，且带席位与角色信息", async () => {
		const character = await createPlCharacter("参团人物");
		await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: character.id }),
		});
		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [character.id] }),
		});
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const claim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(claim.status).toBe(200);

		const mineRes = await api("/api/v1/pl/sessions", { token: plToken });
		expect(mineRes.status).toBe(200);
		const mine = (await mineRes.json()) as Array<{
			sessionId: string;
			role: string;
			characterName: string | null;
			ruleId: string;
		}>;
		const entry = mine.find((item) => item.sessionId === sessionId);
		expect(entry?.role).toBe("pc");
		expect(entry?.characterName).toBe("参团人物");
		expect(entry?.ruleId).toBe("coc7e");

		const otherView = await api("/api/v1/pl/sessions", { token: otherToken });
		const otherList = (await otherView.json()) as Array<{ sessionId: string }>;
		expect(otherList.some((item) => item.sessionId === sessionId)).toBe(false);

		const gmView = await api("/api/v1/pl/sessions", { token: ctx.gmToken });
		expect(gmView.status).toBe(403);
	});

	test("admin 拥有主题管理，GM 不再能访问", async () => {
		const adminRes = await api("/api/v1/admin/themes", {
			token: ctx.adminToken,
		});
		expect(adminRes.status).toBe(200);

		const gmRes = await api("/api/v1/admin/themes", { token: ctx.gmToken });
		expect(gmRes.status).toBe(403);
	});

	test("规则未注册时拒绝建卡", async () => {
		const res = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "未知规则",
				ruleId: "unregistered-rule",
				sheetData: {},
			}),
		});
		expect(res.status).toBe(400);
	});

	test("PL 创建人物：完整 CoC 7e v2 角色卡可保存并按分区读回", async () => {
		const expected = completeCoc7eSheet();
		const res = await fullApi("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "完整调查员",
				background: "完整人物背景",
				ruleId: "coc7e",
				sheetData: expected,
			}),
		});
		expect(res.status).toBe(200);
		const created = CharacterDto.parse(await res.json());
		expect(created.ownerId).toBe(plUserId);
		expect(created.ownerKind).toBe("pl");
		expect(created.kind).toBe("pc");

		const detailRes = await fullApi(`/api/v1/pl/characters/${created.id}`, {
			token: plToken,
		});
		expect(detailRes.status).toBe(200);
		const detail = CharacterDetailDto.parse(await detailRes.json());
		expect(detail.name).toBe("完整调查员");
		expect(detail.background).toBe("完整人物背景");
		const persisted: coc7e.Coc7eCharacterSheet = JSON.parse(detail.sheetJson);
		expect(persisted).toEqual(expected);
		expectCompleteCoc7eSheet(persisted);
	});

	test("PL 创建人物：完整卡含非法属性时返回 400 且不新增人物或审核", async () => {
		const invalid = structuredClone(completeCoc7eSheet());
		invalid.attributes.str = 0;
		const charactersBefore = countCharacters();
		const reviewsBefore = countReviews();

		const res = await fullApi("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "非法完整卡",
				background: "",
				ruleId: "coc7e",
				sheetData: invalid,
			}),
		});
		expect(res.status).toBe(400);
		expect(countCharacters()).toBe(charactersBefore);
		expect(countReviews()).toBe(reviewsBefore);
	});
});
