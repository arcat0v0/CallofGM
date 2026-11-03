import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { sessionClaims, users, anonymousPlayers } from "@/platform/db/schema";
import type { OnlinePlayerDto } from "@cogm/shared";
import type { ConnectionRegistry } from "./connection-registry";
import { loadKickedPlayers } from "./application/kicked-players";

/**
 * 在线列表服务：以 ConnectionRegistry 的实时连接为事实来源，
 * 结合有效 claim 聚合成 GM 视角的在线名单。
 */
export class PresenceService {
  constructor(
    private readonly db: DbClient,
    private readonly connectionRegistry: ConnectionRegistry
  ) {}

  async listOnline(sessionId: string): Promise<OnlinePlayerDto[]> {
    const connectionCounts = this.connectionRegistry.countConnectionsByPlayer(sessionId);
    if (connectionCounts.size === 0) {
      return [];
    }

    const claims = await this.db
      .select()
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          isNull(sessionClaims.releasedAt)
        )
      )
      .execute();

    const holderNames = await this.loadHolderNames(claims);
    const online: OnlinePlayerDto[] = [];
    for (const claim of claims) {
      const holderKind = claim.holderKind as "user" | "anonymous";
      const holderId = (holderKind === "user" ? claim.userId : claim.playerId) ?? "";
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

  private async loadHolderNames(
    claims: Array<{ holderKind: string; userId: string | null; playerId: string | null }>
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const userIds = claims.map((c) => c.userId).filter((id): id is string => Boolean(id));
    const playerIds = claims.map((c) => c.playerId).filter((id): id is string => Boolean(id));
    if (userIds.length > 0) {
      const rows = await this.db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const row of rows) names.set(`user:${row.id}`, row.username);
    }
    if (playerIds.length > 0) {
      const rows = await this.db
        .select({ id: anonymousPlayers.id })
        .from(anonymousPlayers)
        .where(inArray(anonymousPlayers.id, playerIds));
      for (const row of rows) names.set(`player:${row.id}`, `观战 ${row.id.slice(0, 8)}`);
    }
    return names;
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
