import type { OnlinePlayerDto } from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { loadHolderDisplayNames } from "@/platform/db/holder-display-names";
import { sessionClaims } from "@/platform/db/schema";
import { loadKickedPlayers } from "./application/kicked-players";
import type { ConnectionRegistry } from "./connection-registry";

/**
 * 在线列表服务：以 ConnectionRegistry 的实时连接为事实来源，
 * 结合有效 claim 聚合成 GM 视角的在线名单。
 */
export class PresenceService {
	constructor(
		private readonly db: DbClient,
		private readonly connectionRegistry: ConnectionRegistry,
	) {}

	async listOnline(sessionId: string): Promise<OnlinePlayerDto[]> {
		const connectionCounts =
			this.connectionRegistry.countConnectionsByPlayer(sessionId);
		if (connectionCounts.size === 0) {
			return [];
		}

		const claims = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					isNull(sessionClaims.releasedAt),
				),
			)
			.execute();

		const holderNames = await loadHolderDisplayNames(this.db, claims);
		const online: OnlinePlayerDto[] = [];
		for (const claim of claims) {
			const holderKind = claim.holderKind as "user" | "anonymous";
			const holderId =
				(holderKind === "user" ? claim.userId : claim.playerId) ?? "";
			const count = connectionCounts.get(`${holderKind}:${holderId}`);
			if (!count) continue;
			online.push({
				holderKind,
				holderId,
				displayName: holderNames.get(`${holderKind}:${holderId}`) ?? null,
				role: claim.role === "pc" ? "pc" : "ob",
				characterId: claim.characterId ?? null,
				connectionCount: count,
			});
		}
		return online;
	}

	/** 向 GM 连接全量推送在线列表与禁入名单（DirectControlMessage，无 eventId） */
	async broadcast(sessionId: string): Promise<void> {
		const [online, kickedPlayers] = await Promise.all([
			this.listOnline(sessionId),
			loadKickedPlayers(this.db, sessionId),
		]);
		this.connectionRegistry.sendToGms(sessionId, {
			type: "presence:updated",
			payload: { online, kickedPlayers },
		});
	}
}
