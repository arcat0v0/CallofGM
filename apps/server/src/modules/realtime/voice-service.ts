import { createHmac } from "node:crypto";
import {
	type VoiceClientMessage,
	type VoiceIceServer,
	type VoiceMember,
	VoiceServerMessage,
	type VoiceState,
} from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { Env } from "@/config/env";
import type { ActorContext } from "@/modules/identity";
import type { DbClient } from "@/platform/db/client";
import {
	sessionCharacters,
	sessionClaims,
	sessionKicks,
	sessions,
	users,
} from "@/platform/db/schema";
import type {
	ActiveConnection,
	ConnectionRegistry,
} from "./connection-registry";

interface RuntimeVoiceMember {
	id: string;
	connectionId: string;
	claimId: string;
	name: string;
	role: "gm" | "pc" | "ob";
	iceServers: VoiceIceServer[];
}

interface VoiceModeration {
	speakGranted: boolean;
	muted: boolean;
}

interface VoiceRoom {
	id: string;
	members: Map<string, RuntimeVoiceMember>;
	moderation: Map<string, VoiceModeration>;
}

interface VoiceIdentity {
	claimId: string;
	name: string;
	role: "gm" | "pc" | "ob";
	canManage: boolean;
}

interface VoiceSession {
	id: string;
	ownerId: string;
	status: string;
	phase: string;
	voiceLimit: number | null;
}

export class VoiceService {
	private rooms = new Map<string, VoiceRoom>();
	private queues = new Map<string, Promise<unknown>>();

	constructor(
		private readonly db: DbClient,
		private readonly connectionRegistry: ConnectionRegistry,
		private readonly env: Env,
	) {
		this.connectionRegistry.onUnregister((connection) => {
			const room = this.rooms.get(connection.sessionId);
			if (!room?.members.delete(connection.connectionId)) return;
			void this.enqueue(connection.sessionId, () =>
				this.broadcast(connection.sessionId),
			).catch(() => undefined);
		});
	}

	async sendInitialState(connection: ActiveConnection): Promise<void> {
		await this.enqueue(connection.sessionId, async () => {
			const current = this.connectionRegistry.getConnection(
				connection.connectionId,
			);
			if (current?.state === "active") await this.sendState(current);
		});
	}

	async handle(
		connection: ActiveConnection,
		message: VoiceClientMessage,
	): Promise<void> {
		await this.enqueue(connection.sessionId, async () => {
			const current = this.connectionRegistry.getConnection(
				connection.connectionId,
			);
			if (current?.state !== "active") return;
			try {
				switch (message.type) {
					case "voice:join":
						await this.join(current, message.requestId, message.payload.roomId);
						break;
					case "voice:leave":
						this.rooms
							.get(current.sessionId)
							?.members.delete(current.connectionId);
						this.reply(current, message.requestId, true);
						await this.broadcast(current.sessionId);
						break;
					case "voice:configure":
						await this.configure(current, message.requestId, message.payload);
						break;
					case "voice:moderate":
						await this.moderate(current, message.requestId, message.payload);
						break;
					case "voice:signal":
						this.signal(current, message.requestId, message.payload);
						break;
				}
			} catch (error) {
				this.reply(
					current,
					message.requestId,
					false,
					error instanceof VoiceError ? error.code : "VOICE_INTERNAL_ERROR",
				);
			}
		});
	}

	async refreshSession(sessionId: string): Promise<void> {
		await this.enqueue(sessionId, async () => {
			const [session] = await this.db
				.select({
					id: sessions.id,
					ownerId: sessions.ownerId,
					status: sessions.status,
					phase: sessions.phase,
					voiceLimit: sessions.voiceLimit,
				})
				.from(sessions)
				.where(eq(sessions.id, sessionId))
				.limit(1);
			const room = this.rooms.get(sessionId);
			if (!session || session.status === "ended") {
				this.rooms.delete(sessionId);
			} else if (room) {
				const claims = await this.db
					.select({
						id: sessionClaims.id,
						userId: sessionClaims.userId,
						playerId: sessionClaims.playerId,
					})
					.from(sessionClaims)
					.where(
						and(
							eq(sessionClaims.sessionId, sessionId),
							isNull(sessionClaims.releasedAt),
						),
					);
				const activeClaims = new Set(claims.map((claim) => claim.id));
				const kicks = await this.db
					.select({
						userId: sessionKicks.userId,
						playerId: sessionKicks.playerId,
					})
					.from(sessionKicks)
					.where(
						and(
							eq(sessionKicks.sessionId, sessionId),
							isNull(sessionKicks.liftedAt),
						),
					);
				for (const claim of claims) {
					if (
						kicks.some(
							(kick) =>
								(claim.userId !== null && kick.userId === claim.userId) ||
								(claim.playerId !== null && kick.playerId === claim.playerId),
						)
					) {
						activeClaims.delete(claim.id);
					}
				}
				for (const claimId of room.moderation.keys()) {
					if (!claimId.startsWith("gm:") && !activeClaims.has(claimId)) {
						room.moderation.delete(claimId);
					}
				}
				for (const [connectionId, member] of room.members) {
					const connection =
						this.connectionRegistry.getConnection(connectionId);
					const valid =
						connection &&
						(member.role === "gm"
							? connection.actor.type === "user" &&
								connection.actor.userId === session.ownerId
							: activeClaims.has(member.claimId));
					if (!valid) {
						room.members.delete(connectionId);
						room.moderation.delete(member.claimId);
					}
				}
			}
			await this.broadcast(sessionId);
		});
	}

	private async join(
		connection: ActiveConnection,
		requestId: string,
		roomId: string,
	): Promise<void> {
		const { session, identity } = await this.requireIdentity(connection);
		if (
			this.connectionRegistry.getConnection(connection.connectionId) !==
				connection ||
			connection.state !== "active"
		) {
			throw new VoiceError("VOICE_NOT_READY");
		}
		const room = this.rooms.get(connection.sessionId);
		if (!room || room.id !== roomId) throw new VoiceError("VOICE_ROOM_CHANGED");
		if (session.status !== "preparing" && session.status !== "active") {
			throw new VoiceError("VOICE_UNAVAILABLE");
		}
		for (const member of room.members.values()) {
			if (member.claimId === identity.claimId) {
				throw new VoiceError("VOICE_DUPLICATE_TAB");
			}
		}
		const limit = this.effectiveLimit(session);
		if (
			identity.role !== "gm" &&
			[...room.members.values()].filter((member) => member.role !== "gm")
				.length >=
				limit - 1
		) {
			throw new VoiceError("VOICE_FULL");
		}
		const member: RuntimeVoiceMember = {
			id: crypto.randomUUID(),
			connectionId: connection.connectionId,
			claimId: identity.claimId,
			name: identity.name,
			role: identity.role,
			iceServers: this.iceServers(),
		};
		room.members.set(connection.connectionId, member);
		if (!room.moderation.has(member.claimId)) {
			room.moderation.set(member.claimId, {
				speakGranted: member.role !== "ob",
				muted: false,
			});
		}
		this.reply(connection, requestId, true);
		await this.broadcast(connection.sessionId);
	}

	private async configure(
		connection: ActiveConnection,
		requestId: string,
		payload: { enabled: boolean } | { limit: number },
	): Promise<void> {
		const { session, identity } = await this.requireIdentity(connection);
		if (!identity.canManage) throw new VoiceError("VOICE_FORBIDDEN");
		if (session.status !== "preparing" && session.status !== "active") {
			throw new VoiceError("VOICE_UNAVAILABLE");
		}
		if ("enabled" in payload) {
			if (payload.enabled) {
				if (!this.rooms.has(connection.sessionId)) {
					this.rooms.set(connection.sessionId, {
						id: crypto.randomUUID(),
						members: new Map(),
						moderation: new Map(),
					});
				}
			} else {
				this.rooms.delete(connection.sessionId);
			}
		} else {
			if (this.rooms.has(connection.sessionId)) {
				throw new VoiceError("VOICE_LIMIT_LOCKED");
			}
			if (payload.limit > this.env.VOICE_MAX_PARTICIPANTS) {
				throw new VoiceError("VOICE_LIMIT_INVALID");
			}
			await this.db
				.update(sessions)
				.set({ voiceLimit: payload.limit })
				.where(eq(sessions.id, connection.sessionId));
		}
		this.reply(connection, requestId, true);
		await this.broadcast(connection.sessionId);
	}

	private async moderate(
		connection: ActiveConnection,
		requestId: string,
		payload:
			| { memberId: string; speakGranted: boolean }
			| { memberId: string; muted: boolean },
	): Promise<void> {
		const { identity } = await this.requireIdentity(connection);
		if (!identity.canManage) throw new VoiceError("VOICE_FORBIDDEN");
		const room = this.rooms.get(connection.sessionId);
		const target = [...(room?.members.values() ?? [])].find(
			(member) => member.id === payload.memberId,
		);
		if (!room || !target || target.role === "gm") {
			throw new VoiceError("VOICE_TARGET_NOT_FOUND");
		}
		if ("speakGranted" in payload && target.role !== "ob") {
			throw new VoiceError("VOICE_INVALID_MODERATION");
		}
		const moderation = room.moderation.get(target.claimId) ?? {
			speakGranted: target.role !== "ob",
			muted: false,
		};
		if ("speakGranted" in payload) {
			moderation.speakGranted = payload.speakGranted;
		} else {
			moderation.muted = payload.muted;
		}
		room.moderation.set(target.claimId, moderation);
		this.reply(connection, requestId, true);
		await this.broadcast(connection.sessionId);
	}

	private signal(
		connection: ActiveConnection,
		requestId: string,
		payload: Extract<VoiceClientMessage, { type: "voice:signal" }>["payload"],
	): void {
		const room = this.rooms.get(connection.sessionId);
		const source = room?.members.get(connection.connectionId);
		const target = [...(room?.members.values() ?? [])].find(
			(member) => member.id === payload.toMemberId,
		);
		if (!room || !source) throw new VoiceError("VOICE_NOT_JOINED");
		if (!target) throw new VoiceError("VOICE_TARGET_NOT_FOUND");
		const destination = this.connectionRegistry.getConnection(
			target.connectionId,
		);
		if (destination?.state !== "active") {
			throw new VoiceError("VOICE_TARGET_NOT_FOUND");
		}
		this.send(destination, {
			protocolVersion: 1,
			type: "voice:signal",
			payload: { fromMemberId: source.id, signal: payload.signal },
		});
		this.reply(connection, requestId, true);
	}

	private async broadcast(sessionId: string): Promise<void> {
		const connections = this.connectionRegistry
			.getConnectionsBySession(sessionId)
			.filter((connection) => connection.state === "active");
		await Promise.all(
			connections.map((connection) => this.sendState(connection)),
		);
	}

	private async sendState(connection: ActiveConnection): Promise<void> {
		const { session, identity } = await this.resolveIdentity(connection);
		if (!session || !identity) {
			this.send(connection, {
				protocolVersion: 1,
				type: "voice:state",
				payload: {
					enabled: false,
					available: false,
					limit: this.env.VOICE_MAX_PARTICIPANTS,
					maxLimit: this.env.VOICE_MAX_PARTICIPANTS,
					selfId: null,
					members: [],
					memberCount: 0,
					iceServers: [],
					roomId: null,
					canManage: false,
				},
			});
			return;
		}
		const room = this.rooms.get(connection.sessionId);
		const self = room?.members.get(connection.connectionId);
		const members = room
			? [...room.members.values()].map((member) =>
					this.publicMember(room, session, member),
				)
			: [];
		const state: VoiceState = {
			enabled: room !== undefined,
			available: session.status === "preparing" || session.status === "active",
			limit: this.effectiveLimit(session),
			maxLimit: this.env.VOICE_MAX_PARTICIPANTS,
			selfId: self?.id ?? null,
			members: identity.canManage || self ? members : [],
			memberCount: room?.members.size ?? 0,
			iceServers: self?.iceServers ?? [],
			roomId: room?.id ?? null,
			canManage: identity.canManage,
		};
		this.send(connection, {
			protocolVersion: 1,
			type: "voice:state",
			payload: state,
		});
	}

	private publicMember(
		room: VoiceRoom,
		session: VoiceSession,
		member: RuntimeVoiceMember,
	): VoiceMember {
		const moderation = room.moderation.get(member.claimId) ?? {
			speakGranted: member.role !== "ob",
			muted: false,
		};
		const phaseAllows =
			member.role === "gm" ||
			session.status === "preparing" ||
			session.phase === "free_discussion" ||
			session.phase === "free_performance";
		return {
			id: member.id,
			name: member.name,
			role: member.role,
			canSpeak: phaseAllows && moderation.speakGranted && !moderation.muted,
			speakGranted: moderation.speakGranted,
			muted: moderation.muted,
		};
	}

	private effectiveLimit(session: VoiceSession): number {
		return Math.min(
			session.voiceLimit ?? this.env.VOICE_MAX_PARTICIPANTS,
			this.env.VOICE_MAX_PARTICIPANTS,
		);
	}

	private iceServers(): VoiceIceServer[] {
		const result: VoiceIceServer[] = [];
		if (this.env.VOICE_STUN_URLS.length > 0) {
			result.push({ urls: this.env.VOICE_STUN_URLS });
		}
		const secret = this.env.VOICE_TURN_REST_SECRET;
		if (secret && this.env.VOICE_TURN_URLS.length > 0) {
			const expires =
				Math.floor(Date.now() / 1000) + this.env.VOICE_TURN_TTL_SECONDS;
			const username = `${expires}:${crypto.randomUUID()}`;
			result.push({
				urls: this.env.VOICE_TURN_URLS,
				username,
				credential: createHmac("sha1", secret)
					.update(username)
					.digest("base64"),
			});
		}
		return result;
	}

	private async requireIdentity(connection: ActiveConnection): Promise<{
		session: VoiceSession;
		identity: VoiceIdentity;
	}> {
		const resolved = await this.resolveIdentity(connection);
		if (!resolved.session || !resolved.identity)
			throw new VoiceError("VOICE_FORBIDDEN");
		return { session: resolved.session, identity: resolved.identity };
	}

	private async resolveIdentity(connection: ActiveConnection): Promise<{
		session: VoiceSession | null;
		identity: VoiceIdentity | null;
	}> {
		const [session] = await this.db
			.select({
				id: sessions.id,
				ownerId: sessions.ownerId,
				status: sessions.status,
				phase: sessions.phase,
				voiceLimit: sessions.voiceLimit,
			})
			.from(sessions)
			.where(eq(sessions.id, connection.sessionId))
			.limit(1);
		if (!session) return { session: null, identity: null };
		const actor: ActorContext = connection.actor;
		if (actor.type === "user" && actor.role === "gm") {
			if (actor.userId !== session.ownerId) return { session, identity: null };
			const [user] = await this.db
				.select({ username: users.username })
				.from(users)
				.where(eq(users.id, actor.userId))
				.limit(1);
			return {
				session,
				identity: {
					claimId: `gm:${actor.userId}`,
					name: user?.username ?? "GM",
					role: "gm",
					canManage: true,
				},
			};
		}
		if (actor.type === "user" && actor.role !== "pl") {
			return { session, identity: null };
		}
		const holderCondition =
			actor.type === "user"
				? eq(sessionClaims.userId, actor.userId)
				: eq(sessionClaims.playerId, actor.playerId);
		const [claim] = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, connection.sessionId),
					holderCondition,
					isNull(sessionClaims.releasedAt),
				),
			)
			.limit(1);
		if (!claim) return { session, identity: null };
		let name = "Observer";
		if (claim.characterId) {
			const [character] = await this.db
				.select({ name: sessionCharacters.name })
				.from(sessionCharacters)
				.where(
					and(
						eq(sessionCharacters.sessionId, connection.sessionId),
						eq(sessionCharacters.characterId, claim.characterId),
					),
				)
				.limit(1);
			name = character?.name ?? name;
		} else if (actor.type === "user") {
			const [user] = await this.db
				.select({ username: users.username })
				.from(users)
				.where(eq(users.id, actor.userId))
				.limit(1);
			name = user?.username ?? name;
		}
		if (actor.type === "player") name = `观战 ${actor.playerId.slice(0, 8)}`;
		return {
			session,
			identity: {
				claimId: claim.id,
				name,
				role: claim.role === "pc" ? "pc" : "ob",
				canManage: false,
			},
		};
	}

	private reply(
		connection: ActiveConnection,
		requestId: string,
		ok: true,
	): void;
	private reply(
		connection: ActiveConnection,
		requestId: string,
		ok: false,
		code: string,
	): void;
	private reply(
		connection: ActiveConnection,
		requestId: string,
		ok: boolean,
		code?: string,
	): void {
		this.send(connection, {
			protocolVersion: 1,
			type: "voice:reply",
			payload: ok
				? { requestId, ok: true }
				: { requestId, ok: false, code: code ?? "VOICE_INTERNAL_ERROR" },
		});
	}

	private send(connection: ActiveConnection, message: unknown): void {
		if (
			this.connectionRegistry.getConnection(connection.connectionId) !==
				connection ||
			connection.state !== "active"
		) {
			return;
		}
		const serialized = JSON.stringify(VoiceServerMessage.parse(message));
		try {
			connection.ws.send(serialized);
		} catch {}
	}

	private async enqueue<T>(
		sessionId: string,
		work: () => Promise<T>,
	): Promise<T> {
		const previous = this.queues.get(sessionId) ?? Promise.resolve();
		const result = previous.catch(() => undefined).then(work);
		this.queues.set(sessionId, result);
		const cleanup = () => {
			if (this.queues.get(sessionId) === result) this.queues.delete(sessionId);
		};
		void result.then(cleanup, cleanup);
		return result;
	}
}

class VoiceError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}
