import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	closeWs,
	connectWs,
	listenTestApp,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
	type TestWebSocket,
} from "../helpers/setup";

type SnapshotCharacter = {
	characterId: string;
	kind: string;
	state: unknown;
	sheet: unknown;
};

describe("Session visibility settings contract tests", () => {
	let ctx: TestContext;
	let server: TestServer;
	const wsUrl = (lastEventId?: number) =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws${
			lastEventId === undefined ? "" : `?lastEventId=${lastEventId}`
		}`;

	const defaultSheet = {
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
		skills: { 侦查: 60, 图书馆: 45 },
	};

	beforeAll(async () => {
		ctx = await setupTestApp({
			players: ["pc1", "pc2", "ob1"],
			characters: [
				{
					id: "char-pc1",
					name: "调查员一号",
					kind: "pc",
					sheet: {
						...defaultSheet,
						weapons: [
							{
								name: "私人手枪",
								skillKey: "射击(手枪)",
								damage: "1d10",
							},
						],
						assets: {
							currency: "$",
							spendingLevel: 10,
							cash: 500,
							otherAssets: 2000,
							details: [
								{ category: "residence", name: "秘密公寓", value: 2000 },
							],
						},
						spells: [
							{
								name: "秘密法术",
								mpCost: "1",
								sanCost: "1",
								castingTime: "1 轮",
								effect: "不可公开",
							},
						],
					},
				},
				{ id: "char-pc2", name: "调查员二号", kind: "pc" },
				{ id: "char-npc1", name: "守塔人", kind: "npc" },
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
				{ player: "pc2", role: "pc", characterId: "char-pc2" },
				{ player: "ob1", role: "ob" },
			],
		});
		server = listenTestApp(ctx.app);
		await setSessionPhase(ctx, "free_discussion");
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	async function openAll() {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
		const ob = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc1.waitFor((m) => m.type === "snapshot"),
			pc2.waitFor((m) => m.type === "snapshot"),
			ob.waitFor((m) => m.type === "snapshot"),
		]);
		return { gm, pc1, pc2, ob };
	}

	async function closeAll(...sockets: TestWebSocket[]) {
		for (const ws of sockets) {
			await closeWs(ws);
		}
	}

	async function snapshotFor(name: "gm" | "pc1" | "pc2" | "ob1") {
		const ws = await connectWs(
			wsUrl(),
			name === "gm" ? ctx.gmToken : ctx.playerTokens.get(name)!,
		);
		const snapshot = await ws.waitFor((m) => m.type === "snapshot");
		await closeWs(ws);
		return snapshot.payload as { characters: SnapshotCharacter[] };
	}

	function charOf(
		snapshot: { characters: SnapshotCharacter[] },
		characterId: string,
	) {
		const found = snapshot.characters.find(
			(character) => character.characterId === characterId,
		);
		expect(found).toBeDefined();
		return found!;
	}

	async function applySettings(
		gm: TestWebSocket,
		settings: { sharePcSheets: boolean; obSeePcState: boolean },
	) {
		const commandId = `settings-${Math.random().toString(16).slice(2)}`;
		sendCommand(gm, "session:settings", settings, commandId);
		await gm.waitFor(
			(m) => m.commandId === commandId && m.type === "command:accepted",
		);
		return gm.waitFor(
			(m) =>
				m.type === "session:settings-changed" &&
				m.payload.sharePcSheets === settings.sharePcSheets &&
				m.payload.obSeePcState === settings.obSeePcState,
		);
	}

	test("F21 默认开启：参与者可见全部 PC 人物卡，NPC 人物卡仅 GM 可见", async () => {
		const gmSnapshot = await snapshotFor("gm");
		expect(charOf(gmSnapshot, "char-pc1").sheet).not.toBeNull();
		expect(charOf(gmSnapshot, "char-pc2").sheet).not.toBeNull();
		expect(charOf(gmSnapshot, "char-npc1").sheet).not.toBeNull();

		for (const viewer of ["pc1", "pc2", "ob1"] as const) {
			const snapshot = await snapshotFor(viewer);
			const pc1Sheet = charOf(snapshot, "char-pc1").sheet as {
				attributes: Record<string, number>;
				skills: Record<string, number>;
			} | null;
			expect(pc1Sheet).not.toBeNull();
			expect(pc1Sheet!.skills["侦查"]).toBe(60);
			expect(charOf(snapshot, "char-pc2").sheet).not.toBeNull();
			expect(charOf(snapshot, "char-npc1").sheet).toBeNull();
		}
	});

	test("队友只收到公开投影；本人与 GM 收到完整武器、资产和法术", async () => {
		const teammate = await snapshotFor("pc2");
		const publicSheet = charOf(teammate, "char-pc1").sheet as {
			attributes: Record<string, number>;
			skills: Record<string, number>;
			weapons: unknown[];
			assets: { cash: number; details: unknown[] };
			spells: unknown[];
		};
		expect(publicSheet.attributes.str).toBe(50);
		expect(publicSheet.skills["侦查"]).toBe(60);
		expect(publicSheet.weapons).toEqual([]);
		expect(publicSheet.assets.cash).toBe(0);
		expect(publicSheet.assets.details).toEqual([]);
		expect(publicSheet.spells).toEqual([]);

		const own = await snapshotFor("pc1");
		const ownSheet = charOf(own, "char-pc1").sheet as {
			weapons: Array<{ name: string }>;
			assets: { cash: number };
			spells: Array<{ name: string }>;
		};
		expect(ownSheet.weapons[0]?.name).toBe("私人手枪");
		expect(ownSheet.assets.cash).toBe(500);
		expect(ownSheet.spells[0]?.name).toBe("秘密法术");

		const gm = await snapshotFor("gm");
		const gmSheet = charOf(gm, "char-pc1").sheet as {
			weapons: Array<{ name: string }>;
			assets: { details: Array<{ name: string }> };
		};
		expect(gmSheet.weapons[0]?.name).toBe("私人手枪");
		expect(gmSheet.assets.details[0]?.name).toBe("秘密公寓");
	});

	test("F21 关闭：玩家只看到自己认领 PC 的人物卡，OB 无人物卡，GM 全量", async () => {
		const { gm, pc1, ob } = await openAll();

		const changed = await applySettings(gm, {
			sharePcSheets: false,
			obSeePcState: true,
		});
		expect(changed.payload.sharePcSheets).toBe(false);
		await pc1.waitFor(
			(m) =>
				m.type === "session:settings-changed" &&
				m.payload.sharePcSheets === false,
		);
		await ob.waitFor(
			(m) =>
				m.type === "session:settings-changed" &&
				m.payload.sharePcSheets === false,
		);

		sendCommand(
			pc1,
			"session:settings",
			{ sharePcSheets: true, obSeePcState: true },
			"settings-by-player",
		);
		const rejected = await pc1.waitFor(
			(m) => m.commandId === "settings-by-player",
		);
		expect(rejected.type).toBe("command:rejected");

		const pc1Snapshot = await snapshotFor("pc1");
		expect(charOf(pc1Snapshot, "char-pc1").sheet).not.toBeNull();
		expect(charOf(pc1Snapshot, "char-pc2").sheet).toBeNull();
		expect(charOf(pc1Snapshot, "char-npc1").sheet).toBeNull();

		const pc2Snapshot = await snapshotFor("pc2");
		expect(charOf(pc2Snapshot, "char-pc1").sheet).toBeNull();
		expect(charOf(pc2Snapshot, "char-pc2").sheet).not.toBeNull();

		const obSnapshot = await snapshotFor("ob1");
		expect(charOf(obSnapshot, "char-pc1").sheet).toBeNull();
		expect(charOf(obSnapshot, "char-pc2").sheet).toBeNull();
		expect(charOf(obSnapshot, "char-npc1").sheet).toBeNull();

		const gmSnapshot = await snapshotFor("gm");
		expect(charOf(gmSnapshot, "char-pc1").sheet).not.toBeNull();
		expect(charOf(gmSnapshot, "char-npc1").sheet).not.toBeNull();

		await applySettings(gm, { sharePcSheets: true, obSeePcState: true });
		await closeAll(gm, pc1, ob);
	});

	test("F82 默认开启：OB 仍收到 PC 状态变更（保持现有行为）", async () => {
		const { gm, pc1, ob } = await openAll();
		await applySettings(gm, { sharePcSheets: true, obSeePcState: true });

		const obSnapshot = await snapshotFor("ob1");
		expect(charOf(obSnapshot, "char-pc1").state).not.toBeNull();
		expect(charOf(obSnapshot, "char-npc1").state).toBeNull();

		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-pc1", hpDelta: -1 },
			"state-on",
		);
		const obEvent = await ob.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(obEvent.payload.state).not.toBeNull();
		await pc1.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);

		await closeAll(gm, pc1, ob);
	});

	test("F82 关闭：OB 不再收到 PC state:changed，玩家与 GM 仍收到；快照 PC 状态为 null", async () => {
		const { gm, pc1, pc2, ob } = await openAll();
		await applySettings(gm, { sharePcSheets: true, obSeePcState: false });
		await ob.waitFor(
			(m) =>
				m.type === "session:settings-changed" &&
				m.payload.obSeePcState === false,
		);

		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-pc1", hpDelta: -2 },
			"state-off",
		);
		const gmEvent = await gm.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(gmEvent.payload.state).not.toBeNull();
		const playerEvent = await pc2.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(playerEvent.payload.state).not.toBeNull();
		await pc1.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);

		sendCommand(gm, "dice:roll", { expression: "1d100" }, "fence-roll");
		const fenceEvent = await ob.waitFor((m) => m.type === "dice:rolled");
		expect(fenceEvent.eventId).toBeGreaterThan(gmEvent.eventId);
		expect(
			ob.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-pc1",
			),
		).toBe(false);

		const obSnapshot = await snapshotFor("ob1");
		expect(charOf(obSnapshot, "char-pc1").state).toBeNull();
		expect(charOf(obSnapshot, "char-pc2").state).toBeNull();
		expect(charOf(obSnapshot, "char-npc1").state).toBeNull();

		const pc1Snapshot = await snapshotFor("pc1");
		expect(charOf(pc1Snapshot, "char-pc1").state).not.toBeNull();
		expect(charOf(pc1Snapshot, "char-pc2").state).not.toBeNull();
		expect(charOf(pc1Snapshot, "char-npc1").state).toBeNull();

		const gmSnapshot = await snapshotFor("gm");
		expect(charOf(gmSnapshot, "char-npc1").state).not.toBeNull();

		const obReplay = await connectWs(
			wsUrl(gmEvent.eventId - 1),
			ctx.playerTokens.get("ob1")!,
		);
		await obReplay.waitFor((m) => m.eventId === fenceEvent.eventId);
		expect(obReplay.messages.some((m) => m.eventId === gmEvent.eventId)).toBe(
			false,
		);
		await closeWs(obReplay);

		await applySettings(gm, { sharePcSheets: true, obSeePcState: true });
		await closeAll(gm, pc1, pc2, ob);
	});
});
