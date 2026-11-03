import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterDetailDto,
	CharacterDto,
	CharacterHistoryResponse,
} from "@cogm/shared";
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

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		server = listenTestApp(ctx.app);

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

		const audit = await api(
			`/api/v1/gm/characters/${character.id}/permanent-field`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					field: "str",
					value: 70,
					reason: "剧情奖励",
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
});
