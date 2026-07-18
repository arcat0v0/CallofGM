import { z } from "zod";
import { DiceRollResult } from "./dice";

// ---------- commands ----------

export const RollDiceCommand = z.object({
  expression: z.string().min(1).max(64),
  comment: z.string().max(200).optional(),
  hidden: z.boolean().optional(),
});
export type RollDiceCommand = z.infer<typeof RollDiceCommand>;

export const PerformCheckCommand = z.object({
  characterId: z.string().min(1),
  skillKey: z.string().min(1).max(64),
  difficulty: z.enum(["regular", "hard", "extreme"]).default("regular"),
  bonusDice: z.number().int().min(0).max(2).default(0),
  penaltyDice: z.number().int().min(0).max(2).default(0),
  hidden: z.boolean().optional(),
});
export type PerformCheckCommand = z.infer<typeof PerformCheckCommand>;

export const CreateCheckRequestCommand = z.object({
  characterId: z.string().min(1),
  skillKey: z.string().min(1).max(64),
  difficulty: z.enum(["regular", "hard", "extreme"]).default("regular"),
  bonusDice: z.number().int().min(0).max(2).default(0),
  penaltyDice: z.number().int().min(0).max(2).default(0),
  hidden: z.boolean().optional(),
  /** SAN 检定时提供："成功损失/失败损失"，如 "1/1d6" */
  sanLossExpression: z.string().max(64).optional(),
});
export type CreateCheckRequestCommand = z.infer<typeof CreateCheckRequestCommand>;

export const RespondCheckRequestCommand = z.object({
  requestId: z.string().min(1),
});
export type RespondCheckRequestCommand = z.infer<typeof RespondCheckRequestCommand>;

export const EditCharacterStateCommand = z.object({
  characterId: z.string().min(1),
  hp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).optional(),
  mp: z.number().int().min(0).optional(),
  maxMp: z.number().int().min(0).optional(),
  san: z.number().int().min(0).optional(),
  maxSan: z.number().int().min(0).optional(),
  hpDelta: z.number().int().optional(),
  mpDelta: z.number().int().optional(),
  sanDelta: z.number().int().optional(),
  addStatuses: z.array(z.string().max(32)).optional(),
  removeStatuses: z.array(z.string().max(32)).optional(),
  addTags: z.array(z.string().max(64)).optional(),
  removeTags: z.array(z.string().max(64)).optional(),
});
export type EditCharacterStateCommand = z.infer<typeof EditCharacterStateCommand>;

// ---------- events & DTO ----------

/** Event payload: dice:rolled */
export const DiceRolledEvent = z.object({
  rollerType: z.enum(["gm", "player"]),
  rollerId: z.string().nullable(),
  characterId: z.string().nullable(),
  characterName: z.string().nullable(),
  hidden: z.boolean(),
  result: DiceRollResult,
});
export type DiceRolledEvent = z.infer<typeof DiceRolledEvent>;

export const CheckRequestDto = z.object({
  id: z.string(),
  sessionId: z.string(),
  characterId: z.string(),
  skillKey: z.string(),
  difficulty: z.enum(["regular", "hard", "extreme"]),
  bonusDice: z.number().int(),
  penaltyDice: z.number().int(),
  hidden: z.boolean(),
  sanLossExpression: z.string().nullable(),
  status: z.enum(["pending", "resolved"]),
  createdAt: z.number().int(),
});
export type CheckRequestDto = z.infer<typeof CheckRequestDto>;

/** Event payload: check:requested（visibility = 目标 PC） */
export const CheckRequestedEvent = z.object({
  request: CheckRequestDto,
});
export type CheckRequestedEvent = z.infer<typeof CheckRequestedEvent>;

/** Event payload: check:resolved。result 为规则专属 JSON（CoC 7e: SkillCheckResult / SanCheckResult） */
export const CheckResolvedEvent = z.object({
  requestId: z.string().nullable(),
  characterId: z.string(),
  characterName: z.string().nullable(),
  skillKey: z.string(),
  hidden: z.boolean(),
  result: z.unknown(),
});
export type CheckResolvedEvent = z.infer<typeof CheckResolvedEvent>;

/** Event payload: state:changed。state 为规则专属团内状态 JSON */
export const CharacterStateChangedEvent = z.object({
  characterId: z.string(),
  kind: z.enum(["pc", "npc"]),
  state: z.unknown(),
  /** 阈值提示（如单次 SAN 损失 >= 5），仅随 gmOnly 事件携带 */
  hints: z.array(z.string()).optional(),
});
export type CharacterStateChangedEvent = z.infer<typeof CharacterStateChangedEvent>;
