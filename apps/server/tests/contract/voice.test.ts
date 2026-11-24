import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { VoiceServerMessage, type VoiceState } from "@cogm/shared";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
	CreateUserUseCase,
	DrizzleIdentityRepository,
} from "@/modules/identity";
import { sessions } from "@/platform/db/schema";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import type { TestContext, TestServer, TestWebSocket } from "../helpers/setup";
import {
	closeWs,
	connectWs,
	listenTestApp,
	loginToken,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	stopServer,
} from "../helpers/setup";

function sendVoice(
	ws: WebSocket,
	type: string,
	payload: unknown,
	requestId = crypto.randomUUID(),
): string {
	ws.send(JSON.stringify({ protocolVersion: 1, requestId, type, payload }));
	return requestId;
}

function required<T>(value: T | null | undefined): T {
	if (value === null || value === undefined)
		throw new Error("Missing test fixture");
	return value;
}

async function voiceState(
	ws: TestWebSocket,
	predicate: (state: VoiceState) => boolean = () => true,
) {
	const message = VoiceServerMessage.parse(
		await ws.waitFor(
			(candidate) =>
				candidate.type === "voice:state" && predicate(candidate.payload),
		),
	);
	if (message.type !== "voice:state") throw new Error("Expected voice state");
	return message;
}

async function voiceReply(ws: TestWebSocket, requestId: string) {
	const message = VoiceServerMessage.parse(
		await ws.waitFor(
			(candidate) =>
				candidate.type === "voice:reply" &&
				candidate.payload.requestId === requestId,
		),
	);
	if (message.type !== "voice:reply") throw new Error("Expected voice reply");
	return message.payload;
}

describe("Voice realtime contract", () => {
	let ctx: TestContext;
	let server: TestServer;
	let sockets: TestWebSocket[];

	beforeEach(async () => {
		ctx = await setupTestApp({
			characters: [
				{ id: "voice-pc-1", name: "Voice PC One", kind: "pc" },
				{ id: "voice-pc-2", name: "Voice PC Two", kind: "pc" },
			],
			players: ["observer"],
			claims: [
				{ player: "one", role: "pc", characterId: "voice-pc-1" },
				{ player: "two", role: "pc", characterId: "voice-pc-2" },
				{ player: "observer", role: "ob" },
			],
		});
		server = listenTestApp(new Elysia().use(ctx.app));
		sockets = [];
	});

	afterEach(async () => {
		await Promise.all(
			sockets
				.filter((socket) => socket.readyState !== WebSocket.CLOSED)
				.map((socket) => closeWs(socket)),
		);
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	async function connect(token: string): Promise<TestWebSocket> {
		const socket = await connectWs(
			`ws://127.0.0.1:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
			token,
		);
		sockets.push(socket);
		return socket;
	}

	async function prepare() {
		const response = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${ctx.gmToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ status: "preparing" }),
				},
			),
		);
		expect(response.status).toBe(200);
	}

	test("joins a specific opening and unicasts SDP and ICE only to its target", async () => {
		await prepare();
		const gm = await connect(ctx.gmToken);
		const pc1 = await connect(required(ctx.playerTokens.get("one")));
		const pc2 = await connect(required(ctx.playerTokens.get("two")));
		await Promise.all([voiceState(gm), voiceState(pc1), voiceState(pc2)]);

		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toEqual({
			requestId: enable,
			ok: true,
		});
		const enabled = await voiceState(pc1, (state) => state.enabled);
		if (enabled.type !== "voice:state") throw new Error("Expected voice state");
		expect(enabled.payload.enabled).toBe(true);
		expect(enabled.payload.roomId).toBeString();

		const stale = sendVoice(pc1, "voice:join", {
			roomId: crypto.randomUUID(),
		});
		expect(await voiceReply(pc1, stale)).toEqual({
			requestId: stale,
			ok: false,
			code: "VOICE_ROOM_CHANGED",
		});

		const joinOne = sendVoice(pc1, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		const joinTwo = sendVoice(pc2, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(pc1, joinOne)).toEqual({
			requestId: joinOne,
			ok: true,
		});
		expect(await voiceReply(pc2, joinTwo)).toEqual({
			requestId: joinTwo,
			ok: true,
		});
		const roster = await pc2.waitFor(
			(message) =>
				message.type === "voice:state" && message.payload.members.length === 2,
		);
		const target = roster.payload.members.find(
			(member: { name: string }) => member.name === "Voice PC Two",
		);
		expect(target).toBeDefined();

		const offer = sendVoice(pc1, "voice:signal", {
			toMemberId: target.id,
			signal: {
				kind: "description",
				description: { type: "offer", sdp: "v=0\r\n" },
			},
		});
		expect(await voiceReply(pc1, offer)).toEqual({
			requestId: offer,
			ok: true,
		});
		const forwarded = VoiceServerMessage.parse(
			await pc2.waitFor((message) => message.type === "voice:signal"),
		);
		expect(forwarded).toMatchObject({
			type: "voice:signal",
			payload: {
				signal: {
					kind: "description",
					description: { type: "offer", sdp: "v=0\r\n" },
				},
			},
		});
		if (forwarded.type !== "voice:signal")
			throw new Error("Expected voice signal");
		expect(gm.messages.some((message) => message.type === "voice:signal")).toBe(
			false,
		);

		const candidate = sendVoice(pc2, "voice:signal", {
			toMemberId: forwarded.payload.fromMemberId,
			signal: {
				kind: "candidate",
				candidate: {
					candidate: "candidate:1 1 UDP 1 127.0.0.1 9 typ host",
					sdpMid: null,
					sdpMLineIndex: null,
					usernameFragment: null,
				},
			},
		});
		expect(await voiceReply(pc2, candidate)).toEqual({
			requestId: candidate,
			ok: true,
		});
		expect(
			await pc1.waitFor(
				(message) =>
					message.type === "voice:signal" &&
					message.payload.signal.kind === "candidate",
			),
		).toMatchObject({
			payload: { signal: { kind: "candidate" } },
		});
	});

	test("enforces ownership, roster visibility, moderation and duplicate tabs", async () => {
		await prepare();
		const identityRepo = new DrizzleIdentityRepository(ctx.container.db);
		await new CreateUserUseCase(
			new UuidGenerator(),
			new SystemClock(),
			identityRepo,
		).execute({
			username: "other-gm",
			password: "test-gm-password",
			role: "gm",
		});
		const otherToken = await loginToken(
			ctx.app,
			"other-gm",
			"test-gm-password",
		);
		const otherGm = await connect(otherToken);
		const gm = await connect(ctx.gmToken);
		const pc = await connect(required(ctx.playerTokens.get("one")));
		const ob = await connect(required(ctx.playerTokens.get("observer")));
		const forbidden = sendVoice(pc, "voice:configure", { enabled: true });
		expect(await voiceReply(pc, forbidden)).toMatchObject({
			ok: false,
			code: "VOICE_FORBIDDEN",
		});
		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toMatchObject({ ok: true });
		const enabled = await voiceState(pc, (state) => state.enabled);
		expect(
			otherGm.messages
				.filter((message) => message.type === "voice:state")
				.at(-1).payload,
		).toMatchObject({
			available: false,
			canManage: false,
			roomId: null,
			members: [],
		});
		const joinGm = sendVoice(gm, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(gm, joinGm)).toMatchObject({ ok: true });
		await voiceState(
			pc,
			(state) => state.memberCount === 1 && state.members.length === 0,
		);
		const joinOb = sendVoice(ob, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(ob, joinOb)).toMatchObject({ ok: true });
		const obJoined = await voiceState(ob, (state) => state.selfId !== null);
		if (obJoined.type !== "voice:state") throw new Error("Expected state");
		const obMember = required(
			obJoined.payload.members.find(
				(member) => member.id === obJoined.payload.selfId,
			),
		);
		expect(obMember).toMatchObject({
			role: "ob",
			canSpeak: false,
			speakGranted: false,
		});
		expect(obMember.name).toStartWith("观战 ");
		const grant = sendVoice(gm, "voice:moderate", {
			memberId: obMember.id,
			speakGranted: true,
		});
		expect(await voiceReply(gm, grant)).toMatchObject({ ok: true });
		await voiceState(
			ob,
			(state) =>
				state.members.find((member) => member.id === obMember.id)?.canSpeak ===
				true,
		);
		const mute = sendVoice(gm, "voice:moderate", {
			memberId: obMember.id,
			muted: true,
		});
		expect(await voiceReply(gm, mute)).toMatchObject({ ok: true });
		await voiceState(ob, (state) => {
			const member = state.members.find(
				(candidate) => candidate.id === obMember.id,
			);
			return member?.muted === true && member.canSpeak === false;
		});
		const duplicate = await connect(required(ctx.playerTokens.get("one")));
		const joinPc = sendVoice(pc, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(pc, joinPc)).toMatchObject({ ok: true });
		const duplicateJoin = sendVoice(duplicate, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(duplicate, duplicateJoin)).toMatchObject({
			ok: false,
			code: "VOICE_DUPLICATE_TAB",
		});
		duplicate.send(
			JSON.stringify({
				protocolVersion: 1,
				requestId: "",
				type: "voice:leave",
				payload: {},
			}),
		);
		expect(
			await duplicate.waitFor(
				(message) =>
					message.type === "voice:reply" &&
					message.payload.code === "VALIDATION_FAILED",
			),
		).toMatchObject({ payload: { requestId: "invalid" } });
		for (let index = 0; index < 49; index += 1) {
			duplicate.send(
				JSON.stringify({
					protocolVersion: 1,
					requestId: `invalid-${index}`,
					type: "voice:leave",
					payload: null,
				}),
			);
		}
		expect(
			await duplicate.waitFor(
				(message) =>
					message.type === "voice:reply" &&
					message.payload.code === "VOICE_RATE_LIMITED",
			),
		).toMatchObject({ payload: { ok: false } });
	});

	test("refreshes joined, unjoined and released seats with the same ordered roster", async () => {
		await prepare();
		const pcToken = required(ctx.playerTokens.get("one"));
		const gm = await connect(ctx.gmToken);
		const ob = await connect(required(ctx.playerTokens.get("observer")));
		const pc = await connect(pcToken);
		const listener = await connect(required(ctx.playerTokens.get("two")));
		await Promise.all(
			[gm, ob, pc, listener].map((socket) => voiceState(socket)),
		);

		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toMatchObject({ ok: true });
		const { payload: opening } = await voiceState(pc, (state) => state.enabled);
		const roomId = required(opening.roomId);
		const joinPc = sendVoice(pc, "voice:join", { roomId });
		expect(await voiceReply(pc, joinPc)).toMatchObject({ ok: true });
		const { payload: joinedPc } = await voiceState(
			pc,
			(state) => state.selfId !== null,
		);
		const joinOb = sendVoice(ob, "voice:join", { roomId });
		expect(await voiceReply(ob, joinOb)).toMatchObject({ ok: true });
		const hasBothMembers = (state: VoiceState) => state.memberCount === 2;
		const [gmState, obState, pcState, listenerState] = await Promise.all([
			voiceState(gm, hasBothMembers),
			voiceState(ob, hasBothMembers),
			voiceState(pc, hasBothMembers),
			voiceState(listener, hasBothMembers),
		]);
		const expectedRoster: VoiceState["members"] = [
			{
				id: required(joinedPc.selfId),
				name: "Voice PC One",
				role: "pc",
				canSpeak: true,
				speakGranted: true,
				muted: false,
			},
			{
				id: required(obState.payload.selfId),
				name: `观战 ${required(ctx.playerIds.get("observer")).slice(0, 8)}`,
				role: "ob",
				canSpeak: false,
				speakGranted: false,
				muted: false,
			},
		];
		expect(gmState.payload).toMatchObject({
			roomId,
			canManage: true,
			selfId: null,
		});
		expect(gmState.payload.members).toEqual(expectedRoster);
		expect(pcState.payload.members).toEqual(expectedRoster);
		expect(obState.payload.members).toEqual(expectedRoster);
		expect(listenerState.payload).toMatchObject({
			roomId,
			available: true,
			selfId: null,
			members: [],
			iceServers: [],
		});

		const release = await ctx.app.handle(
			new Request(`http://localhost/api/v1/sessions/${ctx.sessionId}/release`, {
				method: "POST",
				headers: { authorization: `Bearer ${pcToken}` },
			}),
		);
		expect(release.status).toBe(200);
		const [gmAfterRelease, obAfterRelease, pcAfterRelease] = await Promise.all([
			voiceState(
				gm,
				(state) => state.members[0]?.id === obState.payload.selfId,
			),
			voiceState(
				ob,
				(state) => state.memberCount === 1 && state.selfId !== null,
			),
			voiceState(pc, (state) => !state.available),
		]);
		expect(gmAfterRelease.payload.members).toEqual(expectedRoster.slice(1));
		expect(obAfterRelease.payload.members).toEqual(expectedRoster.slice(1));
		expect(pcAfterRelease.payload).toMatchObject({
			enabled: false,
			roomId: null,
			selfId: null,
			members: [],
			memberCount: 0,
			iceServers: [],
		});
	});

	test("reserves the GM seat, admits atomically and persists the limit override", async () => {
		await prepare();
		const gm = await connect(ctx.gmToken);
		const pc1 = await connect(required(ctx.playerTokens.get("one")));
		const pc2 = await connect(required(ctx.playerTokens.get("two")));
		const limit = sendVoice(gm, "voice:configure", { limit: 2 });
		expect(await voiceReply(gm, limit)).toMatchObject({ ok: true });
		const [stored] = await ctx.container.db
			.select()
			.from(sessions)
			.where(eq(sessions.id, ctx.sessionId));
		expect(required(stored).voiceLimit).toBe(2);
		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toMatchObject({ ok: true });
		const enabled = await voiceState(
			gm,
			(state) => state.enabled && state.limit === 2,
		);
		if (enabled.type !== "voice:state") throw new Error("Expected state");
		const locked = sendVoice(gm, "voice:configure", { limit: 3 });
		expect(await voiceReply(gm, locked)).toMatchObject({
			ok: false,
			code: "VOICE_LIMIT_LOCKED",
		});
		const one = sendVoice(pc1, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		const two = sendVoice(pc2, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		const replies = await Promise.all([
			voiceReply(pc1, one),
			voiceReply(pc2, two),
		]);
		expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
		expect(replies.find((reply) => !reply.ok)).toMatchObject({
			code: "VOICE_FULL",
		});
		const gmJoin = sendVoice(gm, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(gm, gmJoin)).toMatchObject({ ok: true });
		const disable = sendVoice(gm, "voice:configure", { enabled: false });
		expect(await voiceReply(gm, disable)).toMatchObject({ ok: true });
		const reopen = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, reopen)).toMatchObject({ ok: true });
		const reopened = await voiceState(
			gm,
			(state) => state.enabled && state.roomId !== enabled.payload.roomId,
		);
		if (reopened.type !== "voice:state") throw new Error("Expected state");
		const stale = sendVoice(gm, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(gm, stale)).toMatchObject({
			ok: false,
			code: "VOICE_ROOM_CHANGED",
		});
	});

	test("preserves claim moderation across reconnect and leave but clears it on kick", async () => {
		await prepare();
		const gm = await connect(ctx.gmToken);
		let ob = await connect(required(ctx.playerTokens.get("observer")));
		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toMatchObject({ ok: true });
		const enabled = await voiceState(ob, (state) => state.enabled);
		if (enabled.type !== "voice:state") throw new Error("Expected state");
		const join = sendVoice(ob, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(ob, join)).toMatchObject({ ok: true });
		const joined = await voiceState(ob, (state) => state.selfId !== null);
		if (joined.type !== "voice:state") throw new Error("Expected state");
		const oldId = required(joined.payload.selfId);
		const grant = sendVoice(gm, "voice:moderate", {
			memberId: oldId,
			speakGranted: true,
		});
		expect(await voiceReply(gm, grant)).toMatchObject({ ok: true });
		const mute = sendVoice(gm, "voice:moderate", {
			memberId: oldId,
			muted: true,
		});
		expect(await voiceReply(gm, mute)).toMatchObject({ ok: true });
		await closeWs(ob);
		ob = await connect(required(ctx.playerTokens.get("observer")));
		const rejoin = sendVoice(ob, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(ob, rejoin)).toMatchObject({ ok: true });
		const reconnected = await voiceState(ob, (state) => state.selfId !== null);
		if (reconnected.type !== "voice:state") throw new Error("Expected state");
		expect(reconnected.payload.selfId).not.toBe(oldId);
		expect(
			reconnected.payload.members.find(
				(member) => member.id === reconnected.payload.selfId,
			),
		).toMatchObject({
			speakGranted: true,
			muted: true,
			canSpeak: false,
		});
		const leave = sendVoice(ob, "voice:leave", {});
		expect(await voiceReply(ob, leave)).toMatchObject({ ok: true });
		const physicalRejoin = sendVoice(ob, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(ob, physicalRejoin)).toMatchObject({ ok: true });
		const rejoined = await voiceState(
			ob,
			(state) =>
				state.selfId !== null && state.members.some((member) => member.muted),
		);
		expect(rejoined.payload.members.some((member) => member.speakGranted)).toBe(
			true,
		);
		const activate = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${ctx.gmToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ status: "active" }),
				},
			),
		);
		expect(activate.status).toBe(200);
		const kickId = crypto.randomUUID();
		sendCommand(
			gm,
			"player:kick",
			{
				holderKind: "anonymous",
				holderId: required(ctx.playerIds.get("observer")),
			},
			kickId,
		);
		await gm.waitFor(
			(message) =>
				message.type === "command:accepted" && message.commandId === kickId,
		);
		expect((await ob.closed).code).toBe(4000);
		const unkickId = crypto.randomUUID();
		sendCommand(
			gm,
			"player:unkick",
			{
				holderKind: "anonymous",
				holderId: required(ctx.playerIds.get("observer")),
			},
			unkickId,
		);
		await gm.waitFor(
			(message) =>
				message.type === "command:accepted" && message.commandId === unkickId,
		);
		ob = await connect(required(ctx.playerTokens.get("observer")));
		const afterKick = sendVoice(ob, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(ob, afterKick)).toMatchObject({ ok: true });
		const reset = await voiceState(ob, (state) => state.selfId !== null);
		if (reset.type !== "voice:state") throw new Error("Expected state");
		expect(
			reset.payload.members.find(
				(member) => member.id === reset.payload.selfId,
			),
		).toMatchObject({
			speakGranted: false,
			muted: false,
		});
	});

	test("re-evaluates phase, rewind and undo, closes on end and revokes logins cleanly", async () => {
		await prepare();
		const gm = await connect(ctx.gmToken);
		const pc = await connect(required(ctx.playerTokens.get("one")));
		const enable = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, enable)).toMatchObject({ ok: true });
		const enabled = await voiceState(pc, (state) => state.enabled);
		if (enabled.type !== "voice:state") throw new Error("Expected state");
		const join = sendVoice(pc, "voice:join", {
			roomId: enabled.payload.roomId,
		});
		expect(await voiceReply(pc, join)).toMatchObject({ ok: true });
		const activeResponse = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${ctx.gmToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ status: "active" }),
				},
			),
		);
		expect(activeResponse.status).toBe(200);
		const phaseResponse = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/phase`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${ctx.gmToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ phase: "forced_cg" }),
				},
			),
		);
		expect(phaseResponse.status).toBe(200);
		await voiceState(
			pc,
			(state) =>
				state.selfId !== null &&
				state.members.find((member) => member.id === state.selfId)?.canSpeak ===
					false,
		);
		const rewindId = crypto.randomUUID();
		sendCommand(
			gm,
			"history:rewind",
			{ anchorEventId: 3, reason: "voice phase test" },
			rewindId,
		);
		const rewindReply = await gm.waitFor(
			(message) =>
				(message.type === "command:accepted" ||
					message.type === "command:rejected") &&
				message.commandId === rewindId,
		);
		expect(rewindReply).toMatchObject({ type: "command:accepted" });
		await voiceState(
			pc,
			(state) =>
				state.members.find((member) => member.id === state.selfId)?.canSpeak ===
				true,
		);
		const undoId = crypto.randomUUID();
		sendCommand(
			gm,
			"history:undo-rewind",
			{ rewindId: rewindReply.payload.rewindId, reason: "voice phase test" },
			undoId,
		);
		const undoReply = await gm.waitFor(
			(message) =>
				(message.type === "command:accepted" ||
					message.type === "command:rejected") &&
				message.commandId === undoId,
		);
		expect(undoReply.type).toBe("command:accepted");
		await voiceState(
			pc,
			(state) =>
				state.members.find((member) => member.id === state.selfId)?.canSpeak ===
				false,
		);
		await setSessionPhase(ctx, "performance_time");
		const performance = await pc.waitFor(
			(message) =>
				message.type === "session:phase-changed" &&
				message.payload.phase === "performance_time",
		);
		const performanceIndex = pc.messages.indexOf(performance);
		const state = VoiceServerMessage.parse(
			await pc.waitFor(
				(message) =>
					message.type === "voice:state" &&
					pc.messages.indexOf(message) > performanceIndex,
			),
		);
		if (state.type !== "voice:state") throw new Error("Expected voice state");
		expect(
			state.payload.members.find(
				(member) => member.id === state.payload.selfId,
			),
		).toMatchObject({ canSpeak: true });
		const replacement = await connect(ctx.gmToken);
		const currentToken = await loginToken(ctx.app, "gm", "test-gm-password");
		expect((await gm.closed).code).toBe(4003);
		expect((await replacement.closed).code).toBe(4003);
		const currentGm = await connect(currentToken);
		const endResponse = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${currentToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ status: "ended" }),
				},
			),
		);
		expect(endResponse.status).toBe(200);
		expect((await pc.closed).code).toBe(1001);
		expect((await currentGm.closed).code).toBe(1001);
	});
});
