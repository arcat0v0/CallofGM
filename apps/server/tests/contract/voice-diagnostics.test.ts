import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	VoiceDiagnosticsReportsResponse,
	VoiceServerMessage,
	type VoiceState,
} from "@cogm/shared";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
	CreateUserUseCase,
	DrizzleIdentityRepository,
} from "@/modules/identity";
import { voiceDiagnosticReports } from "@/platform/db/schema";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import type { TestContext, TestServer, TestWebSocket } from "../helpers/setup";
import {
	closeWs,
	connectWs,
	listenTestApp,
	loginToken,
	setupTestApp,
	stopServer,
} from "../helpers/setup";

const acceptedAt = "2026-11-20T12:00:00.000Z";

function required<T>(value: T | null | undefined): T {
	if (value === null || value === undefined) throw new Error("Missing fixture");
	return value;
}

function sendVoice(ws: WebSocket, type: string, payload: unknown) {
	const requestId = crypto.randomUUID();
	ws.send(JSON.stringify({ protocolVersion: 1, requestId, type, payload }));
	return requestId;
}

async function voiceReply(ws: TestWebSocket, requestId: string) {
	const message = await ws.waitFor(
		(candidate) =>
			candidate.type === "voice:reply" &&
			candidate.payload.requestId === requestId,
	);
	return message.payload;
}

async function voiceState(
	ws: TestWebSocket,
	predicate: (state: VoiceState) => boolean,
) {
	const message = VoiceServerMessage.parse(
		await ws.waitFor(
			(candidate) =>
				candidate.type === "voice:state" && predicate(candidate.payload),
		),
	);
	if (message.type !== "voice:state") throw new Error("Expected voice state");
	return message.payload;
}

function consent(roomId: string, memberId: string) {
	return { roomId, memberId, consentVersion: 1, acceptedAt };
}

function sample(at: string, peerMemberId: string, rttMs: number) {
	return {
		at,
		peerMemberId,
		rttMs,
		jitterMs: 1.5,
		availableOutgoingBitrate: 32_000,
		packetsReceivedDelta: 100,
		packetsLostDelta: 2,
		packetsSentDelta: 102,
		bytesReceivedDelta: 10_000,
		bytesSentDelta: 10_200,
		concealmentEventsDelta: 1,
		concealedSamplesDelta: 48,
		localCandidateType: "host",
		localCandidateProtocol: "udp",
		remoteCandidateType: "relay",
		remoteCandidateProtocol: "udp",
		connectionState: "connected",
		iceConnectionState: "connected",
		signalingState: "stable",
		remoteTrackMuted: false,
		remoteTrackEnabled: true,
		remoteTrackReadyState: "live",
		remoteRms: 0.04,
		localMicState: "on",
		audioProcessing: "native",
	};
}

function batch(roomId: string, memberId: string, peerMemberIds: string[]) {
	return {
		schemaVersion: 1,
		consent: consent(roomId, memberId),
		samples: peerMemberIds.map((peerMemberId, index) =>
			sample(`2026-11-20T12:00:0${index}.000Z`, peerMemberId, 40 + index),
		),
		events: [
			{
				at: acceptedAt,
				kind: "voice-join",
				peerMemberId: null,
				state: "joined",
				previousState: null,
			},
		],
	};
}

describe("Voice diagnostics HTTP contract", () => {
	let ctx: TestContext;
	let server: TestServer;
	let sockets: TestWebSocket[];

	beforeEach(async () => {
		ctx = await setupTestApp({
			characters: [
				{ id: "diagnostics-pc-1", name: "Diagnostics One", kind: "pc" },
				{ id: "diagnostics-pc-2", name: "Diagnostics Two", kind: "pc" },
			],
			claims: [
				{ player: "one", role: "pc", characterId: "diagnostics-pc-1" },
				{ player: "two", role: "pc", characterId: "diagnostics-pc-2" },
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

	async function connect(token: string) {
		const socket = await connectWs(
			`ws://127.0.0.1:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
			token,
		);
		sockets.push(socket);
		return socket;
	}

	async function request(
		token: string,
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = {},
	) {
		const response = await ctx.app.handle(
			new Request(`http://localhost${path}`, {
				method,
				headers: {
					authorization: `Bearer ${token}`,
					...(body === undefined ? {} : { "content-type": "application/json" }),
					...headers,
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);
		const text = await response.text();
		return {
			status: response.status,
			body: text ? (JSON.parse(text) as unknown) : null,
		};
	}

	async function join(ws: TestWebSocket, roomId: string) {
		const requestId = sendVoice(ws, "voice:join", { roomId });
		expect(await voiceReply(ws, requestId)).toMatchObject({ ok: true });
		const state = await voiceState(
			ws,
			(candidate) => candidate.roomId === roomId && candidate.selfId !== null,
		);
		return required(state.selfId);
	}

	async function openVoice() {
		const status = await request(
			ctx.gmToken,
			"POST",
			`/api/v1/gm/sessions/${ctx.sessionId}/status`,
			{ status: "preparing" },
		);
		expect(status.status).toBe(200);
		const gm = await connect(ctx.gmToken);
		const one = await connect(required(ctx.playerTokens.get("one")));
		const two = await connect(required(ctx.playerTokens.get("two")));
		const configure = sendVoice(gm, "voice:configure", { enabled: true });
		expect(await voiceReply(gm, configure)).toMatchObject({ ok: true });
		const enabled = await voiceState(one, (state) => state.enabled);
		const roomId = required(enabled.roomId);
		const gmMemberId = await join(gm, roomId);
		const memberId = await join(one, roomId);
		const peerMemberId = await join(two, roomId);
		return { gm, one, two, roomId, gmMemberId, memberId, peerMemberId };
	}

	function consentPath() {
		return `/api/v1/sessions/${ctx.sessionId}/voice-diagnostics/consent`;
	}

	function samplesPath() {
		return `/api/v1/sessions/${ctx.sessionId}/voice-diagnostics/samples`;
	}

	function reportsPath(query = "") {
		return `/api/v1/gm/sessions/${ctx.sessionId}/voice-diagnostics${query}`;
	}

	test("requires current membership and opt-in, persists consent, and preserves history after revoke", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		const data = batch(room.roomId, room.memberId, [room.peerMemberId]);
		expect((await request(token, "POST", samplesPath(), data)).status).toBe(403);
		expect(
			(
				await request(token, "PUT", consentPath(), {
					...consent(room.roomId, room.memberId),
					memberId: room.peerMemberId,
				})
			).status,
		).toBe(403);
		expect(
			(
				await request(token, "PUT", consentPath(), {
					...consent(room.roomId, room.memberId),
					roomId: crypto.randomUUID(),
				})
			).status,
		).toBe(403);
		expect(
			(await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId)))
				.status,
		).toBe(200);
		expect(
			(
				await request(token, "POST", samplesPath(), {
					...data,
					consent: { ...data.consent, acceptedAt: "2026-11-20T13:00:00.000Z" },
				})
			).status,
		).toBe(403);
		expect((await request(token, "POST", samplesPath(), data)).status).toBe(200);

		const rows = await ctx.container.db
			.select()
			.from(voiceDiagnosticReports)
			.where(eq(voiceDiagnosticReports.sessionId, ctx.sessionId));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			sessionId: ctx.sessionId,
			roomId: room.roomId,
			memberId: room.memberId,
			consentVersion: 1,
			deletedAt: null,
		});
		expect(JSON.parse(required(rows[0]).payloadJson)).toEqual(data);

		expect(
			(
				await request(token, "POST", `/api/v1/sessions/${ctx.sessionId}/voice-diagnostics/revoke`, {
					roomId: room.roomId,
					memberId: room.peerMemberId,
				})
			).status,
		).toBe(403);
		expect(
			(
				await request(token, "POST", `/api/v1/sessions/${ctx.sessionId}/voice-diagnostics/revoke`, {
					roomId: room.roomId,
					memberId: room.memberId,
				})
			).status,
		).toBe(200);
		expect((await request(token, "POST", samplesPath(), data)).status).toBe(403);
		const reports = await request(ctx.gmToken, "GET", reportsPath());
		expect(reports.status).toBe(200);
		expect(VoiceDiagnosticsReportsResponse.parse(reports.body).reports).toHaveLength(1);
	});

	test("exports raw metrics only to the owning GM", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId));
		await request(
			token,
			"POST",
			samplesPath(),
			batch(room.roomId, room.memberId, [room.peerMemberId, room.gmMemberId]),
		);
		const identityRepo = new DrizzleIdentityRepository(ctx.container.db);
		await new CreateUserUseCase(
			new UuidGenerator(),
			new SystemClock(),
			identityRepo,
		).execute({ username: "diagnostics-other-gm", password: "correct horse", role: "gm" });
		const otherToken = await loginToken(ctx.app, "diagnostics-other-gm", "correct horse");
		expect((await request(otherToken, "GET", reportsPath())).status).toBe(404);
		expect((await request(ctx.adminToken, "GET", reportsPath())).status).toBe(403);
		expect((await request(ctx.gmToken, "GET", reportsPath("?limit=0"))).status).toBe(400);
		expect((await request(ctx.gmToken, "GET", reportsPath("?limit=201"))).status).toBe(400);

		const response = await request(ctx.gmToken, "GET", reportsPath("?limit=1"));
		expect(response.status).toBe(200);
		const responseData = VoiceDiagnosticsReportsResponse.parse(response.body);
		expect(responseData.reports).toHaveLength(1);
		const report = required(responseData.reports[0]);
		expect(report.samples.map((entry) => entry.peerMemberId)).toEqual([
			room.peerMemberId,
			room.gmMemberId,
		]);
		expect(report.samples.map((entry) => entry.rttMs)).toEqual([40, 41]);
		expect(required(report.events[0]).kind).toBe("voice-join");
		expect(JSON.stringify(report)).not.toContain("Diagnostics One");
		expect(JSON.stringify(report)).not.toContain(ctx.gmUserId);
		expect(report).not.toHaveProperty("ip");
	});

	test("rejects malformed and over-capacity batches without storing them", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId));
		const valid = batch(room.roomId, room.memberId, [room.peerMemberId]);
		const invalid = [
			{ ...valid, unexpected: true },
			{ ...valid, samples: [{ ...valid.samples[0], rttMs: -1 }] },
			{ ...valid, samples: [{ ...valid.samples[0], deviceId: "mic" }] },
			{ ...valid, events: [{ ...valid.events[0], kind: "join" }] },
			{ ...valid, samples: Array.from({ length: 257 }, () => valid.samples[0]) },
		];
		for (const body of invalid) {
			expect((await request(token, "POST", samplesPath(), body)).status).toBe(400);
		}
		expect(
			(
				await request(token, "POST", samplesPath(), valid, {
					"content-length": "600000",
				})
			).status,
		).toBe(413);
		expect(
			await ctx.container.db
				.select()
				.from(voiceDiagnosticReports)
				.where(eq(voiceDiagnosticReports.sessionId, ctx.sessionId)),
		).toHaveLength(0);
	});

	test("disconnect and reconnect require consent for the new member id", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId));
		await closeWs(room.one);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(room.roomId, room.memberId, [room.peerMemberId]),
				)
			).status,
		).toBe(403);
		const reconnected = await connect(token);
		const newMemberId = await join(reconnected, room.roomId);
		expect(newMemberId).not.toBe(room.memberId);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(room.roomId, room.memberId, [room.peerMemberId]),
				)
			).status,
		).toBe(403);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(room.roomId, newMemberId, [room.peerMemberId]),
				)
			).status,
		).toBe(403);
		expect(
			(await request(token, "PUT", consentPath(), consent(room.roomId, newMemberId)))
				.status,
		).toBe(200);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(room.roomId, newMemberId, [room.peerMemberId]),
				)
			).status,
		).toBe(200);
	});

	test("a new voice opening requires new consent", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId));
		const disable = sendVoice(room.gm, "voice:configure", { enabled: false });
		expect(await voiceReply(room.gm, disable)).toMatchObject({ ok: true });
		const enable = sendVoice(room.gm, "voice:configure", { enabled: true });
		expect(await voiceReply(room.gm, enable)).toMatchObject({ ok: true });
		const enabled = await voiceState(
			room.one,
			(state) => state.enabled && state.roomId !== room.roomId,
		);
		const newRoomId = required(enabled.roomId);
		const newMemberId = await join(room.one, newRoomId);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(room.roomId, room.memberId, [room.peerMemberId]),
				)
			).status,
		).toBe(403);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(newRoomId, newMemberId, []),
				)
			).status,
		).toBe(403);
		expect(
			(await request(token, "PUT", consentPath(), consent(newRoomId, newMemberId)))
				.status,
		).toBe(200);
		expect(
			(
				await request(
					token,
					"POST",
					samplesPath(),
					batch(newRoomId, newMemberId, []),
				)
			).status,
		).toBe(200);
	});

	test("returns the latest reports first and applies the export limit", async () => {
		const room = await openVoice();
		const token = required(ctx.playerTokens.get("one"));
		await request(token, "PUT", consentPath(), consent(room.roomId, room.memberId));
		const first = batch(room.roomId, room.memberId, [room.peerMemberId]);
		const second = {
			...first,
			samples: [sample(acceptedAt, room.peerMemberId, 99)],
		};
		expect((await request(token, "POST", samplesPath(), first)).status).toBe(200);
		expect((await request(token, "POST", samplesPath(), second)).status).toBe(200);
		const limited = VoiceDiagnosticsReportsResponse.parse(
			(await request(ctx.gmToken, "GET", reportsPath("?limit=1"))).body,
		);
		expect(limited.reports).toHaveLength(1);
		expect(required(required(limited.reports[0]).samples[0]).rttMs).toBe(99);
		const all = VoiceDiagnosticsReportsResponse.parse(
			(await request(ctx.gmToken, "GET", reportsPath())).body,
		);
		expect(all.reports.map((report) => report.samples[0]?.rttMs)).toEqual([99, 40]);
	});

});
