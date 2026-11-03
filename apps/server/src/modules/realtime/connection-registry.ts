import type { SessionEvent } from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { ActorContext } from "@/modules/identity";
import type { DbClient } from "@/platform/db/client";
import { sessionClaims } from "@/platform/db/schema";
import { checkVisibility, type VisibilityScope } from "./domain/visibility";

export interface ActiveConnection {
	connectionId: string;
	ws: { send(data: string): void; close(code?: number, reason?: string): void };
	sessionId: string;
	holderKind: "user" | "anonymous";
	holderId: string;
	playerId: string | null;
	userId: string | null;
	actor: ActorContext;
	state?: "hydrating" | "active";
	hydrateBuffer?: Array<{ event: SessionEvent; visibility: VisibilityScope }>;
}

/**
 * 单进程内存连接注册表。在线状态的唯一事实来源；
 * 不以数据库 lastSeen 冒充实时在线。
 */
export class ConnectionRegistry {
	private connections = new Map<string, ActiveConnection>();
	private bySession = new Map<string, Set<string>>();
	private byPlayer = new Map<string, Set<string>>();
	private byUser = new Map<string, Set<string>>();

	constructor(private readonly db: DbClient) {}

	register(conn: ActiveConnection): void {
		conn.state = conn.state ?? "hydrating";
		conn.hydrateBuffer = conn.hydrateBuffer ?? [];
		this.connections.set(conn.connectionId, conn);

		if (!this.bySession.has(conn.sessionId)) {
			this.bySession.set(conn.sessionId, new Set());
		}
		this.bySession.get(conn.sessionId)!.add(conn.connectionId);

		if (conn.playerId) {
			if (!this.byPlayer.has(conn.playerId)) {
				this.byPlayer.set(conn.playerId, new Set());
			}
			this.byPlayer.get(conn.playerId)!.add(conn.connectionId);
		}
		if (conn.userId) {
			if (!this.byUser.has(conn.userId)) {
				this.byUser.set(conn.userId, new Set());
			}
			this.byUser.get(conn.userId)!.add(conn.connectionId);
		}
	}

	markActive(
		connectionId: string,
	): Array<{ event: SessionEvent; visibility: VisibilityScope }> {
		const conn = this.connections.get(connectionId);
		if (!conn) {
			return [];
		}
		const buffered = conn.hydrateBuffer ?? [];
		conn.hydrateBuffer = [];
		conn.state = "active";
		return buffered;
	}

	unregister(connectionId: string): void {
		const conn = this.connections.get(connectionId);
		if (!conn) return;

		this.connections.delete(connectionId);

		const sessionSet = this.bySession.get(conn.sessionId);
		if (sessionSet) {
			sessionSet.delete(connectionId);
			if (sessionSet.size === 0) {
				this.bySession.delete(conn.sessionId);
			}
		}

		if (conn.playerId) {
			const playerSet = this.byPlayer.get(conn.playerId);
			if (playerSet) {
				playerSet.delete(connectionId);
				if (playerSet.size === 0) {
					this.byPlayer.delete(conn.playerId);
				}
			}
		}

		if (conn.userId) {
			const userSet = this.byUser.get(conn.userId);
			if (userSet) {
				userSet.delete(connectionId);
				if (userSet.size === 0) {
					this.byUser.delete(conn.userId);
				}
			}
		}
	}

	getConnectionsBySession(sessionId: string): ActiveConnection[] {
		const ids = this.bySession.get(sessionId);
		if (!ids) return [];
		const result: ActiveConnection[] = [];
		for (const id of ids) {
			const conn = this.connections.get(id);
			if (conn) {
				result.push(conn);
			}
		}
		return result;
	}

	/** 同一席位持有者多连接的聚合计数，键为 `${holderKind}:${holderId}` */
	countConnectionsByPlayer(sessionId: string): Map<string, number> {
		const counts = new Map<string, number>();
		for (const conn of this.getConnectionsBySession(sessionId)) {
			const key = `${conn.holderKind}:${conn.holderId}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	}

	/** 按可见范围发布团事件：秘密事件逐连接过滤，绝不先全员广播再由前端隐藏。 */
	async publish(
		sessionId: string,
		event: SessionEvent,
		visibility: VisibilityScope,
	): Promise<void> {
		const sessionConnections = this.getConnectionsBySession(sessionId);
		if (sessionConnections.length === 0) {
			return;
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

		const characterByHolder = new Map<string, string>();
		for (const claim of claims) {
			if (!claim.characterId) continue;
			if (claim.userId) {
				characterByHolder.set(`user:${claim.userId}`, claim.characterId);
			}
			if (claim.playerId) {
				characterByHolder.set(`player:${claim.playerId}`, claim.characterId);
			}
		}

		const serialized = JSON.stringify(event);

		for (const conn of sessionConnections) {
			const claimedCharacterId =
				characterByHolder.get(`${conn.holderKind}:${conn.holderId}`) ?? null;

			if (
				checkVisibility(
					conn.actor,
					claimedCharacterId,
					visibility,
					conn.connectionId,
				)
			) {
				if (conn.state === "hydrating") {
					conn.hydrateBuffer = conn.hydrateBuffer ?? [];
					conn.hydrateBuffer.push({ event, visibility });
					continue;
				}
				try {
					conn.ws.send(serialized);
				} catch {
					// 发送失败的连接由 close 流程回收
				}
			}
		}
	}

	/** 向团内所有 GM 连接发送 DirectControlMessage（无 eventId，不进事件日志） */
	sendToGms(
		sessionId: string,
		message: { type: string; payload: unknown },
	): void {
		const serialized = JSON.stringify({
			protocolVersion: 1,
			type: message.type,
			payload: message.payload,
		});
		for (const conn of this.getConnectionsBySession(sessionId)) {
			if (conn.actor.type !== "user" || conn.actor.role !== "gm") continue;
			try {
				conn.ws.send(serialized);
			} catch {
				// 发送失败的连接由 close 流程回收
			}
		}
	}

	sendToSession(
		sessionId: string,
		message: { type: string; payload: unknown },
	): void {
		const serialized = JSON.stringify({
			protocolVersion: 1,
			type: message.type,
			payload: message.payload,
		});
		for (const conn of this.getConnectionsBySession(sessionId)) {
			try {
				conn.ws.send(serialized);
			} catch {
				// 发送失败的连接由 close 流程回收
			}
		}
	}

	/** 仅向某玩家在本团的连接发送 DirectControlMessage */
	sendToPlayer(
		sessionId: string,
		playerId: string,
		message: { type: string; payload: unknown },
	): void {
		const ids = this.byPlayer.get(playerId);
		if (!ids) {
			return;
		}
		const serialized = JSON.stringify({
			protocolVersion: 1,
			type: message.type,
			payload: message.payload,
		});
		for (const connectionId of ids) {
			const conn = this.connections.get(connectionId);
			if (!conn || conn.sessionId !== sessionId) {
				continue;
			}
			try {
				conn.ws.send(serialized);
			} catch {
				// 发送失败的连接由 close 流程回收
			}
		}
	}

	/** 仅向某账号在本团的连接发送 DirectControlMessage */
	sendToUser(
		sessionId: string,
		userId: string,
		message: { type: string; payload: unknown },
	): void {
		const ids = this.byUser.get(userId);
		if (!ids) {
			return;
		}
		const serialized = JSON.stringify({
			protocolVersion: 1,
			type: message.type,
			payload: message.payload,
		});
		for (const connectionId of ids) {
			const conn = this.connections.get(connectionId);
			if (!conn || conn.sessionId !== sessionId) {
				continue;
			}
			try {
				conn.ws.send(serialized);
			} catch {
				// 发送失败的连接由 close 流程回收
			}
		}
	}

	/** 关闭所有活跃连接（优雅退出用） */
	closeAll(code = 1001, reason = "server shutdown"): void {
		for (const conn of [...this.connections.values()]) {
			try {
				conn.ws.close(code, reason);
			} catch {
				// 忽略已断开的连接
			}
		}
		this.connections.clear();
		this.bySession.clear();
		this.byPlayer.clear();
		this.byUser.clear();
	}

	/** 关闭某用户会话的全部连接（新登录顶替旧会话） */
	closeLoginSessionConnections(
		loginSessionId: string,
		code = 401,
		reason = "session replaced",
	): number {
		return this.closeMatching(
			(conn) =>
				conn.actor.type === "user" &&
				conn.actor.loginSessionId === loginSessionId,
			code,
			reason,
		);
	}

	/** 关闭某账号的全部连接（禁用/删除账号/改密） */
	closeUserConnections(
		userId: string,
		sessionId?: string,
		code = 401,
		reason = "session revoked",
	): number {
		return this.closeMatching(
			(conn) =>
				conn.userId === userId && (!sessionId || conn.sessionId === sessionId),
			code,
			reason,
		);
	}

	/** 关闭某玩家在某团（或全部团）的全部连接，用于踢出/拉黑 */
	closePlayerConnections(
		playerId: string,
		sessionId?: string,
		code = 4000,
		reason = "kicked",
	): number {
		return this.closeMatching(
			(conn) =>
				conn.playerId === playerId &&
				(!sessionId || conn.sessionId === sessionId),
			code,
			reason,
		);
	}

	private closeMatching(
		match: (conn: ActiveConnection) => boolean,
		code: number,
		reason: string,
	): number {
		let closed = 0;
		for (const [connectionId, conn] of [...this.connections.entries()]) {
			if (!match(conn)) continue;
			// 必须在当前消息处理栈之外关闭：同步栈内调用 close 会让底层 socket 状态机卡死
			const ws = conn.ws;
			setTimeout(() => {
				try {
					ws.close(code, reason);
				} catch {
					// 忽略已断开的连接
				}
			}, 0);
			this.unregister(connectionId);
			closed += 1;
		}
		return closed;
	}

	closeSessionConnections(
		sessionId: string,
		code = 1001,
		reason = "session ended",
	): number {
		const ids = this.bySession.get(sessionId);
		if (!ids) {
			return 0;
		}
		let closed = 0;
		for (const connectionId of [...ids]) {
			const conn = this.connections.get(connectionId);
			if (!conn) {
				continue;
			}
			const ws = conn.ws;
			setTimeout(() => {
				try {
					ws.close(code, reason);
				} catch {
					// ignore
				}
			}, 0);
			this.unregister(connectionId);
			closed += 1;
		}
		return closed;
	}
}
