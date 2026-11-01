import { z } from "zod";
import { SeatRole, SessionStatus, SessionPhase } from "./session";
import { ChatMessageDto } from "./chat";
import { CheckRequestDto } from "./gameplay";
import { GrantedHandoutDto } from "./handouts";
import { HistoryCursor, HistoryItem } from "./history";
import { OnlinePlayerDto } from "./moderation";
import { BgmState } from "./stage";

export const SnapshotPortrait = z.object({
  expressionKey: z.string(),
  portraitAssetId: z.string(),
  isDefault: z.boolean(),
});
export type SnapshotPortrait = z.infer<typeof SnapshotPortrait>;

/** 快照中的团内人物条目。state 为规则专属 JSON；NPC 状态对玩家不可见时为 null。 */
export const SnapshotCharacter = z.object({
  characterId: z.string(),
  name: z.string(),
  kind: z.enum(["pc", "npc"]),
  currentExpressionKey: z.string().nullable(),
  state: z.unknown().nullable(),
  portraits: z.array(SnapshotPortrait).default([]),
  claim: z
    .object({
      playerId: z.string(),
      role: z.enum(["pc", "ob"]),
    })
    .nullable(),
  /** 人物卡摘要：GM 可见全部；玩家仅可见自己认领的 PC；其余为 null */
  sheet: z.unknown().nullable().optional(),
});
export type SnapshotCharacter = z.infer<typeof SnapshotCharacter>;

/** 快照中的近期活动（骰点/鉴定等持久事件），由服务端按请求者可见性过滤。 */
export const SnapshotRecentEvent = z.object({
  eventId: z.number().int(),
  type: z.string(),
  occurredAt: z.number(),
  payload: z.unknown(),
});
export type SnapshotRecentEvent = z.infer<typeof SnapshotRecentEvent>;

/** WS 全量快照 payload。所有内容均已按请求者身份完成可见性过滤。 */
export const SessionSnapshotPayload = z.object({
  session: z.object({
    id: z.string(),
    moduleId: z.string(),
    moduleName: z.string(),
    status: SessionStatus,
    phase: SessionPhase,
    currentSceneId: z.string().nullable(),
    lastEventId: z.number().int(),
  }),
  currentScene: z
    .object({
      id: z.string(),
      name: z.string(),
      bgAssetId: z.string().nullable(),
    })
    .nullable(),
  viewer: z.object({
    isGm: z.boolean(),
    seatRole: SeatRole.nullable(),
  }),
  characters: z.array(SnapshotCharacter),
  bgm: BgmState.nullable(),
  recentHistory: z.array(HistoryItem),
  history: HistoryCursor,
  visibleHandouts: z.array(GrantedHandoutDto),
  pendingCheckRequests: z.array(CheckRequestDto),
  /** GM 专属：待呈现队列 */
  pendingQueue: z.array(ChatMessageDto).optional(),
  /** GM 专属：在线列表 */
  online: z.array(OnlinePlayerDto).optional(),
});
export type SessionSnapshotPayload = z.infer<typeof SessionSnapshotPayload>;