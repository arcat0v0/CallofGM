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
	publicState?: unknown;
	publicStateFields?: string[];
};

describe("NPC state visibility contract tests", () => {
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
			players: ["pc1", "ob1"],
			characters: [
				{ id: "char-pc1", name: "调查员一号", kind: "pc", sheet: defaultSheet },
				{ id: "char-npc1", name: "礼帽男子", kind: "npc", sheet: defaultSheet },
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
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

	async function snapshotFor(name: "gm" | "pc1" | "ob1") {
		const token = name === "gm" ? ctx.gmToken : playerToken(name);
		const ws = await connectWs(wsUrl(), token);
		const snapshot = await ws.waitFor((m) => m.type === "snapshot");
		await closeWs(ws);
		return snapshot.payload as { characters: SnapshotCharacter[] };
	}

	function playerToken(name: "pc1" | "ob1") {
		const token = ctx.playerTokens.get(name);
		if (!token) {
			throw new Error(`Missing player token: ${name}`);
		}
		return token;
	}

	function charOf(
		snapshot: { characters: SnapshotCharacter[] },
		characterId: string,
	) {
		const found = snapshot.characters.find(
			(character) => character.characterId === characterId,
		);
		if (!found) {
			throw new Error(`Missing character: ${characterId}`);
		}
		return found;
	}

	async function configureNpc(
		gm: TestWebSocket,
		fields: string[],
		commandId: string,
	) {
		sendCommand(
			gm,
			"npc:state-visibility",
			{ characterId: "char-npc1", fields },
			commandId,
		);
		const accepted = await gm.waitFor(
			(m) => m.commandId === commandId && m.type === "command:accepted",
		);
		return accepted;
	}

	test("默认时 NPC 状态仅 GM 可见", async () => {
		const gmSnapshot = await snapshotFor("gm");
		const gmNpc = charOf(gmSnapshot, "char-npc1");
		expect(gmNpc.state).not.toBeNull();
		expect(gmNpc.publicState).toBeNull();
		expect(gmNpc.publicStateFields).toEqual([]);

		for (const viewer of ["pc1", "ob1"] as const) {
			const snapshot = await snapshotFor(viewer);
			expect(charOf(snapshot, "char-npc1").state).toBeNull();
		}
	});

	test("公开 HP 与 SAN 后玩家只收到所选字段，GM 保持完整状态", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), playerToken("pc1"));
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
		]);

		const commandId = "visibility-hp-san";
		await configureNpc(gm, ["hp", "san"], commandId);
		const configured = await gm.waitFor(
			(m) =>
				m.type === "npc:state-visibility-changed" && m.commandId === undefined,
		);
		expect(configured.payload.publicStateFields).toEqual(["hp", "san"]);

		const publicEvent = await pc.waitFor(
			(m) => m.type === "state:public-changed",
		);
		expect(publicEvent.payload.characterId).toBe("char-npc1");
		expect(publicEvent.payload.state).toEqual({
			hp: expect.any(Number),
			maxHp: expect.any(Number),
			san: expect.any(Number),
			maxSan: expect.any(Number),
		});
		expect(Object.keys(publicEvent.payload.state).sort()).toEqual([
			"hp",
			"maxHp",
			"maxSan",
			"san",
		]);

		const pcSnapshot = await snapshotFor("pc1");
		const pcNpc = charOf(pcSnapshot, "char-npc1");
		expect(Object.keys(pcNpc.state as Record<string, unknown>).sort()).toEqual([
			"hp",
			"maxHp",
			"maxSan",
			"san",
		]);
		expect(pcNpc.publicState).toBeUndefined();
		expect(pcNpc.publicStateFields).toBeUndefined();

		const gmSnapshot = await snapshotFor("gm");
		const gmNpc = charOf(gmSnapshot, "char-npc1");
		expect((gmNpc.state as Record<string, unknown>).mp).toEqual(
			expect.any(Number),
		);
		expect(gmNpc.publicStateFields).toEqual(["hp", "san"]);
		expect(
			Object.keys(gmNpc.publicState as Record<string, unknown>).sort(),
		).toEqual(["hp", "maxHp", "maxSan", "san"]);

		await closeWs(gm);
		await closeWs(pc);
	});

	test("NPC 状态变更分别投递完整视图与公开投影", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), playerToken("pc1"));
		const ob = await connectWs(wsUrl(), playerToken("ob1"));
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
			ob.waitFor((m) => m.type === "snapshot"),
		]);

		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-npc1", hpDelta: -3 },
			"npc-state-edit",
		);
		const gmEvent = await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-npc1" &&
				m.payload.publicStateFields?.includes("hp"),
		);
		expect(gmEvent.payload.publicState).toEqual({
			hp: gmEvent.payload.state.hp,
			maxHp: gmEvent.payload.state.maxHp,
			san: gmEvent.payload.state.san,
			maxSan: gmEvent.payload.state.maxSan,
		});
		expect(gmEvent.payload.state.tags).toEqual([]);
		expect(gmEvent.payload.state.growthMarks).toEqual([]);

		const pcEvent = await pc.waitFor(
			(m) =>
				m.type === "state:public-changed" &&
				m.eventId > gmEvent.eventId &&
				m.payload.characterId === "char-npc1",
		);
		expect(pcEvent.payload.state).toEqual(gmEvent.payload.publicState);
		const obEvent = await ob.waitFor(
			(m) =>
				m.type === "state:public-changed" &&
				m.eventId === pcEvent.eventId &&
				m.payload.characterId === "char-npc1",
		);
		expect(obEvent.payload.state).toEqual(pcEvent.payload.state);
		expect(
			gm.messages.some(
				(m) =>
					m.type === "state:public-changed" && m.eventId === pcEvent.eventId,
			),
		).toBe(false);

		await closeWs(gm);
		await closeWs(pc);
		await closeWs(ob);
	});

	test("断线补发保持公开投影裁剪", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), playerToken("pc1"));
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
		]);

		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-npc1", hpDelta: -1 },
			"replay-state-edit",
		);
		const publicEvent = await pc.waitFor(
			(m) =>
				m.type === "state:public-changed" &&
				m.payload.characterId === "char-npc1" &&
				m.payload.state.hp < 10,
		);
		await closeWs(pc);

		const replay = await connectWs(
			wsUrl(publicEvent.eventId - 1),
			playerToken("pc1"),
		);
		const replayed = await replay.waitFor(
			(m) =>
				m.type === "state:public-changed" && m.eventId === publicEvent.eventId,
		);
		expect(replayed.payload.state).toEqual(publicEvent.payload.state);
		await closeWs(replay);
		await closeWs(gm);
	});

	test("非法字段与非 GM 配置被拒绝", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), playerToken("pc1"));
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
		]);

		sendCommand(
			gm,
			"npc:state-visibility",
			{ characterId: "char-npc1", fields: ["tags"] },
			"invalid-public-field",
		);
		const invalid = await gm.waitFor(
			(m) => m.commandId === "invalid-public-field",
		);
		expect(invalid.type).toBe("command:rejected");

		sendCommand(
			gm,
			"npc:state-visibility",
			{ characterId: "char-pc1", fields: ["hp"] },
			"visibility-for-pc",
		);
		const pcTarget = await gm.waitFor(
			(m) => m.commandId === "visibility-for-pc",
		);
		expect(pcTarget.type).toBe("command:rejected");

		sendCommand(
			pc,
			"npc:state-visibility",
			{ characterId: "char-npc1", fields: [] },
			"visibility-by-player",
		);
		const rejected = await pc.waitFor(
			(m) => m.commandId === "visibility-by-player",
		);
		expect(rejected.type).toBe("command:rejected");

		const pcSnapshot = await snapshotFor("pc1");
		expect(
			Object.keys(
				charOf(pcSnapshot, "char-npc1").state as Record<string, unknown>,
			),
		).toContain("hp");

		await closeWs(gm);
		await closeWs(pc);
	});

	test("全部取消公开后玩家立即收到 null", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), playerToken("pc1"));
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
		]);

		await configureNpc(gm, [], "visibility-none");
		const cleared = await pc.waitFor(
			(m) =>
				m.type === "state:public-changed" &&
				m.payload.characterId === "char-npc1" &&
				m.payload.state === null,
		);
		expect(cleared.payload.state).toBeNull();

		const pcSnapshot = await snapshotFor("pc1");
		expect(charOf(pcSnapshot, "char-npc1").state).toBeNull();
		const gmSnapshot = await snapshotFor("gm");
		expect(charOf(gmSnapshot, "char-npc1").state).not.toBeNull();
		expect(charOf(gmSnapshot, "char-npc1").publicState).toBeNull();

		await closeWs(gm);
		await closeWs(pc);
	});

	test("已结团后拒绝修改公开配置", async () => {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		await gm.waitFor((m) => m.type === "snapshot");

		const endResponse = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ctx.gmToken}`,
					},
					body: JSON.stringify({ status: "ended" }),
				},
			),
		);
		expect(endResponse.status).toBe(200);

		sendCommand(
			gm,
			"npc:state-visibility",
			{ characterId: "char-npc1", fields: ["hp"] },
			"visibility-after-end",
		);
		const rejected = await gm.waitFor(
			(m) => m.commandId === "visibility-after-end",
		);
		expect(rejected.type).toBe("command:rejected");
		await closeWs(gm);
	});
});
