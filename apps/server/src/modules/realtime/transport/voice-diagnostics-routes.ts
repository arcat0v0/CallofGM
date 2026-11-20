import {
	VoiceDiagnosticsBatch,
	VoiceDiagnosticsConsent,
	VoiceDiagnosticsMutationResponse,
	VoiceDiagnosticsReportsQuery,
	VoiceDiagnosticsReportsResponse,
	VoiceDiagnosticsRevoke,
} from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { corsOriginsFor } from "@/config/env";
import {
	ForbiddenError,
	requireActor,
	requireGm,
} from "@/modules/identity";
import { SessionNotFoundError } from "@/modules/sessions";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";

const MAX_BATCH_BODY_BYTES = 512 * 1024;

function assertBatchBodySize(request: Request): void {
	const raw = request.headers.get("content-length");
	if (raw === null) return;
	const size = Number(raw);
	if (Number.isFinite(size) && size > MAX_BATCH_BODY_BYTES) {
		throw new AppError(
			"VOICE_DIAGNOSTICS_PAYLOAD_TOO_LARGE",
			"Voice diagnostics batch is too large",
			413,
		);
	}
}

export function createVoiceDiagnosticsRoutes(container: Container) {
	const allowedOrigins = corsOriginsFor(container.env);

	return new Elysia()
		.use(container.authPlugin)
		.put(
			"/api/v1/sessions/:id/voice-diagnostics/consent",
			async ({ actor, params: { id }, body, request }) => {
				assertTrustedOrigin(request, allowedOrigins);
				const currentActor = requireActor(actor);
				const parsed = VoiceDiagnosticsConsent.safeParse(body);
				if (!parsed.success) throw validationFailed(parsed.error);
				const registered = await container.voiceService.registerDiagnosticsConsent(
					currentActor,
					id,
					parsed.data,
				);
				if (!registered) {
					throw new ForbiddenError("Current voice membership and room are required");
				}
				return VoiceDiagnosticsMutationResponse.parse({ ok: true });
			},
		)
		.post(
			"/api/v1/sessions/:id/voice-diagnostics/revoke",
			async ({ actor, params: { id }, body, request }) => {
				assertTrustedOrigin(request, allowedOrigins);
				const currentActor = requireActor(actor);
				const parsed = VoiceDiagnosticsRevoke.safeParse(body);
				if (!parsed.success) throw validationFailed(parsed.error);
				const revoked = await container.voiceService.revokeDiagnosticsConsent(
					currentActor,
					id,
					parsed.data.roomId,
					parsed.data.memberId,
				);
				if (!revoked) {
					throw new ForbiddenError("Current voice membership and room are required");
				}
				return VoiceDiagnosticsMutationResponse.parse({ ok: true });
			},
		)
		.post(
			"/api/v1/sessions/:id/voice-diagnostics/samples",
			async ({ actor, params: { id }, body, request }) => {
				assertTrustedOrigin(request, allowedOrigins);
				assertBatchBodySize(request);
				const currentActor = requireActor(actor);
				const parsed = VoiceDiagnosticsBatch.safeParse(body);
				if (!parsed.success) throw validationFailed(parsed.error);
				const registeredConsent =
					await container.voiceService.getDiagnosticsConsent(
						currentActor,
						id,
						parsed.data.consent.roomId,
						parsed.data.consent.memberId,
					);
				if (
					!registeredConsent ||
					registeredConsent.consentVersion !== parsed.data.consent.consentVersion ||
					registeredConsent.acceptedAt !== parsed.data.consent.acceptedAt
				) {
					throw new ForbiddenError("Active voice diagnostics consent is required");
				}
				const receivedAt = container.clock.nowEpochMs();
				await container.voiceDiagnosticsRepo.insert({
					id: container.idGenerator.nextId(),
					sessionId: id,
					roomId: parsed.data.consent.roomId,
					memberId: parsed.data.consent.memberId,
					consentVersion: registeredConsent.consentVersion,
					consentAcceptedAt: Date.parse(registeredConsent.acceptedAt),
					receivedAt,
					payloadJson: JSON.stringify(parsed.data),
					deletedAt: null,
				});
				return VoiceDiagnosticsMutationResponse.parse({ ok: true });
			},
		)
		.get(
			"/api/v1/gm/sessions/:id/voice-diagnostics",
			async ({ actor, params: { id }, query }) => {
				const gm = requireGm(actor);
				const parsed = VoiceDiagnosticsReportsQuery.safeParse(query);
				if (!parsed.success) throw validationFailed(parsed.error);
				const session = await container.sessionsRepo.findSessionById(id);
				if (
					!session ||
					session.ownerId !== gm.userId ||
					session.deletedAt !== null
				) {
					throw new SessionNotFoundError();
				}
				const rows = await container.voiceDiagnosticsRepo.listBySession(
					id,
					parsed.data.limit,
				);
				return VoiceDiagnosticsReportsResponse.parse({
					reports: rows.map((row) => {
						const batch = VoiceDiagnosticsBatch.parse(JSON.parse(row.payloadJson));
						return {
							id: row.id,
							schemaVersion: batch.schemaVersion,
							roomId: row.roomId,
							memberId: row.memberId,
							consentVersion: row.consentVersion,
							consentAcceptedAt: new Date(row.consentAcceptedAt).toISOString(),
							receivedAt: new Date(row.receivedAt).toISOString(),
							samples: batch.samples,
							events: batch.events,
						};
					}),
				});
			},
		);
}
