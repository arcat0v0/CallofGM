import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VoiceState } from "@cogm/shared";
import { createApp } from "@/app";
import { voiceDiagnosticReports } from "@/platform/db/schema";
import type { TestWebSocket } from "../helpers/setup";
import {
	closeWs,
	connectWs,
	listenTestApp,
	setupTestApp,
	stopServer,
} from "../helpers/setup";

function sendVoice(ws: TestWebSocket, type: string, payload: unknown) {
	const requestId = crypto.randomUUID();
	ws.send(JSON.stringify({ protocolVersion: 1, requestId, type, payload }));
	return ws.waitFor(
		(message) =>
			message.type === "voice:reply" && message.payload.requestId === requestId,
	);
}

test("the server rejects retired diagnostics routes and preserves existing reports", async () => {
	const themesDir = await mkdtemp(join(tmpdir(), "cogm-retired-diagnostics-"));
	try {
		const { container, gmToken, sessionId } = await setupTestApp({ themesDir });
		const server = listenTestApp(createApp(container));
		let gm: TestWebSocket | undefined;
		try {
			const base = `http://127.0.0.1:${server.server.port}`;
			const request = (method: string, path: string, body?: unknown) =>
				fetch(`${base}${path}`, {
					method,
					headers: {
						authorization: `Bearer ${gmToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(body),
				});
			expect(
				(
					await request("POST", `/api/v1/gm/sessions/${sessionId}/status`, {
						status: "preparing",
					})
				).status,
			).toBe(200);
			gm = await connectWs(
				`ws://127.0.0.1:${server.server.port}/api/v1/sessions/${sessionId}/ws`,
				gmToken,
			);
			await gm.waitFor((message) => message.type === "voice:state");
			expect(
				await sendVoice(gm, "voice:configure", { enabled: true }),
			).toMatchObject({
				payload: { ok: true },
			});
			const { roomId } = VoiceState.parse(
				(
					await gm.waitFor(
						(message) =>
							message.type === "voice:state" && message.payload.enabled,
					)
				).payload,
			);
			expect(await sendVoice(gm, "voice:join", { roomId })).toMatchObject({
				payload: { ok: true },
			});
			const { selfId: memberId } = VoiceState.parse(
				(
					await gm.waitFor(
						(message) =>
							message.type === "voice:state" && message.payload.selfId,
					)
				).payload,
			);
			if (roomId === null || memberId === null)
				throw new Error("Missing voice membership");

			const acceptedAt = new Date().toISOString();
			const consent = { roomId, memberId, consentVersion: 1, acceptedAt };
			const batch = {
				schemaVersion: 1,
				consent,
				samples: [],
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
			const legacyReport = {
				id: crypto.randomUUID(),
				sessionId,
				roomId,
				memberId,
				consentVersion: 1,
				consentAcceptedAt: Date.parse(acceptedAt),
				receivedAt: Date.parse(acceptedAt),
				payloadJson: JSON.stringify(batch),
				deletedAt: null,
			};
			await container.db.insert(voiceDiagnosticReports).values(legacyReport);

			const diagnostics = `/api/v1/sessions/${sessionId}/voice-diagnostics`;
			const consentResponse = await request(
				"PUT",
				`${diagnostics}/consent`,
				consent,
			);
			const samplesResponse = await request(
				"POST",
				`${diagnostics}/samples`,
				batch,
			);
			const revokeResponse = await request("POST", `${diagnostics}/revoke`, {
				roomId,
				memberId,
			});
			const reportResponse = await request(
				"GET",
				`/api/v1/gm/sessions/${sessionId}/voice-diagnostics?limit=200`,
			);
			expect({
				consent: consentResponse.status,
				samples: samplesResponse.status,
				revoke: revokeResponse.status,
				reports: reportResponse.status,
			}).toEqual({ consent: 404, samples: 404, revoke: 404, reports: 404 });
			expect(await reportResponse.json()).toMatchObject({ code: "NOT_FOUND" });
			expect(await container.db.select().from(voiceDiagnosticReports)).toEqual([
				legacyReport,
			]);
		} finally {
			if (gm) await closeWs(gm);
			await stopServer(server);
			container.startupService.stop();
			container.dbContext.sqlite.close();
		}
	} finally {
		await rm(themesDir, { recursive: true, force: true });
	}
});
