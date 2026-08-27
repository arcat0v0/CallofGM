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
import { ClientCommand, type CommandReply, type SessionSnapshot } from "@cogm/shared";
import { checkVisibility } from "../domain/visibility";
import { logger } from "@/platform/logging/logger";

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

function parseLastEventId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
}

function rejectCommand(ws: { send: (data: string) => void }, commandId: string, code: string, message: string): void {
  const reply: CommandReply = {
    protocolVersion: 1,
    commandId,
    type: "command:rejected",
    payload: { code, message },
  };
  ws.send(JSON.stringify(reply));
}

export function createRealtimeRoutes(container: Container) {
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const authPlugin = createAuthPlugin(identityRepo);
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
          state: "hydrating" as const,
          hydrateBuffer: [],
        };

        const claimedCharacterId = await resolveClaimedCharacterId(container, sessionId, actor);
        const lastEventId = parseLastEventId(ws.data.query.lastEventId);

        connectionRegistry.register(connection);

        try {
          let watermark = lastEventId ?? -1;
          if (lastEventId !== null && eventRingBuffer.hasSequencedEventsFrom(sessionId, lastEventId)) {
            for (const { event, visibility } of eventRingBuffer.getEventsFrom(sessionId, lastEventId)) {
              if (checkVisibility(actor, claimedCharacterId, visibility, connectionId)) {
                ws.send(JSON.stringify(event));
              }
            }
          } else {
            const snapshot = await sessionCommandExecutor.runExclusive(sessionId, () =>
              snapshotBuilder.execute({
                sessionId,
                actor,
                claimedCharacterId,
                connectionId,
              })
            );
            const snapshotMessage: SessionSnapshot = {
              protocolVersion: 1,
              type: "snapshot",
              watermark: snapshot.session.lastEventId,
              payload: snapshot,
            };
            ws.send(JSON.stringify(snapshotMessage));
            watermark = snapshot.session.lastEventId;
          }

          const buffered = connectionRegistry.markActive(connectionId);
          for (const { event, visibility } of buffered) {
            if (event.eventId > watermark && checkVisibility(actor, claimedCharacterId, visibility, connectionId)) {
              ws.send(JSON.stringify(event));
            }
          }

          await presenceService.broadcast(sessionId);
        } catch (error) {
          logger.error("ws.hydrate.failed", { error: error instanceof Error ? error.message : String(error) });
          connectionRegistry.unregister(connectionId);
          ws.close();
        }
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
          rejectCommand(ws, "invalid", "VALIDATION_FAILED", "Invalid command");
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
          const commandId =
            parsedJson && typeof parsedJson === "object" && typeof (parsedJson as { commandId?: unknown }).commandId === "string"
              ? (parsedJson as { commandId: string }).commandId
              : "invalid";
          rejectCommand(ws, commandId, "VALIDATION_FAILED", "Invalid command");
          return;
        }

        const timestamps = (ws.data as Record<string, unknown>).commandTimestamps as number[];
        const now = Date.now();
        while (timestamps.length > 0 && now - (timestamps[0] ?? 0) > RATE_LIMIT_WINDOW_MS) {
          timestamps.shift();
        }
        if (timestamps.length >= RATE_LIMIT_MAX_COMMANDS) {
          rejectCommand(ws, parsed.data.commandId, "RATE_LIMITED", "Too many commands");
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
        isNull(sessionClaims.releasedAt),
        isNull(sessionClaims.characterId)
      )
    );
  return rows.length > 0;
}
