import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  sessions,
  sessionCharacters,
  sessionClaims,
  characters,
  modules,
  scenes,
  sessionAudioState,
  sessionMessages,
  checkRequests,
  handoutGrants,
  handoutGrantRecipients,
  handoutReads,
  handouts,
  tracks,
  characterPortraits,
} from "@/platform/db/schema";
import type {
  SessionSnapshotPayload,
  SnapshotCharacter,
  ChatMessageDto,
  CheckRequestDto,
  GrantedHandoutDto,
  BgmState,
} from "@cogm/shared";
import type { ActorContext } from "@/modules/identity";
import { SessionNotFoundError } from "@/modules/sessions";
import type { RuleRegistry } from "@/rules/registry";
import type { RuleId } from "@cogm/shared";
import type { PresenceService } from "../presence-service";
import { SessionHistoryPager } from "./session-history";
import { collectCharacterIds, loadCharacterNames, toMessageDto } from "./chat-message-mapper";

const RECENT_HISTORY_LIMIT = 50;

/**
 * 构建按请求者可见性过滤的全量快照。
 * 所有秘密数据（秘密情报、暗骰、NPC 状态、GM 队列）在此完成服务端裁剪。
 */
export class BuildSessionSnapshotUseCase {
  private readonly historyPager: SessionHistoryPager;

  constructor(
    private readonly db: DbClient,
    private readonly ruleRegistry: RuleRegistry,
    private readonly presenceService: PresenceService
  ) {
    this.historyPager = new SessionHistoryPager(db);
  }

  async findSessionOrNull(sessionId: string): Promise<typeof sessions.$inferSelect | null> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.id, sessionId));
    return rows[0] ?? null;
  }

  async listVisibleHandouts(
    sessionId: string,
    isGm: boolean,
    claimedCharacterId: string | null,
    playerId: string | null = null
  ): Promise<GrantedHandoutDto[]> {
    return this.buildVisibleHandouts(sessionId, isGm, claimedCharacterId, playerId);
  }

  async listPendingQueue(sessionId: string): Promise<ChatMessageDto[]> {
    return this.buildPendingQueue(sessionId);
  }

  async execute(input: {
    sessionId: string;
    actor: ActorContext;
    claimedCharacterId: string | null;
    connectionId?: string;
  }): Promise<SessionSnapshotPayload> {
    const { sessionId, actor, claimedCharacterId } = input;
    const isGm = actor.type === "gm";

    const sessionRows = await this.db.select().from(sessions).where(eq(sessions.id, sessionId));
    const session = sessionRows[0];
    if (!session) {
      throw new SessionNotFoundError();
    }

    const seatRole = await this.resolveSeatRole(sessionId, actor);

    const moduleRows = await this.db
      .select({ ruleId: modules.ruleId, name: modules.name })
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
      pendingCheckRequests,
      pendingQueue,
      online,
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
        actor.type === "player" ? actor.playerId : null
      ),
      this.buildPendingCheckRequests(sessionId, isGm, claimedCharacterId),
      isGm ? this.buildPendingQueue(sessionId) : Promise.resolve(undefined),
      isGm ? this.presenceService.listOnline(sessionId) : Promise.resolve(undefined),
    ]);

    return {
      viewer: { isGm, seatRole },
      session: {
        id: session.id,
        name: session.name ?? null,
        moduleId: session.moduleId,
        moduleName,
        status: session.status as SessionSnapshotPayload["session"]["status"],
        phase: session.phase as SessionSnapshotPayload["session"]["phase"],
        currentSceneId: session.currentSceneId ?? null,
        lastEventId: session.lastEventId,
        settings: {
          sharePcSheets: session.sharePcSheets === 1,
          obSeePcState: session.obSeePcState === 1,
        },
      },
      currentScene,
      characters: charactersSnapshot,
      bgm,
      recentHistory: recentHistory.items,
      history: { beforeEventId: recentHistory.beforeEventId, hasMore: recentHistory.hasMore },
      visibleHandouts,
      pendingCheckRequests,
      pendingQueue,
      online,
    };
  }

  private async resolveSeatRole(sessionId: string, actor: ActorContext): Promise<"pc" | "ob" | null> {
    if (actor.type !== "player") {
      return null;
    }
    const rows = await this.db
      .select({ role: sessionClaims.role })
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          eq(sessionClaims.playerId, actor.playerId),
          isNull(sessionClaims.releasedAt)
        )
      );
    const role = rows[0]?.role;
    if (!role) {
      return null;
    }
    return role === "pc" ? "pc" : "ob";
  }

  /** 人物列表：NPC 团内状态仅 GM 可见，玩家/OB 收到 state=null */
  private async buildCharacters(
    sessionId: string,
    ruleId: RuleId,
    actor: ActorContext,
    seatRole: "pc" | "ob" | null,
    settings: { sharePcSheets: boolean; obSeePcState: boolean }
  ): Promise<SnapshotCharacter[]> {
    const isGm = actor.type === "gm";
    const playerId = actor.type === "player" ? actor.playerId : null;
    const sessionChars = await this.db
      .select()
      .from(sessionCharacters)
      .where(eq(sessionCharacters.sessionId, sessionId));
    if (sessionChars.length === 0) {
      return [];
    }

    const charIds = sessionChars.map((sc) => sc.characterId);
    const charRows = await this.db
      .select({ id: characters.id, name: characters.name, sheetJson: characters.sheetJson })
      .from(characters)
      .where(inArray(characters.id, charIds));
    const nameMap = new Map(charRows.map((c) => [c.id, c.name]));
    const sheetMap = new Map(charRows.map((c) => [c.id, c.sheetJson]));

    const portraitRows = await this.db
      .select({
        characterId: characterPortraits.characterId,
        expressionKey: characterPortraits.expressionKey,
        portraitAssetId: characterPortraits.portraitAssetId,
        isDefault: characterPortraits.isDefault,
      })
      .from(characterPortraits)
      .where(inArray(characterPortraits.characterId, charIds));
    const portraitsByCharacter = new Map<string, SnapshotCharacter["portraits"]>();
    for (const portrait of portraitRows) {
      const list = portraitsByCharacter.get(portrait.characterId) ?? [];
      list.push({
        expressionKey: portrait.expressionKey,
        portraitAssetId: portrait.portraitAssetId,
        isDefault: portrait.isDefault === 1,
      });
      portraitsByCharacter.set(portrait.characterId, list);
    }

    const activeClaims = await this.db
      .select()
      .from(sessionClaims)
      .where(and(eq(sessionClaims.sessionId, sessionId), isNull(sessionClaims.releasedAt)));
    const claimMap = new Map<string, { playerId: string; role: string }>();
    for (const claim of activeClaims) {
      if (claim.characterId) {
        claimMap.set(claim.characterId, { playerId: claim.playerId, role: claim.role });
      }
    }

    const ruleSystem = this.ruleRegistry.get(ruleId);
    const obStateHidden = seatRole === "ob" && !settings.obSeePcState;

    return sessionChars.map((sc) => {
      const kind = sc.kind === "npc" ? "npc" : "pc";
      const stateVisible = isGm || (kind === "pc" && !obStateHidden);
      let state: unknown = null;
      if (stateVisible) {
        try {
          const parsed = ruleSystem.sessionStateSchema.safeParse(JSON.parse(sc.stateJson));
          if (parsed.success) {
            state = ruleSystem.viewSessionState(parsed.data, { hidden: isGm });
          } else {
            console.error(`[Snapshot] Invalid state JSON for character ${sc.characterId}:`, parsed.error);
          }
        } catch (err) {
          console.error(`[Snapshot] Corrupted state JSON for character ${sc.characterId}:`, err);
        }
      }

      const claim = claimMap.get(sc.characterId) ?? null;
      const ownPc =
        playerId !== null &&
        kind === "pc" &&
        claim?.playerId === playerId &&
        claim.role === "pc";
      let sheet: unknown = null;
      const sheetVisible =
        isGm || ownPc || (kind === "pc" && settings.sharePcSheets && actor.type === "player");
      if (sheetVisible) {
        const raw = sheetMap.get(sc.characterId);
        if (raw) {
          try {
            sheet = JSON.parse(raw);
          } catch {
            sheet = null;
          }
        }
      }
      return {
        characterId: sc.characterId,
        name: nameMap.get(sc.characterId) ?? "Unknown",
        kind,
        currentExpressionKey: sc.currentExpressionKey ?? null,
        state,
        portraits: portraitsByCharacter.get(sc.characterId) ?? [],
        claim: claim
          ? { playerId: claim.playerId, role: claim.role === "pc" ? ("pc" as const) : ("ob" as const) }
          : null,
        sheet,
      };
    });
  }

  private async buildCurrentScene(
    currentSceneId: string | null
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
    return { id: scene.id, name: scene.name, bgAssetId: scene.bgAssetId ?? null };
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
  private async buildPendingQueue(sessionId: string): Promise<ChatMessageDto[]> {
    const rows = await this.db
      .select()
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "pending")))
      .orderBy(sessionMessages.queueOrder);

    const nameMap = await loadCharacterNames(this.db, collectCharacterIds(rows));

    return rows.map((row) => toMessageDto(row, nameMap));
  }

  /** 可见情报：公开 + 目标含请求者认领 PC 的秘密情报；GM 全量 */
  private async buildVisibleHandouts(
    sessionId: string,
    isGm: boolean,
    claimedCharacterId: string | null,
    playerId: string | null
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
      playerId
        ? this.db
            .select({ grantId: handoutReads.grantId })
            .from(handoutReads)
            .where(
              and(
                eq(handoutReads.playerId, playerId),
                inArray(handoutReads.grantId, grantIds)
              )
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
    claimedCharacterId: string | null
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
