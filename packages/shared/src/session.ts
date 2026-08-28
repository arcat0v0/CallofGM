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

export const CreateSessionRequest = z.object({
  moduleId: z.string().min(1),
  characterIds: z.array(z.string()),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const ClaimSeatRequest = z.object({
  role: SeatRole,
  characterId: z.string().optional(),
});
export type ClaimSeatRequest = z.infer<typeof ClaimSeatRequest>;

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
  moduleId: z.string(),
  status: SessionStatus,
  phase: SessionPhase,
  currentSceneId: z.string().nullable(),
  lastEventId: z.number().int(),
  createdAt: z.number().int(),
});
export type SessionDto = z.infer<typeof SessionDto>;

export const SessionCharacterClaimDto = z.object({
  playerId: z.string(),
  role: SeatRole,
});
export type SessionCharacterClaimDto = z.infer<typeof SessionCharacterClaimDto>;

export const SessionCharacterDto = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string(),
  kind: CharacterRole,
  currentExpressionKey: z.string().nullable(),
  state: z.unknown(),
  claim: SessionCharacterClaimDto.nullable(),
});
export type SessionCharacterDto = z.infer<typeof SessionCharacterDto>;

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
  playerId: z.string(),
  role: SeatRole,
  characterId: z.string().nullable(),
  releasedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type ClaimDto = z.infer<typeof ClaimDto>;

export const JoinInfoResponse = z.object({
  session: z.object({
    id: z.string(),
    status: SessionStatus,
    phase: SessionPhase,
    moduleId: z.string(),
    moduleName: z.string(),
  }),
  characters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: CharacterRole,
      claimed: z.boolean(),
    }),
  ),
});
export type JoinInfoResponse = z.infer<typeof JoinInfoResponse>;
