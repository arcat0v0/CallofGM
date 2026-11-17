import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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

describe("Session rule settings contract tests", () => {
	let ctx: TestContext;
	let server: ReturnType<TestContext["app"]["listen"]>;
	const random = new ScriptedRandomSource([]);
	const wsUrl = () =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

	beforeAll(async () => {
		ctx = await setupTestApp({
			randomSource: random,
			players: ["pc1"],
			characters: [
				{
					id: "char-pc1",
					name: "规则调查员",
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
						skills: { 侦查: 60 },
					},
				},
			],
			claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
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
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc1.waitFor((m) => m.type === "snapshot"),
		]);
		return { gm, pc1 };
	}

	async function updateSettings(
		gm: TestWebSocket,
		settings: Record<string, unknown>,
		commandId: string,
		predicate: (payload: Record<string, any>) => boolean,
	) {
		sendCommand(gm, "session:settings", settings, commandId);
		await gm.waitFor(
			(m) => m.commandId === commandId && m.type === "command:accepted",
		);
		return gm.waitFor(
			(m) =>
				m.type === "session:settings-changed" &&
				predicate(m.payload as Record<string, any>),
		);
	}

	test("persists rule settings, preserves them on partial updates, and blocks luck spending", async () => {
		const { gm, pc1 } = await openAll();

		const changed = await updateSettings(
			gm,
			{
				ruleSettings: {
					coc7e: {
						allowLuckSpend: false,
						criticalVariant: "flat5",
					},
				},
			},
			"rules-off",
			(payload) =>
				payload.ruleSettings?.coc7e?.criticalVariant === "flat5",
		);
		expect(changed.payload.ruleSettings.coc7e).toMatchObject({
			allowLuckSpend: false,
			criticalVariant: "flat5",
		});

		const partial = await updateSettings(
			gm,
			{ sharePcSheets: false },
			"visibility-only",
			(payload) => payload.sharePcSheets === false,
		);
		expect(partial.payload.sharePcSheets).toBe(false);
		expect(partial.payload.ruleSettings.coc7e).toMatchObject({
			allowLuckSpend: false,
			criticalVariant: "flat5",
		});

		sendCommand(
			gm,
			"session:settings",
			{
				ruleSettings: {
					coc7e: { criticalVariant: "not-a-variant" },
				},
			},
			"rules-invalid",
		);
		const invalid = await gm.waitFor(
			(m) => m.commandId === "rules-invalid",
		);
		expect(invalid.type).toBe("command:rejected");
		expect(invalid.payload.code).toBe("VALIDATION_FAILED");

		random.push(3, 6);
		sendCommand(
			pc1,
			"check:perform",
			{ characterId: "char-pc1", skillKey: "侦查" },
			"rules-check",
		);
		const resolved = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.result.roll === 63,
		);

		sendCommand(
			pc1,
			"check:spend-luck",
			{ characterId: "char-pc1", eventId: resolved.eventId, points: 3 },
			"rules-spend",
		);
		const rejected = await pc1.waitFor(
			(m) => m.commandId === "rules-spend",
		);
		expect(rejected.type).toBe("command:rejected");
		expect(rejected.payload.code).toBe("LUCK_SPEND_DISABLED");

		const snapshotSocket = await connectWs(wsUrl(), ctx.gmToken);
		const snapshot = await snapshotSocket.waitFor(
			(m) => m.type === "snapshot",
		);
		expect(snapshot.payload.session.settings.ruleSettings.coc7e).toMatchObject(
			{
				allowLuckSpend: false,
				criticalVariant: "flat5",
			},
		);

		await closeWs(snapshotSocket);
		await closeWs(pc1);
		await closeWs(gm);
	});
});
