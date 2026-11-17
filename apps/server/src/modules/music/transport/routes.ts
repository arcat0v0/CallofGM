import {
	MusicSearchQuery,
	MusicSearchResponse,
	MusicTrackDto,
	ResolveMusicTrackRequest,
} from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { corsOriginsFor } from "@/config/env";
import {
	createAuthPlugin,
	DrizzleIdentityRepository,
	ForbiddenError,
	requireActor,
	requireGm,
} from "@/modules/identity";
import { modules, sessionClaims, sessions, tracks } from "@/platform/db/schema";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { MusicNotFoundError } from "../domain/music-errors";

export function createMusicRoutes(container: Container) {
	const identityRepo = new DrizzleIdentityRepository(container.db);
	const authPlugin = createAuthPlugin(identityRepo);
	const allowedOrigins = corsOriginsFor(container.env);

	return new Elysia()
		.use(authPlugin)
		.get("/api/v1/gm/music/search", async ({ actor, query }) => {
			requireGm(actor);
			const parsed = MusicSearchQuery.safeParse({
				provider: query.provider,
				query: query.query,
				limit: query.limit === undefined ? undefined : Number(query.limit),
			});
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			return MusicSearchResponse.parse({
				items: await container.musicService.search(
					parsed.data.provider,
					parsed.data.query,
					parsed.data.limit,
				),
			});
		})
		.post("/api/v1/gm/music/resolve", async ({ actor, body, request }) => {
			requireGm(actor);
			assertTrustedOrigin(request, allowedOrigins);
			const parsed = ResolveMusicTrackRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			return MusicTrackDto.parse(
				await container.musicService.resolve(
					parsed.data.provider,
					parsed.data.reference,
				),
			);
		})
		.get(
			"/api/v1/music/tracks/:id/stream",
			async ({ actor, params, request }) => {
				const authenticated = requireActor(actor);
				const rows = await container.db
					.select({ track: tracks, ownerId: modules.ownerId })
					.from(tracks)
					.innerJoin(modules, eq(tracks.moduleId, modules.id))
					.where(eq(tracks.id, params.id))
					.limit(1);
				const row = rows[0];
				if (!row || row.track.source === "upload" || !row.track.externalId) {
					throw new MusicNotFoundError();
				}
				if (authenticated.type === "user" && authenticated.role === "gm") {
					if (row.ownerId !== authenticated.userId) {
						throw new MusicNotFoundError();
					}
				} else {
					if (authenticated.type === "user" && authenticated.role === "admin") {
						throw new ForbiddenError("Administrators cannot access GM music");
					}
					const holderCondition =
						authenticated.type === "user"
							? eq(sessionClaims.userId, authenticated.userId)
							: eq(sessionClaims.playerId, authenticated.playerId);
					const claims = await container.db
						.select({ id: sessionClaims.id })
						.from(sessionClaims)
						.innerJoin(sessions, eq(sessionClaims.sessionId, sessions.id))
						.where(
							and(
								eq(sessions.moduleId, row.track.moduleId),
								holderCondition,
								isNull(sessionClaims.releasedAt),
							),
						)
						.limit(1);
					if (claims.length === 0) {
						throw new ForbiddenError(
							"You do not have access to this music track",
						);
					}
				}
				const provider = row.track.source === "netease" ? "netease" : "qq";
				return container.musicService.openStream(
					provider,
					row.track.externalId,
					request.headers.get("range") ?? undefined,
				);
			},
		);
}
