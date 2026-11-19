import { and, eq, isNull } from "drizzle-orm";
import type { ActorContext } from "@/modules/identity";
import type { DbClient } from "@/platform/db/client";
import { modules, sessionClaims, sessions, tracks } from "@/platform/db/schema";
import type {
	MusicTrackAccess,
	MusicTrackAccessRepository,
} from "../application/ports";

export class DrizzleMusicTrackAccessRepository
	implements MusicTrackAccessRepository
{
	constructor(private readonly db: DbClient) {}

	async findById(id: string): Promise<MusicTrackAccess | undefined> {
		const [track] = await this.db
			.select({
				source: tracks.source,
				externalId: tracks.externalId,
				moduleId: tracks.moduleId,
				ownerId: modules.ownerId,
			})
			.from(tracks)
			.innerJoin(modules, eq(tracks.moduleId, modules.id))
			.where(eq(tracks.id, id))
			.limit(1);
		return track;
	}

	async hasActiveClaim(
		moduleId: string,
		actor: ActorContext,
	): Promise<boolean> {
		const holderCondition =
			actor.type === "user"
				? eq(sessionClaims.userId, actor.userId)
				: eq(sessionClaims.playerId, actor.playerId);
		const claims = await this.db
			.select({ id: sessionClaims.id })
			.from(sessionClaims)
			.innerJoin(sessions, eq(sessionClaims.sessionId, sessions.id))
			.where(
				and(
					eq(sessions.moduleId, moduleId),
					holderCondition,
					isNull(sessionClaims.releasedAt),
				),
			)
			.limit(1);
		return claims.length > 0;
	}
}
