import { createHmac } from "node:crypto";
import {
	type VoiceClientMessage,
	type VoiceIceServer,
	type VoiceMember,
	VoiceServerMessage,
	type VoiceState,
} from "@cogm/shared";
import type { Env } from "@/config/env";
import { type ActorContext, holderKey, holderOf } from "@/modules/identity";
import { SessionLifecycle } from "@/modules/sessions";
import type { VoiceSession, VoiceSessionStore } from "./application/ports";
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

export class VoiceService {
	private rooms = new Map<string, VoiceRoom>();
	private queues = new Map<string, Promise<unknown>>();

	constructor(
		private readonly store: VoiceSessionStore,
		private readonly connectionRegistry: ConnectionRegistry,
		private readonly env: Env,
	) {
		this.connectionRegistry.onUnregister((connection) => {
			if (!this.removeMember(connection.sessionId, connection.connectionId))
				return;
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
			if (current?.state !== "active") return;
			const session = await this.store.loadSession(
				current.sessionId,
				this.claimHolder(current.actor) ?? "none",
			);
			this.sendStates(current.sessionId, [current], session);
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
						this.removeMember(current.sessionId, current.connectionId);
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
			const session = await this.store.loadSession(sessionId);
			const room = this.rooms.get(sessionId);
			if (!session || new SessionLifecycle(session).isEnded()) {
				this.rooms.delete(sessionId);
			} else if (room) {
				const activeClaims = new Set<string>();
				for (const claim of session.claims) {
					if (!claim.kicked) activeClaims.add(claim.id);
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
							? this.isOwnerGm(connection.actor, session)
							: activeClaims.has(member.claimId));
					if (!valid) {
						room.members.delete(connectionId);
						room.moderation.delete(member.claimId);
					}
				}
			}
			await this.broadcast(sessionId, session);
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
		if (!new SessionLifecycle(session).isVoiceAvailable()) {
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
		if (!new SessionLifecycle(session).isVoiceAvailable()) {
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
			await this.store.setVoiceLimit(connection.sessionId, payload.limit);
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

	private async broadcast(
		sessionId: string,
		session?: VoiceSession | null,
	): Promise<void> {
		const connections = this.connectionRegistry
			.getConnectionsBySession(sessionId)
			.filter((connection) => connection.state === "active");
		if (connections.length === 0) return;
		const snapshot =
			session === undefined ? await this.store.loadSession(sessionId) : session;
		this.sendStates(sessionId, connections, snapshot);
	}

	private sendStates(
		sessionId: string,
		connections: ActiveConnection[],
		session: VoiceSession | null,
	): void {
		const unavailable: VoiceState = {
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
		};
		if (!session) {
			for (const connection of connections) {
				this.sendVoiceState(connection, unavailable);
			}
			return;
		}
		const claimHolders = new Set<string>();
		for (const claim of session.claims) {
			if (claim.userId !== null) claimHolders.add(`user:${claim.userId}`);
			if (claim.playerId !== null) claimHolders.add(`player:${claim.playerId}`);
		}
		const lifecycle = new SessionLifecycle(session);
		const room = this.rooms.get(sessionId);
		const members: VoiceMember[] = [];
		if (room) {
			for (const member of room.members.values()) {
				members.push(this.publicMember(room, lifecycle, member));
			}
		}
		const shared: VoiceState = {
			...unavailable,
			enabled: room !== undefined,
			available: lifecycle.isVoiceAvailable(),
			limit: this.effectiveLimit(session),
			memberCount: room?.members.size ?? 0,
			roomId: room?.id ?? null,
		};
		for (const connection of connections) {
			const canManage = this.isOwnerGm(connection.actor, session);
			const holder = this.claimHolder(connection.actor);
			if (!canManage && (!holder || !claimHolders.has(holderKey(holder)))) {
				this.sendVoiceState(connection, unavailable);
				continue;
			}
			const self = room?.members.get(connection.connectionId);
			this.sendVoiceState(connection, {
				...shared,
				selfId: self?.id ?? null,
				members: canManage || self ? members : shared.members,
				iceServers: self?.iceServers ?? shared.iceServers,
				canManage,
			});
		}
	}

	private sendVoiceState(
		connection: ActiveConnection,
		state: VoiceState,
	): void {
		this.send(connection, {
			protocolVersion: 1,
			type: "voice:state",
			payload: state,
		});
	}

	private publicMember(
		room: VoiceRoom,
		lifecycle: SessionLifecycle,
		member: RuntimeVoiceMember,
	): VoiceMember {
		const moderation = room.moderation.get(member.claimId) ?? {
			speakGranted: member.role !== "ob",
			muted: false,
		};
		return {
			id: member.id,
			name: member.name,
			role: member.role,
			canSpeak: lifecycle.canVoiceSpeak(member.role, moderation),
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
		const actor = connection.actor;
		const session = await this.store.loadSession(
			connection.sessionId,
			this.claimHolder(actor) ?? "none",
		);
		if (!session) throw new VoiceError("VOICE_FORBIDDEN");
		if (this.isOwnerGm(actor, session)) {
			return {
				session,
				identity: {
					claimId: `gm:${session.ownerId}`,
					name: session.ownerName ?? "GM",
					role: "gm",
					canManage: true,
				},
			};
		}
		const claim = session.claims[0];
		if (!claim) throw new VoiceError("VOICE_FORBIDDEN");
		const name =
			actor.type === "player"
				? `观战 ${actor.playerId.slice(0, 8)}`
				: ((claim.characterId ? claim.characterName : claim.username) ??
					"Observer");
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

	private removeMember(sessionId: string, connectionId: string): boolean {
		return this.rooms.get(sessionId)?.members.delete(connectionId) ?? false;
	}

	private claimHolder(actor: ActorContext) {
		return actor.type === "player" || actor.role === "pl"
			? holderOf(actor)
			: null;
	}

	private isOwnerGm(actor: ActorContext, session: VoiceSession): boolean {
		return (
			actor.type === "user" &&
			actor.role === "gm" &&
			actor.userId === session.ownerId
		);
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
