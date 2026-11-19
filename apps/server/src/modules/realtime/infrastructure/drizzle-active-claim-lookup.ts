import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { sessionClaims } from "@/platform/db/schema";
import type { ActiveClaimLookup } from "../application/ports";

export class DrizzleActiveClaimLookup implements ActiveClaimLookup {
	constructor(private readonly db: DbClient) {}

	async findActiveClaims(sessionId: string) {
		return await this.db
			.select({
				userId: sessionClaims.userId,
				playerId: sessionClaims.playerId,
				characterId: sessionClaims.characterId,
			})
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					isNull(sessionClaims.releasedAt),
				),
			);
	}
}
