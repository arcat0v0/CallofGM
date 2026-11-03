import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { sessionCharacters, sessionOutbox } from "@/platform/db/schema";
import type { TestServer } from "../helpers/setup";
import {
	closeWs,
	connectWs,
	listenTestApp,
	ScriptedRandomSource,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	type TestContext,
	type TestWebSocket,
} from "../helpers/setup";

describe("Hidden check confidentiality", () => {
	let ctx: TestContext;
	let server: TestServer;
	const random = new ScriptedRandomSource([]);
	const wsUrl = () =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

	beforeAll(async () => {
		ctx = await setupTestApp({
			randomSource: random,
			players: ["pc1", "pc2"],
			characters: [
				{
					id: "char-pc1",
					name: "调查员一号",
					kind: "pc",
					sheet: {
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
						skills: { 侦查: 60, 聆听: 40 },
					},
				},
				{ id: "char-pc2", name: "调查员二号", kind: "pc" },
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
				{ player: "pc2", role: "pc", characterId: "char-pc2" },
			],
		});
		server = listenTestApp(ctx.app);
		await setSessionPhase(ctx, "free_performance");
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	async function openAll() {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc1.waitFor((m) => m.type === "snapshot"),
			pc2.waitFor((m) => m.type === "snapshot"),
		]);
		return { gm, pc1, pc2 };
	}

	async function closeAll(...sockets: TestWebSocket[]) {
		for (const ws of sockets) {
			await closeWs(ws);
		}
	}

	async function outboxFor(type: string) {
		const rows = await ctx.container.db
			.select()
			.from(sessionOutbox)
			.where(
				and(
					eq(sessionOutbox.sessionId, ctx.sessionId),
					eq(sessionOutbox.type, type),
				),
			);
		return rows.map((row) => ({
			eventId: row.eventId,
			type: row.type,
			visibility: JSON.parse(row.visibilityJson) as { type: string },
			payload: JSON.parse(row.payloadJson) as {
				characterId?: string;
				state?: { growthMarks?: string[]; hiddenGrowthMarks?: string[] };
			},
		}));
	}

	test("hidden check growth mark is persisted but never broadcast publicly", async () => {
		const { gm, pc1, pc2 } = await openAll();
		const before = await outboxFor("state:changed");

		sendCommand(
			gm,
			"check:request",
			{ characterId: "char-pc1", skillKey: "聆听", hidden: true },
			"hf-1",
		);
		const requested = await pc1.waitFor(
			(m) => m.type === "check:requested" && m.payload.request.hidden === true,
		);

		random.push(0, 1);
		sendCommand(
			pc1,
			"check:respond",
			{ requestId: requested.payload.request.id },
			"hf-2",
		);
		await pc1.waitFor(
			(m) => m.commandId === "hf-2" && m.type === "command:accepted",
		);

		await gm.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(pc1.messages.some((m) => m.type === "state:changed")).toBe(false);
		expect(pc2.messages.some((m) => m.type === "state:changed")).toBe(false);

		const after = await outboxFor("state:changed");
		const added = after.filter(
			(row) => !before.some((prev) => prev.eventId === row.eventId),
		);
		expect(added.length).toBe(1);
		expect(added[0]?.visibility.type).toBe("gmOnly");
		expect(added[0]?.payload.state?.growthMarks).toEqual([]);
		expect(added[0]?.payload.state?.hiddenGrowthMarks).toContain("聆听");

		const stored = await ctx.container.db
			.select()
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-pc1"),
				),
			);
		expect(JSON.parse(stored[0]!.stateJson).hiddenGrowthMarks).toContain(
			"聆听",
		);

		await closeAll(gm, pc1, pc2);
	});

	test("non-hidden check growth mark stays public", async () => {
		const { gm, pc1, pc2 } = await openAll();
		const before = await outboxFor("state:changed");

		random.push(0, 1);
		sendCommand(
			pc1,
			"check:perform",
			{ characterId: "char-pc1", skillKey: "侦查" },
			"nf-1",
		);
		await gm.waitFor(
			(m) =>
				m.type === "check:resolved" && m.payload.characterId === "char-pc1",
		);
		await pc2.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);

		const after = await outboxFor("state:changed");
		const added = after.filter(
			(row) => !before.some((prev) => prev.eventId === row.eventId),
		);
		expect(added.length).toBe(1);
		expect(added[0]?.visibility.type).toBe("public");
		expect(added[0]?.payload.state?.growthMarks).toContain("侦查");

		await closeAll(gm, pc1, pc2);
	});

	test("hidden SAN check state change is GM-only while a visible SAN check broadcasts", async () => {
		const { gm, pc1, pc2 } = await openAll();
		const before = await outboxFor("state:changed");

		sendCommand(
			gm,
			"check:san",
			{ characterId: "char-pc1", sanLossExpression: "1/1d6", hidden: true },
			"san-h-1",
		);
		await gm.waitFor(
			(m) =>
				m.type === "check:resolved" &&
				m.payload.skillKey === "san" &&
				m.payload.hidden === true,
		);
		await gm.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);

		const afterHidden = await outboxFor("state:changed");
		const hiddenRows = afterHidden.filter(
			(row) => !before.some((prev) => prev.eventId === row.eventId),
		);
		expect(hiddenRows.length).toBe(1);
		expect(hiddenRows[0]?.visibility.type).toBe("gmOnly");
		expect(
			pc1.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-pc1",
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-pc1",
			),
		).toBe(false);

		sendCommand(
			gm,
			"check:san",
			{ characterId: "char-pc1", sanLossExpression: "1/1d6" },
			"san-v-1",
		);
		await pc2.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		const afterVisible = await outboxFor("state:changed");
		const visibleRow = afterVisible.find(
			(row) => !afterHidden.some((prev) => prev.eventId === row.eventId),
		);
		expect(visibleRow?.visibility.type).toBe("public");

		await closeAll(gm, pc1, pc2);
	});

	test("player snapshot does not reveal growth marks from hidden checks it cannot see", async () => {
		const pc2Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
		const snapshot = await pc2Again.waitFor((m) => m.type === "snapshot");
		const target = snapshot.payload.characters.find(
			(c: { characterId: string }) => c.characterId === "char-pc1",
		);
		expect(target.state).not.toBeNull();
		expect(target.state.growthMarks).not.toContain("聆听");
		await closeWs(pc2Again);
	});
});
