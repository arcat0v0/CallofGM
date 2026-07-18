import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import type { Container } from "@/bootstrap/container";
import { sessionClaims } from "@/platform/db/schema";
import { SessionNotFoundError } from "@/modules/sessions";
import {
  DrizzleIdentityRepository,
  createAuthPlugin,
  AuthRequiredError,
  ForbiddenError,
  type ActorContext,
} from "@/modules/identity";
import { ClientCommand, type SessionSnapshot } from "@cogm/shared";
import { checkVisibility } from "../domain/visibility";

/** 每连接命令限速：滑动窗口内最多执行的命令数（宽松上限，防滥用不影响正常使用） */
const RATE_LIMIT_WINDOW_MS = 5_000;
const RATE_LIMIT_MAX_COMMANDS = 50;

async function resolveClaimedCharacterId(
  container: Container,
  sessionId: string,
  actor: ActorContext
): Promise<string | null> {
  if (actor.type !== "player") {
    return null;
  }
  const rows = await container.db
    .select({ characterId: sessionClaims.characterId })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        eq(sessionClaims.playerId, actor.playerId),
        isNull(sessionClaims.releasedAt)
      )
    );
  return rows[0]?.characterId ?? null;
}

export function createRealtimeRoutes(container: Container) {
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const authPlugin = createAuthPlugin(identityRepo, container.playerTokenSigner);
  const { connectionRegistry, eventRingBuffer, sessionCommandExecutor, presenceService, snapshotBuilder } = container;

  return new Elysia()
    .use(authPlugin)
    .ws("/api/v1/sessions/:id/ws", {
      idleTimeout: 30,
      async beforeHandle({ actor, params: { id } }) {
        if (!actor) {
          throw new AuthRequiredError();
        }

        const session = await snapshotBuilder.findSessionOrNull(id);
        if (!session) {
          throw new SessionNotFoundError();
        }

        if (actor.type === "player") {
          const claimedCharacterId = await resolveClaimedCharacterId(container, id, actor);
          const hasClaim = claimedCharacterId !== null || (await hasObClaim(container, id, actor.playerId));
          if (!hasClaim) {
            throw new ForbiddenError("No active claim in this session");
          }
        }
      },
      async open(ws) {
        const sessionId = ws.data.params.id;
        const actor = ws.data.actor;
        if (!actor) {
          ws.close();
          return;
        }

        const connectionId = crypto.randomUUID();
        (ws.data as Record<string, unknown>).connectionId = connectionId;
        (ws.data as Record<string, unknown>).commandTimestamps = [] as number[];

        const connection = {
          connectionId,
          ws: {
            send: (data: string) => ws.send(data),
            close: (code?: number, reason?: string) => {
              // 优先走底层 raw socket 关闭（Elysia 包装层行为以 raw 为准）
              const raw = (ws as unknown as { raw?: { close(code?: number, reason?: string): void } }).raw;
              if (raw?.close) {
                raw.close(code, reason);
              } else {
                ws.close(code, reason);
              }
            },
          },
          sessionId,
          playerId: actor.type === "player" ? actor.playerId : null,
          actor,
        };

        const claimedCharacterId = await resolveClaimedCharacterId(container, sessionId, actor);
        const lastEventIdStr = ws.data.query.lastEventId;
        const lastEventId = lastEventIdStr !== undefined ? parseInt(lastEventIdStr, 10) : NaN;

        // 短线重连：ring buffer 能覆盖缺口时按可见性补发
        if (!isNaN(lastEventId) && eventRingBuffer.hasSequencedEventsFrom(sessionId, lastEventId)) {
          for (const { event, visibility } of eventRingBuffer.getEventsFrom(sessionId, lastEventId)) {
            if (checkVisibility(actor, claimedCharacterId, visibility, connectionId)) {
              ws.send(JSON.stringify(event));
            }
          }
        } else {
          // 首次加入或日志缺口：全量快照（已按请求者可见性裁剪）
          const snapshot = await snapshotBuilder.execute({
            sessionId,
            actor,
            claimedCharacterId,
            connectionId,
          });
          const snapshotMessage: SessionSnapshot = {
            protocolVersion: 1,
            type: "snapshot",
            watermark: snapshot.session.lastEventId,
            payload: snapshot,
          };
          ws.send(JSON.stringify(snapshotMessage));

          // 刷出快照水位之后的缓冲事件
          for (const { event, visibility } of eventRingBuffer.getEvents(sessionId)) {
            if (
              event.eventId > snapshot.session.lastEventId &&
              checkVisibility(actor, claimedCharacterId, visibility, connectionId)
            ) {
              ws.send(JSON.stringify(event));
            }
          }
        }

        // 快照/补发期间不加入广播注册表，避免实时事件插入快照序列中间；
        // 快照水位之后的事件已由上面的 ring-buffer 刷新覆盖。
        connectionRegistry.register(connection);

        await presenceService.broadcast(sessionId);
      },
      async message(ws, message) {
        const actor = ws.data.actor;
        const connectionId = (ws.data as Record<string, unknown>).connectionId as string | undefined;
        if (!actor || !connectionId) {
          return;
        }
        const sessionId = ws.data.params.id;

        const raw = typeof message === "string" ? message : JSON.stringify(message);
        if (raw === "ping") {
          ws.send("pong");
          return;
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(raw);
        } catch {
          return;
        }
        if (
          parsedJson &&
          typeof parsedJson === "object" &&
          (parsedJson as Record<string, unknown>).type === "ping"
        ) {
          ws.send(JSON.stringify({ protocolVersion: 1, type: "pong", payload: {} }));
          return;
        }

        const parsed = ClientCommand.safeParse(parsedJson);
        if (!parsed.success) {
          return;
        }

        // 命令限速：超过窗口配额直接拒绝，不进入串行队列
        const timestamps = (ws.data as Record<string, unknown>).commandTimestamps as number[];
        const now = Date.now();
        while (timestamps.length > 0 && now - (timestamps[0] ?? 0) > RATE_LIMIT_WINDOW_MS) {
          timestamps.shift();
        }
        if (timestamps.length >= RATE_LIMIT_MAX_COMMANDS) {
          ws.send(
            JSON.stringify({
              protocolVersion: 1,
              commandId: parsed.data.commandId,
              type: "command:rejected",
              payload: { code: "RATE_LIMITED", message: "Too many commands" },
            })
          );
          return;
        }
        timestamps.push(now);

        const reply = await sessionCommandExecutor.execute(sessionId, actor, parsed.data, connectionId);
        ws.send(JSON.stringify(reply));
      },
      async close(ws) {
        const connectionId = (ws.data as Record<string, unknown>).connectionId as string | undefined;
        if (connectionId) {
          connectionRegistry.unregister(connectionId);
          await presenceService.broadcast(ws.data.params.id);
        }
      },
    });
}

async function hasObClaim(container: Container, sessionId: string, playerId: string): Promise<boolean> {
  const rows = await container.db
    .select({ id: sessionClaims.id })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt)
      )
    );
  return rows.length > 0;
}
