import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { sessionClaims } from "@/platform/db/schema";
import type { OnlinePlayerDto } from "@cogm/shared";
import type { ConnectionRegistry } from "./connection-registry";

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

    const online: OnlinePlayerDto[] = [];
    for (const claim of claims) {
      const count = connectionCounts.get(claim.playerId);
      if (!count) continue;
      online.push({
        playerId: claim.playerId,
        role: claim.role === "pc" ? "pc" : "ob",
        characterId: claim.characterId ?? null,
        connectionCount: count,
      });
    }
    return online;
  }

  /** 向 GM 连接全量推送在线列表（DirectControlMessage，无 eventId） */
  async broadcast(sessionId: string): Promise<void> {
    const online = await this.listOnline(sessionId);
    this.connectionRegistry.sendToGms(sessionId, {
      type: "presence:updated",
      payload: { online },
    });
  }
}
