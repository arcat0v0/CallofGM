import {
	MusicPlaylistDto,
	MusicSearchQuery,
	MusicSearchResponse,
	MusicTrackDto,
	ResolveMusicPlaylistRequest,
	ResolveMusicTrackRequest,
} from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { requireGm } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { OpenMusicTrackStreamUseCase } from "../application/open-music-track-stream";

export function createMusicRoutes(container: Container) {
	const openStream = new OpenMusicTrackStreamUseCase(
		container.musicTrackAccessRepo,
		container.musicService,
	);
	const allowedOrigins = container.config.corsOrigins;

	return new Elysia()
		.use(container.authPlugin)
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
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
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
		.post(
			"/api/v1/gm/music/playlists/resolve",
			async ({ actor, body, request }) => {
				requireGm(actor);
				assertTrustedOrigin(
					request,
					allowedOrigins,
					container.config.trustProxy,
				);
				const parsed = ResolveMusicPlaylistRequest.safeParse(body);
				if (!parsed.success) {
					throw validationFailed(parsed.error);
				}
				return MusicPlaylistDto.parse(
					await container.musicService.resolvePlaylist(
						parsed.data.provider,
						parsed.data.reference,
						parsed.data.offset,
						parsed.data.limit,
					),
				);
			},
		)
		.get("/api/v1/music/tracks/:id/stream", ({ actor, params, request }) =>
			openStream.execute(
				actor,
				params.id,
				request.headers.get("range") ?? undefined,
			),
		);
}
