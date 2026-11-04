import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import { characters, moduleCharacters } from "@/platform/db/schema";
import {
	listenTestApp,
	setupTestApp,
	stopServer,
	type TestContext,
} from "../helpers/setup";

const testSheet = {
	attributes: {
		str: 50,
		con: 60,
		siz: 70,
		dex: 50,
		app: 50,
		int: 60,
		pow: 60,
		edu: 50,
		luck: 50,
	},
	skills: { 侦查: 60 },
};

describe("Session NPC management", () => {
	let ctx: TestContext;
	let server: ReturnType<TestContext["app"]["listen"]>;

	beforeAll(async () => {
		ctx = await setupTestApp({
			players: ["pc1"],
			characters: [
				{ id: "char-pc1", name: "调查员一号", kind: "pc" },
				{ id: "char-npc1", name: "馆长", kind: "npc" },
			],
			claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
		});
		server = listenTestApp(ctx.app);

		const now = Date.now();
		for (const character of [
			{ id: "char-npc2", name: "守塔人", kind: "npc" },
			{ id: "char-pc2", name: "未入团调查员", kind: "pc" },
		]) {
			await ctx.container.db.insert(characters).values({
				id: character.id,
				ownerId: ctx.gmUserId,
				ownerKind: "gm",
				name: character.name,
				background: "",
				kind: character.kind,
				ruleId: "coc7e",
				sheetJson: JSON.stringify(testSheet),
				sheetVersion: 1,
				profileVersion: 1,
				version: 1,
				originType: null,
				originRefId: null,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			});
		}
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	function request(
		path: string,
		init: { method: string; token?: string; body?: unknown },
	) {
		return ctx.app.handle(
			new Request(`http://localhost${path}`, {
				method: init.method,
				headers: {
					Authorization: `Bearer ${init.token ?? ctx.gmToken}`,
					"Content-Type": "application/json",
				},
				...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
			}),
		);
	}

	async function sessionCharacterIds(): Promise<string[]> {
		const response = await request(`/api/v1/gm/sessions/${ctx.sessionId}`, {
			method: "GET",
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			characters: Array<{ characterId: string }>;
		};
		return body.characters.map((character) => character.characterId);
	}

	test("从 NPC 库添加到团内并自动关联模组", async () => {
		const response = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs`,
			{ method: "POST", body: { characterId: "char-npc2" } },
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			characterId: string;
			name: string;
			alreadyInSession: boolean;
		};
		expect(body).toEqual({
			characterId: "char-npc2",
			name: "守塔人",
			alreadyInSession: false,
		});

		const links = await ctx.container.db
			.select({ id: moduleCharacters.id })
			.from(moduleCharacters)
			.where(
				and(
					eq(moduleCharacters.moduleId, ctx.moduleId),
					eq(moduleCharacters.characterId, "char-npc2"),
					isNull(moduleCharacters.deletedAt),
				),
			);
		expect(links.length).toBe(1);

		expect(await sessionCharacterIds()).toContain("char-npc2");
	});

	test("重复添加保持幂等，非 NPC 与不存在人物被拒", async () => {
		const again = await request(`/api/v1/gm/sessions/${ctx.sessionId}/npcs`, {
			method: "POST",
			body: { characterId: "char-npc2" },
		});
		expect(again.status).toBe(200);
		expect(
			((await again.json()) as { alreadyInSession: boolean }).alreadyInSession,
		).toBe(true);

		const pcResponse = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs`,
			{ method: "POST", body: { characterId: "char-pc2" } },
		);
		expect(pcResponse.status).toBe(400);
		expect(((await pcResponse.json()) as { code: string }).code).toBe(
			"CHARACTER_NOT_NPC",
		);

		const missing = await request(`/api/v1/gm/sessions/${ctx.sessionId}/npcs`, {
			method: "POST",
			body: { characterId: "char-missing" },
		});
		expect(missing.status).toBe(404);
	});

	test("移出本团后可重新添加；再次移出返回 removed=false", async () => {
		const removed = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs/char-npc2`,
			{ method: "DELETE" },
		);
		expect(removed.status).toBe(200);
		expect(((await removed.json()) as { removed: boolean }).removed).toBe(true);
		expect(await sessionCharacterIds()).not.toContain("char-npc2");

		const removedAgain = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs/char-npc2`,
			{ method: "DELETE" },
		);
		expect(((await removedAgain.json()) as { removed: boolean }).removed).toBe(
			false,
		);

		const readded = await request(`/api/v1/gm/sessions/${ctx.sessionId}/npcs`, {
			method: "POST",
			body: { characterId: "char-npc2" },
		});
		expect(
			((await readded.json()) as { alreadyInSession: boolean })
				.alreadyInSession,
		).toBe(false);
		expect(await sessionCharacterIds()).toContain("char-npc2");
	});

	test("仅主持人可管理团内 NPC", async () => {
		const response = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs`,
			{
				method: "POST",
				token: ctx.plTokens.get("pc1"),
				body: { characterId: "char-npc1" },
			},
		);
		expect(response.status).toBe(403);
	});

	test("已结团不可添加 NPC", async () => {
		for (const status of ["preparing", "active", "ended"]) {
			const response = await request(
				`/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{ method: "POST", body: { status } },
			);
			expect(response.status).toBe(200);
		}
		const response = await request(
			`/api/v1/gm/sessions/${ctx.sessionId}/npcs`,
			{ method: "POST", body: { characterId: "char-npc1" } },
		);
		expect(response.status).toBe(400);
		expect(((await response.json()) as { code: string }).code).toBe(
			"SESSION_STATE_INVALID",
		);
	});
});
