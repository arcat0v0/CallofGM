import {
	type ActorContext,
	ForbiddenError,
	requireActor,
} from "@/modules/identity";
import { MusicNotFoundError } from "../domain/music-errors";
import type { MusicService, MusicTrackAccessRepository } from "./ports";

export class OpenMusicTrackStreamUseCase {
	constructor(
		private readonly repo: MusicTrackAccessRepository,
		private readonly music: MusicService,
	) {}

	async execute(actor: ActorContext | null, trackId: string, range?: string) {
		const authenticated = requireActor(actor);
		const track = await this.repo.findById(trackId);
		if (!track || track.source === "upload" || !track.externalId) {
			throw new MusicNotFoundError();
		}
		if (authenticated.type === "user" && authenticated.role === "gm") {
			if (track.ownerId !== authenticated.userId) {
				throw new MusicNotFoundError();
			}
		} else {
			if (authenticated.type === "user" && authenticated.role === "admin") {
				throw new ForbiddenError("Administrators cannot access GM music");
			}
			if (!(await this.repo.hasActiveClaim(track.moduleId, authenticated))) {
				throw new ForbiddenError("You do not have access to this music track");
			}
		}
		const provider = track.source === "netease" ? "netease" : "qq";
		return this.music.openStream(provider, track.externalId, range);
	}
}
