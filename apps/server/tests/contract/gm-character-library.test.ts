import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GmCharacterLibraryResponse } from "@cogm/shared";
import { eq } from "drizzle-orm";
import {
	CreateUserUseCase,
	DrizzleIdentityRepository,
} from "@/modules/identity";
import { characters } from "@/platform/db/schema";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import {
	listenTestApp,
	loginToken,
	seedPlayers,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const PASSWORD = "library-test-password";

describe("GM 人物库（按规则浏览）与人物访问隔离", () => {
	let ctx: TestContext;
	let server: TestServer;
	let otherGmToken = "";
	let plToken = "";
	let fogModuleId = "";
	let lighthouseModuleId = "";
	let dndModuleId = "";
	let otherGmModuleId = "";
	const ids = {} as Record<
		| "irene"
		| "jack"
		| "osborne"
		| "ranger"
		| "foreign"
		| "plLinked"
		| "plUnlinked",
		string
	>;

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

	async function json<T>(response: Response): Promise<T> {
		return (await response.json()) as T;
	}

	async function createModule(token: string, name: string, ruleId: string) {
		const res = await api("/api/v1/gm/modules", {
			method: "POST",
			token,
			body: JSON.stringify({ name, description: "", ruleId }),
		});
		expect(res.status).toBe(200);
		return (await json<{ id: string }>(res)).id;
	}

	async function createGmCharacter(
		token: string,
		name: string,
		kind: "pc" | "npc",
		ruleId: string,
	) {
		const res = await api("/api/v1/gm/characters", {
			method: "POST",
			token,
			body: JSON.stringify({ name, kind, ruleId }),
		});
		expect(res.status).toBe(200);
		return (await json<{ id: string }>(res)).id;
	}

	async function link(token: string, moduleId: string, characterId: string) {
		return api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token,
			body: JSON.stringify({ characterId }),
		});
	}

	async function library(query: string, token = ctx.gmToken) {
		const res = await api(`/api/v1/gm/characters/library?${query}`, { token });
		expect(res.status).toBe(200);
		return GmCharacterLibraryResponse.parse(await res.json());
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		server = listenTestApp(ctx.app);

		const identity = new DrizzleIdentityRepository(ctx.container.db);
		await new CreateUserUseCase(
			new UuidGenerator(),
			new SystemClock(),
			identity,
		).execute({ username: "library-gm-2", password: PASSWORD, role: "gm" });
		otherGmToken = await loginToken(ctx.app, "library-gm-2", PASSWORD);
		await seedPlayers(ctx.container.db, PASSWORD, ["library-pl"]);
		plToken = await loginToken(ctx.app, "library-pl", PASSWORD);

		fogModuleId = await createModule(ctx.gmToken, "雾港疑案", "coc7e");
		lighthouseModuleId = await createModule(ctx.gmToken, "沉默的灯塔", "coc7e");
		dndModuleId = await createModule(ctx.gmToken, "破晓矿坑", "dnd5r");
		otherGmModuleId = await createModule(otherGmToken, "别人的模组", "coc7e");

		ids.irene = await createGmCharacter(
			ctx.gmToken,
			"艾琳·沃克",
			"pc",
			"coc7e",
		);
		ids.jack = await createGmCharacter(
			ctx.gmToken,
			"码头工人 杰克",
			"npc",
			"coc7e",
		);
		ids.osborne = await createGmCharacter(
			ctx.gmToken,
			"奥斯本教授",
			"npc",
			"coc7e",
		);
		ids.ranger = await createGmCharacter(
			ctx.gmToken,
			"艾拉·晨风",
			"pc",
			"dnd5r",
		);
		ids.foreign = await createGmCharacter(
			otherGmToken,
			"别人的人物",
			"npc",
			"coc7e",
		);

		const plRes = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "玩家调查员",
				ruleId: "coc7e",
				background: "来自波士顿的调查员",
			}),
		});
		expect(plRes.status).toBe(200);
		ids.plLinked = (await json<{ id: string }>(plRes)).id;
		const plRes2 = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "未关联玩家人物",
				ruleId: "coc7e",
				background: "尚未加入模组的调查员",
			}),
		});
		ids.plUnlinked = (await json<{ id: string }>(plRes2)).id;

		expect((await link(ctx.gmToken, fogModuleId, ids.irene)).status).toBe(200);
		expect(
			(await link(ctx.gmToken, lighthouseModuleId, ids.irene)).status,
		).toBe(200);
		expect((await link(ctx.gmToken, fogModuleId, ids.jack)).status).toBe(200);
		expect((await link(ctx.gmToken, dndModuleId, ids.ranger)).status).toBe(200);
		// 玩家人物经审核关联到模组（模拟审核通过后的内部关联）
		await ctx.container.charactersRepo.linkCharacterToModule({
			id: crypto.randomUUID(),
			moduleId: lighthouseModuleId,
			characterId: ids.plLinked,
			createdAt: Date.now(),
		});
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	test("只返回该规则下自有人物与关联到本人模组的玩家人物，并带分面计数", async () => {
		const page = await library("ruleId=coc7e");
		const names = page.items.map((item) => item.name).sort();
		expect(names).toEqual(
			["码头工人 杰克", "奥斯本教授", "艾琳·沃克", "玩家调查员"].sort(),
		);
		expect(page.total).toBe(4);
		expect(page.facets.rules).toEqual(
			expect.arrayContaining([
				{ ruleId: "coc7e", count: 4 },
				{ ruleId: "dnd5r", count: 1 },
			]),
		);
		expect(page.facets.kinds).toEqual({ pc: 2, npc: 2 });
		expect(page.facets.owners).toEqual({ gm: 3, pl: 1 });
		expect(page.facets.unlinked).toBe(1);
		expect(
			page.facets.modules.filter((module) =>
				[fogModuleId, lighthouseModuleId].includes(module.id),
			),
		).toEqual([
			{ id: lighthouseModuleId, name: "沉默的灯塔", count: 2 },
			{ id: fogModuleId, name: "雾港疑案", count: 2 },
		]);

		const irene = page.items.find((item) => item.id === ids.irene);
		expect(irene?.modules.map((module) => module.name)).toEqual([
			"沉默的灯塔",
			"雾港疑案",
		]);
		expect(irene?.ownedByMe).toBe(true);
		const pl = page.items.find((item) => item.id === ids.plLinked);
		expect(pl?.ownedByMe).toBe(false);
		expect(pl?.ownerName).toBe("library-pl");
		expect(pl?.ownerKind).toBe("pl");
		expect(JSON.stringify(page)).not.toContain("sheetJson");
	});

	test("过滤条件可组合，分面按其余条件计数", async () => {
		const npcInFog = await library(
			`ruleId=coc7e&kind=npc&moduleId=${fogModuleId}`,
		);
		expect(npcInFog.items.map((item) => item.name)).toEqual(["码头工人 杰克"]);
		expect(npcInFog.facets.kinds).toEqual({ pc: 1, npc: 1 });
		expect(
			npcInFog.facets.modules.find((m) => m.id === fogModuleId)?.count,
		).toBe(1);

		const unlinked = await library("ruleId=coc7e&moduleId=none");
		expect(unlinked.items.map((item) => item.name)).toEqual(["奥斯本教授"]);

		const players = await library("ruleId=coc7e&ownerKind=pl");
		expect(players.items.map((item) => item.name)).toEqual(["玩家调查员"]);

		const search = await library(
			`ruleId=coc7e&q=${encodeURIComponent("艾琳")}`,
		);
		expect(search.items.map((item) => item.name)).toEqual(["艾琳·沃克"]);
	});

	test("排序与游标分页", async () => {
		const first = await library("ruleId=coc7e&sort=name&limit=3");
		expect(first.items).toHaveLength(3);
		expect(first.nextCursor).toBe("3");
		const second = await library("ruleId=coc7e&sort=name&limit=3&cursor=3");
		expect(second.items).toHaveLength(1);
		expect(second.nextCursor).toBeNull();
		const all = [...first.items, ...second.items].map((item) => item.id);
		expect(new Set(all).size).toBe(4);
	});

	test("其他 GM 看不到本人人物库，且无法读取、删除或关联他人人物", async () => {
		const other = await library("ruleId=coc7e", otherGmToken);
		expect(other.items.map((item) => item.name)).toEqual(["别人的人物"]);

		for (const path of [
			`/api/v1/gm/characters/${ids.irene}`,
			`/api/v1/gm/characters/${ids.irene}/history`,
			`/api/v1/gm/characters/${ids.irene}/sheet-context`,
			`/api/v1/gm/characters/${ids.plLinked}`,
		]) {
			expect((await api(path, { token: otherGmToken })).status).toBe(404);
		}
		const del = await api(`/api/v1/gm/characters/${ids.irene}`, {
			method: "DELETE",
			token: otherGmToken,
		});
		expect(del.status).toBeGreaterThanOrEqual(403);
		const [row] = await ctx.container.db
			.select({ deletedAt: characters.deletedAt })
			.from(characters)
			.where(eq(characters.id, ids.irene));
		expect(row?.deletedAt).toBeNull();

		expect((await link(otherGmToken, otherGmModuleId, ids.irene)).status).toBe(
			404,
		);
		expect(
			(
				await api(`/api/v1/gm/modules/${fogModuleId}/characters`, {
					token: otherGmToken,
				})
			).status,
		).toBe(404);
	});

	test("GM 可只读访问关联到本人模组的玩家人物，但不能删除；无关联的玩家人物不可见", async () => {
		const detail = await api(`/api/v1/gm/characters/${ids.plLinked}`, {
			token: ctx.gmToken,
		});
		expect(detail.status).toBe(200);
		const del = await api(`/api/v1/gm/characters/${ids.plLinked}`, {
			method: "DELETE",
			token: ctx.gmToken,
		});
		expect(del.status).toBeGreaterThanOrEqual(403);

		expect(
			(
				await api(`/api/v1/gm/characters/${ids.plUnlinked}`, {
					token: ctx.gmToken,
				})
			).status,
		).toBe(404);
		expect((await link(ctx.gmToken, fogModuleId, ids.plUnlinked)).status).toBe(
			404,
		);
		// 已有关系的玩家人物可以再关联到本人的其他同规则模组
		expect((await link(ctx.gmToken, fogModuleId, ids.plLinked)).status).toBe(
			200,
		);
	});

	test("经团提交链接审核通过的玩家人物未关联模组时也出现在 GM 人物库，且仍对其他 GM 隔离", async () => {
		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				moduleId: fogModuleId,
				name: "团邀请测试",
				characterIds: [],
				status: "preparing",
			}),
		});
		expect(sessionRes.status).toBe(200);
		const { session } = await json<{ session: { id: string } }>(sessionRes);

		const inviteRes = await api("/api/v1/gm/invites", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ scope: "session", targetId: session.id }),
		});
		expect(inviteRes.status).toBe(200);
		const invite = await json<{ token: string }>(inviteRes);

		const submitRes = await api(
			`/api/v1/pl/invites/${invite.token}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({
					mode: "new",
					name: "团内审核调查员",
					background: "应邀赴约的记者",
				}),
			},
		);
		expect(submitRes.status).toBe(200);
		const { reviewId, characterId } = await json<{
			reviewId: string;
			characterId: string;
		}>(submitRes);

		// 审核前未进入人物库
		const before = await library("ruleId=coc7e&ownerKind=pl");
		expect(before.items.some((item) => item.id === characterId)).toBe(false);

		const decideRes = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decideRes.status).toBe(200);

		const after = await library("ruleId=coc7e&ownerKind=pl");
		const entry = after.items.find((item) => item.id === characterId);
		expect(entry).toBeDefined();
		expect(entry?.name).toBe("团内审核调查员");
		expect(entry?.ownedByMe).toBe(false);
		expect(entry?.ownerName).toBe("library-pl");
		expect(entry?.modules).toEqual([]);

		const unlinked = await library("ruleId=coc7e&moduleId=none");
		expect(unlinked.items.some((item) => item.id === characterId)).toBe(true);

		expect(
			(
				await api(`/api/v1/gm/characters/${characterId}`, {
					token: ctx.gmToken,
				})
			).status,
		).toBe(200);
		expect(
			(
				await api(`/api/v1/gm/characters/${characterId}`, {
					token: otherGmToken,
				})
			).status,
		).toBe(404);
		const other = await library("ruleId=coc7e", otherGmToken);
		expect(other.items.some((item) => item.id === characterId)).toBe(false);
	});
});
