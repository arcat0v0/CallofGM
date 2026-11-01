import { and, desc, eq, inArray, isNull } from "drizzle-orm";
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
  handouts,
  sessionOutbox,
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
import { checkVisibility, type VisibilityScope } from "../domain/visibility";

const RECENT_MESSAGES_LIMIT = 50;
const RECENT_EVENTS_LIMIT = 50;
/** 快照“近期活动”包含的事件类型（聊天消息走 recentMessages，其余由状态字段承载） */
const RECENT_EVENT_TYPES = ["dice:rolled", "check:resolved", "state:hint"] as const;

/**
 * 构建按请求者可见性过滤的全量快照。
 * 所有秘密数据（秘密情报、暗骰、NPC 状态、GM 队列）在此完成服务端裁剪。
 */
export class BuildSessionSnapshotUseCase {
  constructor(
    private readonly db: DbClient,
    private readonly ruleRegistry: RuleRegistry,
    private readonly presenceService: PresenceService
  ) {}

  async findSessionOrNull(sessionId: string): Promise<typeof sessions.$inferSelect | null> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.id, sessionId));
    return rows[0] ?? null;
  }

  async listVisibleHandouts(
    sessionId: string,
    isGm: boolean,
    claimedCharacterId: string | null
  ): Promise<GrantedHandoutDto[]> {
    return this.buildVisibleHandouts(sessionId, isGm, claimedCharacterId);
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

    const moduleRows = await this.db
      .select({ ruleId: modules.ruleId, name: modules.name, themeId: modules.themeId })
      .from(modules)
      .where(eq(modules.id, session.moduleId));
    const ruleId = (moduleRows[0]?.ruleId ?? "coc7e") as RuleId;
    const moduleName = moduleRows[0]?.name ?? "";

    const [
      charactersSnapshot,
      currentScene,
      bgm,
      recentMessages,
      recentEvents,
      visibleHandouts,
      pendingCheckRequests,
      pendingQueue,
      online,
    ] = await Promise.all([
      this.buildCharacters(sessionId, ruleId, actor),
      this.buildCurrentScene(session.currentSceneId),
      this.buildBgm(sessionId),
      this.buildRecentMessages(sessionId),
      this.buildRecentEvents(sessionId, actor, claimedCharacterId, input.connectionId),
      this.buildVisibleHandouts(sessionId, isGm, claimedCharacterId),
      this.buildPendingCheckRequests(sessionId, isGm, claimedCharacterId),
      isGm ? this.buildPendingQueue(sessionId) : Promise.resolve(undefined),
      isGm ? this.presenceService.listOnline(sessionId) : Promise.resolve(undefined),
    ]);

    return {
      session: {
        id: session.id,
        moduleId: session.moduleId,
        moduleName,
        themeId: moduleRows[0]?.themeId ?? null,
        status: session.status as SessionSnapshotPayload["session"]["status"],
        phase: session.phase as SessionSnapshotPayload["session"]["phase"],
        currentSceneId: session.currentSceneId ?? null,
        lastEventId: session.lastEventId,
      },
      currentScene,
      characters: charactersSnapshot,
      bgm,
      recentMessages,
      recentEvents,
      visibleHandouts,
      pendingCheckRequests,
      pendingQueue,
      online,
    };
  }

  /** 人物列表：NPC 团内状态仅 GM 可见，玩家/OB 收到 state=null */
  private async buildCharacters(
    sessionId: string,
    ruleId: RuleId,
    actor: ActorContext
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

    return sessionChars.map((sc) => {
      const kind = sc.kind === "npc" ? "npc" : "pc";
      // NPC 状态仅 GM 可见
      const stateVisible = isGm || kind === "pc";
      let state: unknown = null;
      if (stateVisible) {
        try {
          const parsed = ruleSystem.sessionStateSchema.safeParse(JSON.parse(sc.stateJson));
          if (parsed.success) {
            state = parsed.data;
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
      if (isGm || ownPc) {
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

  /** 最近已呈现消息（pending/discarded 永不进入玩家可见历史） */
  private async buildRecentMessages(sessionId: string): Promise<ChatMessageDto[]> {
    const rows = await this.db
      .select()
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "presented")))
      .orderBy(desc(sessionMessages.eventId))
      .limit(RECENT_MESSAGES_LIMIT);

    const charIds = [...new Set(rows.map((r) => r.characterId).filter((id): id is string => !!id))];
    const nameMap = await this.loadCharacterNames(charIds);

    return rows.reverse().map((row) => this.toMessageDto(row, nameMap));
  }

  /** GM 待呈现队列 */
  private async buildPendingQueue(sessionId: string): Promise<ChatMessageDto[]> {
    const rows = await this.db
      .select()
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "pending")))
      .orderBy(sessionMessages.queueOrder);

    const charIds = [...new Set(rows.map((r) => r.characterId).filter((id): id is string => !!id))];
    const nameMap = await this.loadCharacterNames(charIds);

    return rows.map((row) => this.toMessageDto(row, nameMap));
  }

  /** 近期活动事件：从持久 outbox 按请求者可见性过滤重建 */
  private async buildRecentEvents(
    sessionId: string,
    actor: ActorContext,
    claimedCharacterId: string | null,
    connectionId?: string
  ): Promise<SessionSnapshotPayload["recentEvents"]> {
    let offset = 0;
    const batchSize = RECENT_EVENTS_LIMIT;
    const maxScan = 500;
    const visible: SessionSnapshotPayload["recentEvents"] = [];

    while (visible.length < RECENT_EVENTS_LIMIT && offset < maxScan) {
      const rows = await this.db
        .select()
        .from(sessionOutbox)
        .where(
          and(
            eq(sessionOutbox.sessionId, sessionId),
            inArray(sessionOutbox.type, [...RECENT_EVENT_TYPES])
          )
        )
        .orderBy(desc(sessionOutbox.eventId))
        .limit(batchSize)
        .offset(offset);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        let visibility: VisibilityScope;
        try {
          visibility = JSON.parse(row.visibilityJson) as VisibilityScope;
        } catch {
          continue;
        }
        if (!checkVisibility(actor, claimedCharacterId, visibility, connectionId ?? "")) {
          continue;
        }
        visible.push({
          eventId: row.eventId,
          type: row.type,
          occurredAt: row.createdAt,
          payload: JSON.parse(row.payloadJson),
        });
        if (visible.length >= RECENT_EVENTS_LIMIT) {
          break;
        }
      }

      offset += rows.length;
      if (rows.length < batchSize) {
        break;
      }
    }
    return visible.reverse();
  }
  /** 可见情报：公开 + 目标含请求者认领 PC 的秘密情报；GM 全量 */
  private async buildVisibleHandouts(
    sessionId: string,
    isGm: boolean,
    claimedCharacterId: string | null
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
    const recipients = await this.db
      .select()
      .from(handoutGrantRecipients)
      .where(inArray(handoutGrantRecipients.grantId, grantIds));
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

  private async loadCharacterNames(charIds: string[]): Promise<Map<string, string>> {
    if (charIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ id: characters.id, name: characters.name })
      .from(characters)
      .where(inArray(characters.id, charIds));
    return new Map(rows.map((c) => [c.id, c.name]));
  }

  private toMessageDto(
    row: typeof sessionMessages.$inferSelect,
    nameMap: Map<string, string>
  ): ChatMessageDto {
    return {
      id: row.id,
      sessionId: row.sessionId,
      senderId: row.senderId ?? null,
      senderType: row.senderType === "gm" ? "gm" : "player",
      characterId: row.characterId ?? null,
      characterName: row.characterId ? (nameMap.get(row.characterId) ?? null) : null,
      channel: row.channel === "roleplay" ? "roleplay" : "ooc",
      content: row.content,
      expressionKey: row.expressionKey ?? null,
      queueOrder: row.queueOrder,
      eventId: row.eventId ?? null,
      presentedAt: row.presentedAt ?? null,
      createdAt: row.createdAt,
    };
  }
}
