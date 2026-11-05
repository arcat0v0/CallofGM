import type {
	BgmState,
	ChatMessageDto,
	CheckRequestDto,
	GrantedHandoutDto,
	RuleId,
	SessionSnapshotPayload,
	SnapshotCharacter,
} from "@cogm/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { buildHandoutGrantOverview } from "@/modules/handouts";
import type { ActorContext } from "@/modules/identity";
import { holderOfActor } from "@/modules/identity";
import type { SeatHolderInput } from "@/modules/sessions";
import { SessionNotFoundError } from "@/modules/sessions";
import type { DbClient } from "@/platform/db/client";
import {
	anonymousPlayers,
	characterPortraits,
	characters,
	checkRequests,
	handoutGrantRecipients,
	handoutGrants,
	handoutReads,
	handouts,
	modules,
	scenes,
	sessionAudioState,
	sessionCharacters,
	sessionClaims,
	sessionMessages,
	sessions,
	tracks,
	users,
} from "@/platform/db/schema";
import type { RuleRegistry } from "@/rules/registry";
import type { PresenceService } from "../presence-service";
import {
	collectCharacterIds,
	loadCharacterNames,
	toMessageDto,
} from "./chat-message-mapper";
import { loadKickedPlayers } from "./kicked-players";
import { SessionHistoryPager } from "./session-history";

const RECENT_HISTORY_LIMIT = 50;

/**
 * 构建按请求者可见性过滤的全量快照。
 * 所有秘密数据（秘密情报、暗骰、NPC 状态、GM 队列）在此完成服务端裁剪。
 */
function senderHolderCondition(
	holder: SeatHolderInput,
	table: typeof sessionMessages,
) {
	return holder.holderKind === "user"
		? eq(table.senderUserId, holder.userId!)
		: eq(table.senderId, holder.playerId!);
}

export class BuildSessionSnapshotUseCase {
	private readonly historyPager: SessionHistoryPager;

	constructor(
		private readonly db: DbClient,
		private readonly ruleRegistry: RuleRegistry,
		private readonly presenceService: PresenceService,
	) {
		this.historyPager = new SessionHistoryPager(db);
	}

	async findSessionOrNull(
		sessionId: string,
	): Promise<typeof sessions.$inferSelect | null> {
		const rows = await this.db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		return rows[0] ?? null;
	}

	async listVisibleHandouts(
		sessionId: string,
		isGm: boolean,
		claimedCharacterId: string | null,
		holder: SeatHolderInput | null = null,
	): Promise<GrantedHandoutDto[]> {
		return this.buildVisibleHandouts(
			sessionId,
			isGm,
			claimedCharacterId,
			holder,
		);
	}

	async listPendingQueue(sessionId: string): Promise<ChatMessageDto[]> {
		return this.buildPendingQueue(sessionId);
	}

	private async loadClaimHolderNames(
		claims: Array<{
			holderKind: string;
			userId: string | null;
			playerId: string | null;
		}>,
	): Promise<Map<string, string>> {
		const names = new Map<string, string>();
		const userIds = claims
			.map((c) => c.userId)
			.filter((id): id is string => Boolean(id));
		const playerIds = claims
			.map((c) => c.playerId)
			.filter((id): id is string => Boolean(id));
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
			for (const row of rows)
				names.set(`player:${row.id}`, `观战 ${row.id.slice(0, 8)}`);
		}
		return names;
	}

	async listDiscardedQueue(sessionId: string): Promise<ChatMessageDto[]> {
		return this.buildDiscardedQueue(sessionId);
	}

	async execute(input: {
		sessionId: string;
		actor: ActorContext;
		claimedCharacterId: string | null;
		connectionId?: string;
	}): Promise<SessionSnapshotPayload> {
		const { sessionId, actor, claimedCharacterId } = input;
		const isGm = actor.type === "user" && actor.role === "gm";
		const actorHolder = isGm ? null : holderOfActor(actor);

		const sessionRows = await this.db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		const session = sessionRows[0];
		if (!session) {
			throw new SessionNotFoundError();
		}

		const seatRole = await this.resolveSeatRole(sessionId, actor);

		const moduleRows = await this.db
			.select({
				ruleId: modules.ruleId,
				name: modules.name,
				themeId: modules.themeId,
			})
			.from(modules)
			.where(eq(modules.id, session.moduleId));
		const ruleId = (moduleRows[0]?.ruleId ?? "coc7e") as RuleId;
		const moduleName = moduleRows[0]?.name ?? "";

		const [
			charactersSnapshot,
			currentScene,
			bgm,
			recentHistory,
			visibleHandouts,
			handoutGrants,
			pendingCheckRequests,
			pendingQueue,
			ownPendingMessages,
			ownRejectedMessages,
			discardedQueue,
			online,
			kickedPlayers,
			lastRewind,
		] = await Promise.all([
			this.buildCharacters(sessionId, ruleId, actor, seatRole, {
				sharePcSheets: session.sharePcSheets === 1,
				obSeePcState: session.obSeePcState === 1,
			}),
			this.buildCurrentScene(session.currentSceneId),
			this.buildBgm(sessionId),
			this.historyPager.page({
				sessionId,
				actor,
				claimedCharacterId,
				connectionId: input.connectionId ?? "",
				limit: RECENT_HISTORY_LIMIT,
			}),
			this.buildVisibleHandouts(
				sessionId,
				isGm,
				claimedCharacterId,
				actorHolder,
			),
			isGm
				? buildHandoutGrantOverview(this.db, sessionId)
				: Promise.resolve(undefined),
			this.buildPendingCheckRequests(sessionId, isGm, claimedCharacterId),
			isGm ? this.buildPendingQueue(sessionId) : Promise.resolve(undefined),
			isGm
				? Promise.resolve(undefined)
				: this.buildOwnPendingQueue(sessionId, actor),
			isGm
				? Promise.resolve(undefined)
				: this.buildOwnRejectedQueue(sessionId, actor),
			isGm ? this.buildDiscardedQueue(sessionId) : Promise.resolve(undefined),
			isGm
				? this.presenceService.listOnline(sessionId)
				: Promise.resolve(undefined),
			isGm ? loadKickedPlayers(this.db, sessionId) : Promise.resolve(undefined),
			this.historyPager.latestRewind(sessionId),
		]);

		return {
			viewer: {
				isGm,
				seatRole,
				holderKind: actorHolder?.holderKind ?? null,
				holderId: actorHolder
					? actorHolder.holderKind === "user"
						? actorHolder.userId
						: actorHolder.playerId
					: null,
			},
			session: {
				id: session.id,
				name: session.name ?? null,
				moduleId: session.moduleId,
				ruleId: session.ruleId,
				moduleName,
				themeId: moduleRows[0]?.themeId ?? null,
				status: session.status as SessionSnapshotPayload["session"]["status"],
				phase: session.phase as SessionSnapshotPayload["session"]["phase"],
				currentSceneId: session.currentSceneId ?? null,
				lastEventId: session.lastEventId,
				settings: {
					sharePcSheets: session.sharePcSheets === 1,
					obSeePcState: session.obSeePcState === 1,
				},
				portraitLayout:
					session.portraitLayout as SessionSnapshotPayload["session"]["portraitLayout"],
				portraitScale:
					session.portraitScale as SessionSnapshotPayload["session"]["portraitScale"],
			},
			currentScene,
			characters: charactersSnapshot,
			bgm,
			recentHistory: recentHistory.items,
			history: {
				beforeEventId: recentHistory.beforeEventId,
				hasMore: recentHistory.hasMore,
			},
			lastRewind,
			visibleHandouts,
			handoutGrants,
			pendingCheckRequests,
			pendingQueue,
			ownPendingMessages,
			ownRejectedMessages,
			discardedQueue,
			online,
			kickedPlayers,
		};
	}

	private async resolveSeatRole(
		sessionId: string,
		actor: ActorContext,
	): Promise<"pc" | "ob" | null> {
		if (actor.type === "user" && actor.role !== "pl") {
			return null;
		}
		const holder = holderOfActor(actor);
		const rows = await this.db
			.select({ role: sessionClaims.role })
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					holder.holderKind === "user"
						? eq(sessionClaims.userId, holder.userId!)
						: eq(sessionClaims.playerId, holder.playerId!),
					isNull(sessionClaims.releasedAt),
				),
			);
		const role = rows[0]?.role;
		if (!role) {
			return null;
		}
		return role === "pc" ? "pc" : "ob";
	}

	/** 人物列表：PC 状态按既有设置可见，NPC 状态按服务端公开投影裁剪 */
	private async buildCharacters(
		sessionId: string,
		ruleId: RuleId,
		actor: ActorContext,
		seatRole: "pc" | "ob" | null,
		settings: { sharePcSheets: boolean; obSeePcState: boolean },
	): Promise<SnapshotCharacter[]> {
		const isGm = actor.type === "user" && actor.role === "gm";
		const actorHolder =
			actor.type === "user" && actor.role === "gm"
				? null
				: holderOfActor(actor);
		const actorHolderKey = actorHolder
			? `${actorHolder.holderKind}:${actorHolder.holderKind === "user" ? actorHolder.userId : actorHolder.playerId}`
			: null;
		const sessionChars = await this.db
			.select()
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					isNull(sessionCharacters.deletedAt),
				),
			);
		if (sessionChars.length === 0) {
			return [];
		}

		const charIds = sessionChars.map((sc) => sc.characterId);
		const portraitRows = await this.db
			.select({
				characterId: characterPortraits.characterId,
				expressionKey: characterPortraits.expressionKey,
				portraitAssetId: characterPortraits.portraitAssetId,
				isDefault: characterPortraits.isDefault,
				label: characterPortraits.label,
				sortOrder: characterPortraits.sortOrder,
			})
			.from(characterPortraits)
			.where(
				and(
					inArray(characterPortraits.characterId, charIds),
					isNull(characterPortraits.deletedAt),
				),
			)
			.orderBy(
				asc(characterPortraits.sortOrder),
				asc(characterPortraits.createdAt),
			);
		const portraitsByCharacter = new Map<
			string,
			SnapshotCharacter["portraits"]
		>();
		for (const portrait of portraitRows) {
			const list = portraitsByCharacter.get(portrait.characterId) ?? [];
			list.push({
				expressionKey: portrait.expressionKey,
				portraitAssetId: portrait.portraitAssetId,
				isDefault: portrait.isDefault === 1,
				label: portrait.label,
				sortOrder: portrait.sortOrder,
			});
			portraitsByCharacter.set(portrait.characterId, list);
		}

		const activeClaims = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					isNull(sessionClaims.releasedAt),
				),
			);
		const holderNames = await this.loadClaimHolderNames(activeClaims);
		const claimMap = new Map<
			string,
			{
				holderKind: "user" | "anonymous";
				holderId: string;
				displayName: string | null;
				role: string;
			}
		>();
		for (const claim of activeClaims) {
			if (!claim.characterId) continue;
			const holderKind = claim.holderKind as "user" | "anonymous";
			const holderId =
				(holderKind === "user" ? claim.userId : claim.playerId) ?? "";
			claimMap.set(claim.characterId, {
				holderKind,
				holderId,
				displayName: holderNames.get(`${holderKind}:${holderId}`) ?? null,
				role: claim.role,
			});
		}

		const ruleSystem = this.ruleRegistry.get(ruleId);
		const obStateHidden = seatRole === "ob" && !settings.obSeePcState;

		return sessionChars.map((sc) => {
			const kind = sc.kind === "npc" ? "npc" : "pc";
			let state: unknown = null;
			let publicState: unknown = null;
			let publicStateFields: string[] | undefined;
			try {
				const parsed = ruleSystem.sessionStateSchema.safeParse(
					JSON.parse(sc.stateJson),
				);
				if (!parsed.success) {
					console.error(
						`[Snapshot] Invalid state JSON for character ${sc.characterId}:`,
						parsed.error,
					);
				} else if (kind === "npc") {
					const rawFields: unknown = JSON.parse(sc.publicStateFieldsJson);
					publicStateFields = Array.isArray(rawFields)
						? rawFields.filter(
								(field): field is string => typeof field === "string",
							)
						: [];
					if (isGm) {
						state = ruleSystem.viewSessionState(parsed.data, { hidden: true });
						publicState = ruleSystem.projectPublicSessionState(
							parsed.data,
							publicStateFields,
						);
					} else {
						state = ruleSystem.projectPublicSessionState(
							parsed.data,
							publicStateFields,
						);
					}
				} else if (!obStateHidden) {
					state = ruleSystem.viewSessionState(parsed.data, { hidden: isGm });
				}
			} catch (err) {
				console.error(
					`[Snapshot] Corrupted state JSON for character ${sc.characterId}:`,
					err,
				);
			}

			const claim = claimMap.get(sc.characterId) ?? null;
			const ownPc =
				actorHolderKey !== null &&
				kind === "pc" &&
				claim !== null &&
				`${claim.holderKind}:${claim.holderId}` === actorHolderKey &&
				claim.role === "pc";
			const isParticipant = actorHolderKey !== null;
			let sheet: unknown = null;
			const sheetVisible =
				isGm ||
				ownPc ||
				(kind === "pc" && settings.sharePcSheets && isParticipant);
			if (sheetVisible) {
				try {
					sheet = JSON.parse(sc.sheetJson);
				} catch {
					sheet = null;
				}
			}
			return {
				characterId: sc.characterId,
				name: sc.name,
				kind,
				ruleId: sc.ruleId,
				currentExpressionKey: sc.currentExpressionKey ?? null,
				state,
				...(isGm && kind === "npc"
					? {
							publicState,
							publicStateFields,
						}
					: {}),
				portraits: portraitsByCharacter.get(sc.characterId) ?? [],
				claim: claim
					? {
							holderKind: claim.holderKind,
							holderId: claim.holderId,
							displayName: claim.displayName,
							role: claim.role === "pc" ? ("pc" as const) : ("ob" as const),
						}
					: null,
				sheet,
			};
		});
	}

	private async buildCurrentScene(
		currentSceneId: string | null,
	): Promise<SessionSnapshotPayload["currentScene"]> {
		if (!currentSceneId) {
			return null;
		}
		const rows = await this.db
			.select({ id: scenes.id, name: scenes.name, bgAssetId: scenes.bgAssetId })
			.from(scenes)
			.where(eq(scenes.id, currentSceneId));
		const scene = rows[0];
		if (!scene) {
			return null;
		}
		return {
			id: scene.id,
			name: scene.name,
			bgAssetId: scene.bgAssetId ?? null,
		};
	}

	private async buildBgm(sessionId: string): Promise<BgmState | null> {
		const rows = await this.db
			.select({
				audio: sessionAudioState,
				duration: tracks.duration,
				name: tracks.name,
				audioAssetId: tracks.audioAssetId,
			})
			.from(sessionAudioState)
			.leftJoin(tracks, eq(sessionAudioState.trackId, tracks.id))
			.where(eq(sessionAudioState.sessionId, sessionId));
		const row = rows[0];
		if (!row) {
			return null;
		}
		const audio = row.audio;
		return {
			trackId: audio.trackId ?? null,
			playing: audio.playing === 1,
			volume: audio.volume,
			loop: audio.loop === 1,
			seekOffsetMs: audio.seekOffsetMs,
			startedAtMs: audio.startedAtMs,
			version: audio.version,
			durationMs: row.duration ?? 0,
			name: row.name ?? undefined,
			audioAssetId: row.audioAssetId ?? null,
		};
	}

	/** GM 待呈现队列 */
	private async buildPendingQueue(
		sessionId: string,
	): Promise<ChatMessageDto[]> {
		const rows = await this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.sessionId, sessionId),
					eq(sessionMessages.status, "pending"),
				),
			)
			.orderBy(sessionMessages.queueOrder);

		const nameMap = await loadCharacterNames(
			this.db,
			collectCharacterIds(rows),
		);

		return rows.map((row) => toMessageDto(row, nameMap));
	}

	private async buildOwnPendingQueue(
		sessionId: string,
		actor: ActorContext,
	): Promise<ChatMessageDto[]> {
		if (actor.type === "user" && actor.role === "gm") {
			return [];
		}
		const holder = holderOfActor(actor);
		const rows = await this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.sessionId, sessionId),
					senderHolderCondition(holder, sessionMessages),
					eq(sessionMessages.status, "pending"),
				),
			)
			.orderBy(sessionMessages.queueOrder);

		const nameMap = await loadCharacterNames(
			this.db,
			collectCharacterIds(rows),
		);

		return rows.map((row) => toMessageDto(row, nameMap));
	}

	private async buildOwnRejectedQueue(
		sessionId: string,
		actor: ActorContext,
	): Promise<ChatMessageDto[]> {
		if (actor.type === "user" && actor.role === "gm") {
			return [];
		}
		const holder = holderOfActor(actor);
		const rows = await this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.sessionId, sessionId),
					senderHolderCondition(holder, sessionMessages),
					eq(sessionMessages.status, "discarded"),
				),
			)
			.orderBy(sessionMessages.createdAt);

		const nameMap = await loadCharacterNames(
			this.db,
			collectCharacterIds(rows),
		);

		return rows.map((row) => toMessageDto(row, nameMap));
	}

	private async buildDiscardedQueue(
		sessionId: string,
	): Promise<ChatMessageDto[]> {
		const rows = await this.db
			.select()
			.from(sessionMessages)
			.where(
				and(
					eq(sessionMessages.sessionId, sessionId),
					eq(sessionMessages.status, "discarded"),
				),
			)
			.orderBy(sessionMessages.createdAt);

		const nameMap = await loadCharacterNames(
			this.db,
			collectCharacterIds(rows),
		);

		return rows.map((row) => toMessageDto(row, nameMap));
	}

	/** 可见情报：公开 + 目标含请求者认领 PC 的秘密情报；GM 全量 */
	private async buildVisibleHandouts(
		sessionId: string,
		isGm: boolean,
		claimedCharacterId: string | null,
		holder: SeatHolderInput | null,
	): Promise<GrantedHandoutDto[]> {
		const grants = await this.db
			.select()
			.from(handoutGrants)
			.where(eq(handoutGrants.sessionId, sessionId))
			.orderBy(handoutGrants.createdAt);
		if (grants.length === 0) {
			return [];
		}

		const grantIds = grants.map((g) => g.id);
		const [recipients, readRows] = await Promise.all([
			this.db
				.select()
				.from(handoutGrantRecipients)
				.where(inArray(handoutGrantRecipients.grantId, grantIds)),
			holder
				? this.db
						.select({ grantId: handoutReads.grantId })
						.from(handoutReads)
						.where(
							and(
								holder.holderKind === "user"
									? eq(handoutReads.userId, holder.userId!)
									: eq(handoutReads.playerId, holder.playerId!),
								inArray(handoutReads.grantId, grantIds),
							),
						)
				: Promise.resolve([] as Array<{ grantId: string }>),
		]);
		const readGrantIds = new Set(readRows.map((row) => row.grantId));
		const recipientMap = new Map<string, Set<string>>();
		for (const r of recipients) {
			if (!recipientMap.has(r.grantId)) {
				recipientMap.set(r.grantId, new Set());
			}
			recipientMap.get(r.grantId)!.add(r.characterId);
		}

		const handoutIds = [...new Set(grants.map((g) => g.handoutId))];
		const handoutRows = await this.db
			.select()
			.from(handouts)
			.where(inArray(handouts.id, handoutIds));
		const handoutMap = new Map(handoutRows.map((h) => [h.id, h]));

		const visible: GrantedHandoutDto[] = [];
		for (const grant of grants) {
			const isPublic = grant.isPublic === 1;
			const visibleToViewer =
				isGm ||
				isPublic ||
				(claimedCharacterId !== null &&
					(recipientMap.get(grant.id)?.has(claimedCharacterId) ?? false));
			if (!visibleToViewer) {
				continue;
			}
			const handout = handoutMap.get(grant.handoutId);
			if (!handout) {
				continue;
			}
			visible.push({
				grantId: grant.id,
				handout: {
					id: handout.id,
					title: handout.title,
					content: handout.content,
					imageAssetId: handout.imageAssetId ?? null,
				},
				isPublic,
				grantedAt: grant.createdAt,
				read: readGrantIds.has(grant.id),
			});
		}
		return visible;
	}

	/** 待响应鉴定请求：GM 全量；玩家仅自己认领 PC 的（含暗骰请求本身）；OB 无 */
	private async buildPendingCheckRequests(
		sessionId: string,
		isGm: boolean,
		claimedCharacterId: string | null,
	): Promise<CheckRequestDto[]> {
		const conditions = [
			eq(checkRequests.sessionId, sessionId),
			eq(checkRequests.status, "pending"),
		];
		if (!isGm) {
			if (!claimedCharacterId) {
				return [];
			}
			conditions.push(eq(checkRequests.characterId, claimedCharacterId));
		}
		const rows = await this.db
			.select()
			.from(checkRequests)
			.where(and(...conditions))
			.orderBy(checkRequests.createdAt);

		return rows.map((row) => ({
			id: row.id,
			sessionId: row.sessionId,
			characterId: row.characterId,
			skillKey: row.skillKey,
			difficulty: row.difficulty as CheckRequestDto["difficulty"],
			bonusDice: row.bonusDice,
			penaltyDice: row.penaltyDice,
			hidden: row.hidden === 1,
			sanLossExpression: row.sanLossExpression ?? null,
			status: "pending" as const,
			createdAt: row.createdAt,
		}));
	}
}
