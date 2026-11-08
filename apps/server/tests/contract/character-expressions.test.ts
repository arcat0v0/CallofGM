import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { characterPortraits, sessionCharacters } from "@/platform/db/schema";
import {
	closeWs,
	connectWs,
	listenTestApp,
	ScriptedRandomSource,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

let ctx: TestContext;
const random = new ScriptedRandomSource([]);
let server: TestServer;
const wsUrl = () =>
	`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

describe("Custom expressions contract tests", () => {
	beforeAll(async () => {
		ctx = await setupTestApp({
			randomSource: random,
			players: ["pc1"],
			characters: [
				{
					id: "char-exp",
					name: "表情测试",
					kind: "npc",
					portraits: ["default"],
				},
				{
					id: "char-del",
					name: "删除测试",
					kind: "npc",
					portraits: ["default", "angry"],
				},
				{
					id: "char-soft",
					name: "软删测试",
					kind: "pc",
					portraits: ["default", "angry"],
				},
			],
			claims: [{ player: "pc1", role: "pc", characterId: "char-soft" }],
		});
		server = listenTestApp(ctx.app);
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	test("POST portrait without expressionKey auto-generates key, label and sortOrder", async () => {
		random.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/characters/char-exp/portraits", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ctx.gmToken}`,
				},
				body: JSON.stringify({
					label: "举杯",
					portraitAssetId: "asset-placeholder",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			expressionKey: string;
			label: string | null;
			sortOrder: number;
		};
		expect(body.expressionKey).toMatch(/^expr_[0-9a-f]{10}$/);
		expect(body.label).toBe("举杯");
		expect(body.sortOrder).toBe(1);
	});

	test("second POST portrait appends sortOrder and draws a distinct key", async () => {
		random.push(11, 12, 13, 14, 15, 1, 2, 3, 4, 5);
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/characters/char-exp/portraits", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ctx.gmToken}`,
				},
				body: JSON.stringify({
					label: "惊讶",
					portraitAssetId: "asset-placeholder",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			expressionKey: string;
			sortOrder: number;
		};
		expect(body.sortOrder).toBe(2);
		expect(body.expressionKey).not.toBe("expr_0000000000");
	});

	test("auto-key collision retries and returns the next drawn key", async () => {
		await ctx.container.db.insert(characterPortraits).values({
			id: "portrait-collide",
			characterId: "char-exp",
			expressionKey: "expr_0000000000",
			label: null,
			portraitAssetId: "asset-placeholder",
			isDefault: 0,
			sortOrder: 0,
			deletedAt: null,
			createdAt: Date.now(),
		});
		random.push(
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			9,
			10,
			11,
			12,
			13,
			14,
			15,
			1,
			2,
			3,
			4,
			0,
		);
		const res = await ctx.app.handle(
			new Request("http://localhost/api/v1/gm/characters/char-exp/portraits", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ctx.gmToken}`,
				},
				body: JSON.stringify({
					label: "碰撞",
					portraitAssetId: "asset-placeholder",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { expressionKey: string };
		expect(body.expressionKey).toBe("expr_bcdef12340");
	});

	test("snapshot portraits carry label and sortOrder in server order", async () => {
		const ws = await connectWs(wsUrl(), ctx.gmToken);
		const snapshot = await ws.waitFor((m) => m.type === "snapshot");
		const characters = snapshot.payload.characters as Array<{
			characterId: string;
			portraits: Array<{
				expressionKey: string;
				label: string | null;
				sortOrder: number;
			}>;
		}>;
		const char = characters.find((c) => c.characterId === "char-exp");
		expect(char).toBeDefined();
		const portraits = char?.portraits ?? [];
		expect(portraits.length).toBe(5);
		expect(portraits.map((p) => p.sortOrder)).toEqual([0, 0, 1, 2, 3]);
		expect(portraits.map((p) => p.expressionKey)).toEqual([
			"default",
			"expr_0000000000",
			"expr_123456789a",
			"expr_bcdef12345",
			"expr_bcdef12340",
		]);
		expect(portraits[2]?.label).toBe("举杯");
		expect(portraits[1]?.label).toBeNull();
		expect(portraits[0]?.label).toBeNull();
		await closeWs(ws);
	});

	test("deleting current expression resets session character to default", async () => {
		await ctx.container.db
			.update(sessionCharacters)
			.set({ currentExpressionKey: "angry" })
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-del"),
				),
			);
		const res = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/gm/characters/char-del/portraits/portrait-char-del-angry",
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${ctx.gmToken}` },
				},
			),
		);
		expect(res.status).toBe(200);
		const rows = await ctx.container.db
			.select()
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-del"),
				),
			);
		expect(rows[0]?.currentExpressionKey).toBe("default");
	});

	test("deleting the default portrait resets current expression to null", async () => {
		await ctx.container.db
			.update(sessionCharacters)
			.set({ currentExpressionKey: "default" })
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-del"),
				),
			);
		const res = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/gm/characters/char-del/portraits/portrait-char-del-default",
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${ctx.gmToken}` },
				},
			),
		);
		expect(res.status).toBe(200);
		const rows = await ctx.container.db
			.select()
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-del"),
				),
			);
		expect(rows[0]?.currentExpressionKey).toBeNull();
	});

	test("expression:set rejects soft-deleted portrait key", async () => {
		const res = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/gm/characters/char-soft/portraits/portrait-char-soft-angry",
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${ctx.gmToken}` },
				},
			),
		);
		expect(res.status).toBe(200);
		await setSessionPhase(ctx, "performance_time");
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		await gm.waitFor((m) => m.type === "snapshot");
		sendCommand(
			gm,
			"expression:set",
			{ characterId: "char-soft", expressionKey: "angry" },
			"expr-soft-1",
		);
		const reply = await gm.waitFor((m) => m.commandId === "expr-soft-1");
		expect(reply.type).toBe("command:rejected");
		expect(reply.payload.code).toBe("EXPRESSION_NOT_FOUND");
		await closeWs(gm);
	});

	test("chat:send rejects soft-deleted portrait key", async () => {
		const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		await pc1.waitFor((m) => m.type === "snapshot");
		sendCommand(
			pc1,
			"chat:send",
			{ channel: "roleplay", content: "…", expressionKey: "angry" },
			"chat-soft-1",
		);
		const reply = await pc1.waitFor((m) => m.commandId === "chat-soft-1");
		expect(reply.type).toBe("command:rejected");
		expect(reply.payload.code).toBe("EXPRESSION_NOT_FOUND");
		await closeWs(pc1);
	});

	test("PATCH portrait can replace the underlying image asset", async () => {
		const { mediaAssets } = await import("@/platform/db/schema");
		await ctx.container.db
			.insert(mediaAssets)
			.values({
				id: "asset-cropped",
				ownerId: ctx.gmUserId,
				purpose: "portrait",
				storageKey: "test-cropped",
				filename: "cropped.jpg",
				mimeType: "image/jpeg",
				size: 1,
				sha256: "cropped",
				metadataJson: "{}",
				deletedAt: null,
				createdAt: Date.now(),
			})
			.onConflictDoNothing();
		const url =
			"http://localhost/api/v1/gm/characters/char-exp/portraits/portrait-char-exp-default";
		const patch = async (portraitAssetId: string) =>
			ctx.app.handle(
				new Request(url, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ctx.gmToken}`,
					},
					body: JSON.stringify({ portraitAssetId }),
				}),
			);
		const res = await patch("asset-cropped");
		expect(res.status).toBe(200);
		const body = (await res.json()) as { portraitAssetId: string };
		expect(body.portraitAssetId).toBe("asset-cropped");

		const invalid = await patch("asset-missing");
		expect(invalid.status).toBe(400);
	});
});
