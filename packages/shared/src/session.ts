import { z } from "zod";

export const SessionStatus = z.enum(["waiting", "preparing", "active", "ended"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const SessionStatusLabel: Record<SessionStatus, string> = {
  waiting: "等待开始",
  preparing: "准备中",
  active: "进行中",
  ended: "已结团",
};

export const SessionPhase = z.enum([
  "free_discussion",
  "performance_time",
  "forced_cg",
  "free_performance",
]);
export type SessionPhase = z.infer<typeof SessionPhase>;

export const SessionPhaseLabel: Record<SessionPhase, string> = {
  free_discussion: "自由讨论",
  performance_time: "演绎时间",
  forced_cg: "强制 CG",
  free_performance: "自由演绎",
};

export const CharacterRole = z.enum(["pc", "npc"]);
export type CharacterRole = z.infer<typeof CharacterRole>;

export const SeatRole = z.enum(["pc", "ob"]);
export type SeatRole = z.infer<typeof SeatRole>;

export const MessageChannel = z.enum(["ooc", "roleplay"]);
export type MessageChannel = z.infer<typeof MessageChannel>;

export const SessionSettings = z.object({
  sharePcSheets: z.boolean(),
  obSeePcState: z.boolean(),
});
export type SessionSettings = z.infer<typeof SessionSettings>;

export const SessionSettingsDefaults: SessionSettings = {
  sharePcSheets: true,
  obSeePcState: true,
};

export const CreateSessionRequest = z.object({
  moduleId: z.string().min(1),
  characterIds: z.array(z.string()),
  name: z.string().trim().max(60).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const RenameSessionRequest = z.object({
  name: z.string().trim().max(60).nullable(),
});
export type RenameSessionRequest = z.infer<typeof RenameSessionRequest>;

export const UpdateSessionSettingsCommand = SessionSettings;
export type UpdateSessionSettingsCommand = z.infer<typeof UpdateSessionSettingsCommand>;

export const SessionSettingsChangedEvent = SessionSettings;
export type SessionSettingsChangedEvent = z.infer<typeof SessionSettingsChangedEvent>;

export const ClaimSeatRequest = z.object({
  role: SeatRole,
  characterId: z.string().optional(),
});
export type ClaimSeatRequest = z.infer<typeof ClaimSeatRequest>;

export const GmAssignClaimRequest = z.object({
  userId: z.string().min(1),
  characterId: z.string().min(1),
});
export type GmAssignClaimRequest = z.infer<typeof GmAssignClaimRequest>;

export const GmReleaseClaimRequest = z.object({
  userId: z.string().min(1),
});
export type GmReleaseClaimRequest = z.infer<typeof GmReleaseClaimRequest>;

export const UpdateSessionStatusRequest = z.object({
  status: SessionStatus,
});
export type UpdateSessionStatusRequest = z.infer<typeof UpdateSessionStatusRequest>;

export const UpdateSessionPhaseRequest = z.object({
  phase: SessionPhase,
});
export type UpdateSessionPhaseRequest = z.infer<typeof UpdateSessionPhaseRequest>;

export const SessionDto = z.object({
  id: z.string(),
  name: z.string().nullable(),
  moduleId: z.string(),
  ruleId: z.string(),
  themeId: z.string().nullable().optional(),
  status: SessionStatus,
  phase: SessionPhase,
  currentSceneId: z.string().nullable(),
  lastEventId: z.number().int(),
  createdAt: z.number().int(),
});
export type SessionDto = z.infer<typeof SessionDto>;

export const ClaimHolderKind = z.enum(["user", "anonymous"]);
export type ClaimHolderKind = z.infer<typeof ClaimHolderKind>;

export const SessionCharacterClaimDto = z.object({
  holderKind: ClaimHolderKind,
  holderId: z.string(),
  playerId: z.string().nullable(),
  userId: z.string().nullable(),
  displayName: z.string().nullable(),
  role: SeatRole,
});
export type SessionCharacterClaimDto = z.infer<typeof SessionCharacterClaimDto>;

export const SessionCharacterDto = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string(),
  background: z.string(),
  kind: CharacterRole,
  ruleId: z.string(),
  sheetJson: z.string(),
  sheetVersion: z.number().int(),
  baseSheetVersion: z.number().int(),
  baseProfileVersion: z.number().int(),
  reviewStale: z.boolean(),
  currentExpressionKey: z.string().nullable(),
  state: z.unknown(),
  claim: SessionCharacterClaimDto.nullable(),
});
export type SessionCharacterDto = z.infer<typeof SessionCharacterDto>;

export const ReviewStatus = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const SessionDetailResponse = z.object({
  session: SessionDto,
  characters: z.array(SessionCharacterDto),
});
export type SessionDetailResponse = z.infer<typeof SessionDetailResponse>;

export const SessionCharacterRowDto = z.object({
  id: z.string(),
  sessionId: z.string(),
  characterId: z.string(),
  kind: CharacterRole,
  currentExpressionKey: z.string().nullable(),
  stateJson: z.string(),
  createdAt: z.number().int(),
});
export type SessionCharacterRowDto = z.infer<typeof SessionCharacterRowDto>;

export const CreateSessionResponse = z.object({
  session: SessionDto,
  characters: z.array(SessionCharacterRowDto),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;

export const ClaimDto = z.object({
  id: z.string(),
  sessionId: z.string(),
  holderKind: ClaimHolderKind,
  playerId: z.string().nullable(),
  userId: z.string().nullable(),
  role: SeatRole,
  characterId: z.string().nullable(),
  releasedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type ClaimDto = z.infer<typeof ClaimDto>;

export const SessionCloseCode = {
  kicked: 4000,
  claimReplaced: 4001,
  seatReleased: 4002,
} as const;
export type SessionCloseCode = (typeof SessionCloseCode)[keyof typeof SessionCloseCode];

export const MyClaimResponse = z.object({
  claim: ClaimDto.nullable(),
  sessionStatus: SessionStatus,
  isGm: z.boolean(),
  canAutoClaimCharacterId: z.string().nullable().default(null),
});
export type MyClaimResponse = z.infer<typeof MyClaimResponse>;

export const JoinInfoResponse = z.object({
  session: z.object({
    id: z.string(),
    name: z.string().nullable(),
    status: SessionStatus,
    phase: SessionPhase,
    moduleId: z.string(),
    moduleName: z.string(),
    ruleId: z.string(),
    themeId: z.string().nullable(),
  }),
  characters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: CharacterRole,
      claimed: z.boolean(),
      claimable: z.boolean(),
    }),
  ),
  requiresLogin: z.boolean(),
});
export type JoinInfoResponse = z.infer<typeof JoinInfoResponse>;
