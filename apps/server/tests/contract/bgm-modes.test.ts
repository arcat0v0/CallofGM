import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import type { BgmState } from "@cogm/shared";
import { eq } from "drizzle-orm";
import { modules, sessionAudioState, tracks } from "@/platform/db/schema";
import {
	closeWs,
	connectWs,
	listenTestApp,
	ScriptedRandomSource,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
	type TestWebSocket,
} from "../helpers/setup";

describe("BGM modes through real WebSocket and SQLite", () => {
	let context: TestContext;
	let server: TestServer;
	let gm: TestWebSocket;
	let listener: TestWebSocket;
	let state: BgmState;
	const address = () =>
		`ws://localhost:${server.server.port}/api/v1/sessions/${context.sessionId}/ws`;

	beforeAll(async () => {
		context = await setupTestApp({
			players: ["listener"],
			claims: [{ player: "listener", role: "ob" }],
			randomSource: new ScriptedRandomSource([1, 1]),
		});
		await context.container.db.insert(modules).values({
			id: "other-module",
			ownerId: context.gmUserId,
			name: "Other",
			description: "",
			ruleId: "coc7e",
			createdAt: 0,
			updatedAt: 0,
		});
		await context.container.db.insert(tracks).values([
			{
				id: "bgm-a",
				moduleId: context.moduleId,
				name: "雨夜",
				type: "bgm",
				source: "netease",
				externalId: "1001",
				duration: 60_000,
				createdAt: 1,
			},
			{
				id: "bgm-b",
				moduleId: context.moduleId,
				name: "旧宅",
				type: "bgm",
				source: "netease",
				externalId: "1002",
				duration: 60_000,
				createdAt: 2,
			},
			{
				id: "bgm-c",
				moduleId: context.moduleId,
				name: "走廊",
				type: "bgm",
				source: "netease",
				externalId: "1003",
				duration: 60_000,
				createdAt: 3,
			},
			{
				id: "deleted-bgm",
				moduleId: context.moduleId,
				name: "已删除",
				type: "bgm",
				source: "netease",
				externalId: "1004",
				duration: 60_000,
				createdAt: 4,
				deletedAt: 5,
			},
			{
				id: "sound-effect",
				moduleId: context.moduleId,
				name: "开门",
				type: "se",
				source: "netease",
				externalId: "1005",
				duration: 1000,
				createdAt: 5,
			},
			{
				id: "foreign-bgm",
				moduleId: "other-module",
				name: "Other",
				type: "bgm",
				source: "netease",
				externalId: "1006",
				duration: 60_000,
				createdAt: 6,
			},
		]);
		await setSessionPhase(context, "free_discussion");
		server = listenTestApp(context.app);
		gm = await connectWs(address(), context.gmToken);
		const listenerToken = context.playerTokens.get("listener");
		if (!listenerToken) throw new Error("Missing listener token");
		listener = await connectWs(address(), listenerToken);
		await Promise.all([
			gm.waitFor((message) => message.type === "snapshot"),
			listener.waitFor((message) => message.type === "snapshot"),
		]);
	});

	afterAll(async () => {
		await Promise.all([closeWs(gm), closeWs(listener)]);
		await stopServer(server);
		context.container.startupService.stop();
		context.container.dbContext.sqlite.close();
		await rm(context.themesDir, { recursive: true, force: true });
	});

	async function command(payload: Record<string, unknown>) {
		const commandId = crypto.randomUUID();
		sendCommand(
			gm,
			"audio:bgm",
			{ expectedVersion: state?.version ?? 0, ...payload },
			commandId,
		);
		const reply = await gm.waitFor(
			(message) => message.commandId === commandId,
		);
		expect(reply.type).toBe("command:accepted");
		state = reply.payload.bgm;
		const event = await listener.waitFor(
			(message) =>
				message.type === "audio:bgm" &&
				message.payload.bgm.version === state.version,
		);
		expect(event.payload.bgm).toEqual(state);
		return state;
	}

	async function reject(payload: Record<string, unknown>, socket = gm) {
		const commandId = crypto.randomUUID();
		sendCommand(
			socket,
			"audio:bgm",
			{ expectedVersion: state.version, ...payload },
			commandId,
		);
		const reply = await socket.waitFor(
			(message) => message.commandId === commandId,
		);
		expect(reply.type).toBe("command:rejected");
		return reply.payload.code;
	}

	async function finish() {
		await context.container.db
			.update(sessionAudioState)
			.set({ startedAtMs: Date.now() - 65_000, seekOffsetMs: 0 })
			.where(eq(sessionAudioState.sessionId, context.sessionId));
		return command({ action: "ended" });
	}

	test("defaults to single repeat and rejects invalid mode, premature end and non-GM commands", async () => {
		expect(await command({ action: "play", trackId: "bgm-a" })).toMatchObject({
			mode: "single",
			playing: true,
		});
		expect(await reject({ action: "mode", mode: "invalid" })).toBe(
			"VALIDATION_FAILED",
		);
		expect(await reject({ action: "mode" })).toBe("VALIDATION_FAILED");
		await command({ action: "mode", mode: "list" });
		expect(await reject({ action: "ended" })).toBe("VALIDATION_FAILED");
		expect(await reject({ action: "mode", mode: "shuffle" }, listener)).toBe(
			"FORBIDDEN",
		);
		expect(await reject({ action: "ended" }, listener)).toBe("FORBIDDEN");
		expect(await reject({ action: "play", trackId: "deleted-bgm" })).toBe(
			"TRACK_NOT_FOUND",
		);
	});

	test("list mode advances, wraps, excludes foreign/deleted/SE tracks and rejects duplicate end", async () => {
		const version = state.version;
		expect(await finish()).toMatchObject({
			trackId: "bgm-b",
			mode: "list",
			playing: true,
			seekOffsetMs: 0,
		});
		expect(await reject({ action: "ended", expectedVersion: version })).toBe(
			"AUDIO_VERSION_CONFLICT",
		);
		expect(await finish()).toMatchObject({ trackId: "bgm-c" });
		expect(await finish()).toMatchObject({ trackId: "bgm-a" });
		expect(await command({ action: "previous" })).toMatchObject({
			trackId: "bgm-c",
			seekOffsetMs: 0,
		});
		expect(await command({ action: "next" })).toMatchObject({
			trackId: "bgm-a",
			seekOffsetMs: 0,
		});
	});

	test("shuffle selects on the server, avoids the current track and restores mode on reconnect", async () => {
		await command({ action: "mode", mode: "shuffle" });
		expect(await finish()).toMatchObject({ trackId: "bgm-c", mode: "shuffle" });
		expect(await command({ action: "next" })).toMatchObject({
			trackId: "bgm-b",
			mode: "shuffle",
		});
		const reconnected = await connectWs(address(), context.gmToken);
		try {
			const snapshot = await reconnected.waitFor(
				(message) => message.type === "snapshot",
			);
			expect(snapshot.payload.bgm).toMatchObject({
				trackId: "bgm-b",
				mode: "shuffle",
				version: state.version,
			});
		} finally {
			await closeWs(reconnected);
		}
		const persisted = await context.container.db
			.select()
			.from(sessionAudioState)
			.where(eq(sessionAudioState.sessionId, context.sessionId));
		expect(persisted[0]).toMatchObject({ mode: "shuffle", trackId: "bgm-b" });
	});

	test("stop mode stops authoritatively, resumes from the beginning and retains volume", async () => {
		await command({ action: "volume", volume: 37 });
		await command({ action: "mode", mode: "off" });
		expect(await finish()).toMatchObject({
			trackId: "bgm-b",
			playing: false,
			mode: "off",
			seekOffsetMs: 60_000,
			volume: 37,
		});
		expect(await command({ action: "play", trackId: "bgm-b" })).toMatchObject({
			playing: true,
			seekOffsetMs: 0,
			volume: 37,
		});
	});

	test("switching out of single repeat preserves the current cycle position", async () => {
		await command({ action: "mode", mode: "single" });
		await context.container.db
			.update(sessionAudioState)
			.set({ startedAtMs: Date.now() - 125_000 })
			.where(eq(sessionAudioState.sessionId, context.sessionId));
		const changed = await command({ action: "mode", mode: "list" });
		expect(changed.seekOffsetMs).toBeGreaterThanOrEqual(5000);
		expect(changed.seekOffsetMs).toBeLessThan(6500);
		expect(await reject({ action: "ended" })).toBe("VALIDATION_FAILED");
	});

	test("single-candidate shuffle repeats and an empty remaining library stops", async () => {
		await context.container.db
			.update(tracks)
			.set({ deletedAt: Date.now() })
			.where(eq(tracks.id, "bgm-a"));
		await context.container.db
			.update(tracks)
			.set({ deletedAt: Date.now() })
			.where(eq(tracks.id, "bgm-c"));
		await command({ action: "mode", mode: "shuffle" });
		expect(await finish()).toMatchObject({
			trackId: "bgm-b",
			playing: true,
			seekOffsetMs: 0,
		});
		await context.container.db
			.update(tracks)
			.set({ deletedAt: Date.now() })
			.where(eq(tracks.id, "bgm-b"));
		await command({ action: "pause" });
		expect(await command({ action: "play", trackId: "bgm-b" })).toMatchObject({
			trackId: "bgm-b",
			playing: true,
		});
		expect(await finish()).toMatchObject({ playing: false });
	});
});
