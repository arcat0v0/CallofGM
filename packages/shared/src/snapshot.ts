import { z } from "zod";
import { ChatMessageDto } from "./chat";
import { CheckRequestDto } from "./gameplay";
import { GrantedHandoutDto } from "./handouts";
import { HistoryCursor, HistoryItem, SnapshotRewindNotice } from "./history";
import {
	KickedPlayerDto,
	OnlinePlayerDto,
	SeatHolderKindDto,
} from "./moderation";
import {
	SeatRole,
	SessionPhase,
	SessionSettings,
	SessionStatus,
} from "./session";
import { BgmState, PortraitLayout, PortraitScale } from "./stage";

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
			holderKind: SeatHolderKindDto,
			holderId: z.string(),
			displayName: z.string().nullable(),
			role: z.enum(["pc", "ob"]),
		})
		.nullable(),
	/** 人物卡摘要：GM 可见全部；玩家仅可见自己认领的 PC；其余为 null */
	sheet: z.unknown().nullable().optional(),
});
export type SnapshotCharacter = z.infer<typeof SnapshotCharacter>;

/** WS 全量快照 payload。所有内容均已按请求者身份完成可见性过滤。 */
export const SessionSnapshotPayload = z.object({
	session: z.object({
		id: z.string(),
		name: z.string().nullable(),
		moduleId: z.string(),
		moduleName: z.string(),
		ruleId: z.string(),
		themeId: z.string().nullable(),
		status: SessionStatus,
		phase: SessionPhase,
		currentSceneId: z.string().nullable(),
		lastEventId: z.number().int(),
		settings: SessionSettings,
		portraitLayout: PortraitLayout.optional(),
		portraitScale: PortraitScale.optional(),
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
		holderKind: SeatHolderKindDto.nullable().optional(),
		holderId: z.string().nullable().optional(),
	}),
	characters: z.array(SnapshotCharacter),
	bgm: BgmState.nullable(),
	recentHistory: z.array(HistoryItem),
	history: HistoryCursor,
	lastRewind: SnapshotRewindNotice.nullable().optional(),
	visibleHandouts: z.array(GrantedHandoutDto),
	pendingCheckRequests: z.array(CheckRequestDto),
	/** GM 专属：待呈现队列 */
	pendingQueue: z.array(ChatMessageDto).optional(),
	discardedQueue: z.array(ChatMessageDto).optional(),
	/** 玩家专属：自己尚未被放行的发言 */
	ownPendingMessages: z.array(ChatMessageDto).optional(),
	/** 玩家专属：自己被拒绝的发言（含拒绝理由） */
	ownRejectedMessages: z.array(ChatMessageDto).optional(),
	/** GM 专属：在线列表 */
	online: z.array(OnlinePlayerDto).optional(),
	kickedPlayers: z.array(KickedPlayerDto).optional(),
});
export type SessionSnapshotPayload = z.infer<typeof SessionSnapshotPayload>;
