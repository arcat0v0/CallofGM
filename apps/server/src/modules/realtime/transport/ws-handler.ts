import {
	ClientCommand,
	type CommandReply,
	type SessionKickedMessage,
	type SessionSnapshot,
	VoiceClientMessage,
	VoiceServerMessage,
} from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import {
	AuthRequiredError,
	ForbiddenError,
	holderOfActor,
	requireSeatHolder,
} from "@/modules/identity";
import type { SeatHolderInput } from "@/modules/sessions";
import { SessionNotFoundError } from "@/modules/sessions";
import { logger } from "@/platform/logging/logger";
import { checkVisibility } from "../domain/visibility";

const RATE_LIMIT_WINDOW_MS = 5_000;
const RATE_LIMIT_MAX_COMMANDS = 50;
const VOICE_RATE_LIMIT_MAX_SIGNALS = 256;
const KICKED_CLOSE_CODE = 4000;

interface KickNotice {
	reason: string | null;
	createdAt: number;
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

function rejectCommand(
	ws: { send: (data: string) => void },
	commandId: string,
	code: string,
	message: string,
): void {
	const reply: CommandReply = {
		protocolVersion: 1,
		commandId,
		type: "command:rejected",
		payload: { code, message },
	};
	ws.send(JSON.stringify(reply));
}

export function createRealtimeRoutes(container: Container) {
	const { authPlugin, sessionsRepo } = container;
	const {
		connectionRegistry,
		eventRingBuffer,
		sessionCommandExecutor,
		presenceService,
		snapshotBuilder,
	} = container;

	return new Elysia().use(authPlugin).ws("/api/v1/sessions/:id/ws", {
		idleTimeout: 30,
		async beforeHandle(context) {
			const {
				actor,
				params: { id },
			} = context;
			if (!actor) {
				throw new AuthRequiredError();
			}

			const session = await snapshotBuilder.findSessionOrNull(id);
			if (!session) {
				throw new SessionNotFoundError();
			}

			if (actor.type === "user" && actor.role === "gm") {
				return;
			}
			const holder = requireSeatHolder(actor);
			const kick = await sessionsRepo.findActiveSessionKick(id, holder);
			if (kick) {
				Object.assign(context, { kick, holder });
				return;
			}
			const claim = await sessionsRepo.findActiveClaimByHolder(id, holder);
			Object.assign(context, { holder });
			if (!claim) {
				throw new ForbiddenError("No active claim in this session");
			}
		},
		async open(ws) {
			const sessionId = ws.data.params.id;
			const actor = ws.data.actor;
			if (!actor) {
				ws.close();
				return;
			}

			const kick = (ws.data as Record<string, unknown>).kick as
				| KickNotice
				| undefined;
			if (kick) {
				const payload: SessionKickedMessage = {
					code: "SESSION_KICKED",
					reason: kick.reason,
					createdAt: kick.createdAt,
				};
				ws.send(
					JSON.stringify({
						protocolVersion: 1,
						type: "session:kicked",
						payload,
					}),
				);
				setTimeout(() => {
					try {
						ws.close(KICKED_CLOSE_CODE, "kicked");
					} catch {}
				}, 0);
				return;
			}

			const connectionId = crypto.randomUUID();
			(ws.data as Record<string, unknown>).connectionId = connectionId;
			(ws.data as Record<string, unknown>).commandTimestamps = [] as number[];
			(ws.data as Record<string, unknown>).voiceSignalTimestamps =
				[] as number[];

			const holder: SeatHolderInput | null =
				actor.type === "user" && actor.role === "gm"
					? null
					: holderOfActor(actor);

			const connection = {
				connectionId,
				ws: {
					send: (data: string) => ws.send(data),
					close: (code?: number, reason?: string) => {
						const raw = (
							ws as unknown as {
								raw?: { close(code?: number, reason?: string): void };
							}
						).raw;
						if (raw?.close) {
							raw.close(code, reason);
						} else {
							ws.close(code, reason);
						}
					},
				},
				sessionId,
				holderKind: holder?.holderKind ?? ("user" as const),
				holderId: holder
					? holder.holderKind === "user"
						? holder.userId!
						: holder.playerId!
					: actor.type === "user"
						? actor.userId
						: "",
				playerId: holder?.playerId ?? null,
				userId: holder?.userId ?? (actor.type === "user" ? actor.userId : null),
				actor,
				state: "hydrating" as const,
				hydrateBuffer: [],
			};

			const claimedCharacterId = holder
				? ((await sessionsRepo.findActiveClaimByHolder(sessionId, holder))
						?.characterId ?? null)
				: null;
			const lastEventId = parseLastEventId(ws.data.query.lastEventId);

			connectionRegistry.register(connection);

			try {
				let watermark = lastEventId ?? -1;
				if (
					lastEventId !== null &&
					eventRingBuffer.hasSequencedEventsFrom(sessionId, lastEventId)
				) {
					for (const { event, visibility } of eventRingBuffer.getEventsFrom(
						sessionId,
						lastEventId,
					)) {
						if (
							checkVisibility(
								actor,
								claimedCharacterId,
								visibility,
								connectionId,
							)
						) {
							ws.send(JSON.stringify({ ...event, replayed: true }));
						}
					}
					if (actor.type === "user" && actor.role === "gm") {
						const [queueMessages, discardedMessages] = await Promise.all([
							snapshotBuilder.listPendingQueue(sessionId),
							snapshotBuilder.listDiscardedQueue(sessionId),
						]);
						ws.send(
							JSON.stringify({
								protocolVersion: 1,
								type: "chat:queue",
								payload: {
									messages: queueMessages,
									discarded: discardedMessages,
								},
							}),
						);
					}
				} else {
					const snapshot = await sessionCommandExecutor.runExclusive(
						sessionId,
						() =>
							snapshotBuilder.execute({
								sessionId,
								actor,
								claimedCharacterId,
								connectionId,
							}),
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
					if (
						event.eventId > watermark &&
						checkVisibility(actor, claimedCharacterId, visibility, connectionId)
					) {
						ws.send(JSON.stringify(event));
					}
				}

				await container.voiceService.sendInitialState(connection);

				await presenceService.broadcast(sessionId);
			} catch (error) {
				logger.error("ws.hydrate.failed", {
					error: error instanceof Error ? error.message : String(error),
				});
				connectionRegistry.unregister(connectionId);
				ws.close();
			}
		},
		async message(ws, message) {
			const actor = ws.data.actor;
			const connectionId = (ws.data as Record<string, unknown>).connectionId as
				| string
				| undefined;
			if (!actor || !connectionId) {
				return;
			}
			const sessionId = ws.data.params.id;

			const raw =
				typeof message === "string" ? message : JSON.stringify(message);
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
				ws.send(
					JSON.stringify({ protocolVersion: 1, type: "pong", payload: {} }),
				);
				return;
			}

			if (
				parsedJson &&
				typeof parsedJson === "object" &&
				"type" in parsedJson &&
				typeof parsedJson.type === "string" &&
				parsedJson.type.startsWith("voice:")
			) {
				const rawRequestId =
					"requestId" in parsedJson ? parsedJson.requestId : undefined;
				const requestId =
					typeof rawRequestId === "string" &&
					rawRequestId.length >= 1 &&
					rawRequestId.length <= 128
						? rawRequestId
						: "invalid";
				const voiceMessage = VoiceClientMessage.safeParse(parsedJson);
				const isSignal =
					voiceMessage.success && voiceMessage.data.type === "voice:signal";
				const socketData = ws.data as Record<string, unknown>;
				const timestamps = (
					isSignal
						? socketData.voiceSignalTimestamps
						: socketData.commandTimestamps
				) as number[];
				const limit = isSignal
					? VOICE_RATE_LIMIT_MAX_SIGNALS
					: RATE_LIMIT_MAX_COMMANDS;
				const now = Date.now();
				while (
					timestamps.length > 0 &&
					now - (timestamps[0] ?? 0) > RATE_LIMIT_WINDOW_MS
				) {
					timestamps.shift();
				}
				if (timestamps.length >= limit) {
					ws.send(
						JSON.stringify(
							VoiceServerMessage.parse({
								protocolVersion: 1,
								type: "voice:reply",
								payload: { requestId, ok: false, code: "VOICE_RATE_LIMITED" },
							}),
						),
					);
					return;
				}
				timestamps.push(now);
				if (!voiceMessage.success) {
					ws.send(
						JSON.stringify(
							VoiceServerMessage.parse({
								protocolVersion: 1,
								type: "voice:reply",
								payload: { requestId, ok: false, code: "VALIDATION_FAILED" },
							}),
						),
					);
					return;
				}
				const connection = connectionRegistry.getConnection(connectionId);
				if (!connection || connection.state !== "active") {
					ws.send(
						JSON.stringify(
							VoiceServerMessage.parse({
								protocolVersion: 1,
								type: "voice:reply",
								payload: { requestId, ok: false, code: "VOICE_NOT_READY" },
							}),
						),
					);
					return;
				}
				await container.voiceService.handle(connection, voiceMessage.data);
				return;
			}

			const parsed = ClientCommand.safeParse(parsedJson);
			if (!parsed.success) {
				const commandId =
					parsedJson &&
					typeof parsedJson === "object" &&
					typeof (parsedJson as { commandId?: unknown }).commandId === "string"
						? (parsedJson as { commandId: string }).commandId
						: "invalid";
				rejectCommand(ws, commandId, "VALIDATION_FAILED", "Invalid command");
				return;
			}

			const timestamps = (ws.data as Record<string, unknown>)
				.commandTimestamps as number[];
			const now = Date.now();
			while (
				timestamps.length > 0 &&
				now - (timestamps[0] ?? 0) > RATE_LIMIT_WINDOW_MS
			) {
				timestamps.shift();
			}
			if (timestamps.length >= RATE_LIMIT_MAX_COMMANDS) {
				rejectCommand(
					ws,
					parsed.data.commandId,
					"RATE_LIMITED",
					"Too many commands",
				);
				return;
			}
			timestamps.push(now);

			const reply = await sessionCommandExecutor.execute(
				sessionId,
				actor,
				parsed.data,
				connectionId,
			);
			ws.send(JSON.stringify(reply));
		},
		async close(ws) {
			const connectionId = (ws.data as Record<string, unknown>).connectionId as
				| string
				| undefined;
			if (connectionId) {
				connectionRegistry.unregister(connectionId);
				await presenceService.broadcast(ws.data.params.id);
			}
		},
	});
}
