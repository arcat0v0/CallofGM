import { z } from "zod";

export const CharacterStatusFlag = z.enum([
  "major_wound",
  "dying",
  "unconscious",
  "temp_insanity",
  "indefinite_insanity",
  "dead",
]);
export type CharacterStatusFlag = z.infer<typeof CharacterStatusFlag>;

export const CharacterStatusFlagLabel: Record<CharacterStatusFlag, string> = {
  major_wound: "重伤",
  dying: "濒死",
  unconscious: "昏迷",
  temp_insanity: "临时疯狂",
  indefinite_insanity: "不定性疯狂",
  dead: "死亡",
};

export const CharacterSessionState = z.object({
  schemaVersion: z.literal(1).default(1),
  sessionId: z.string(),
  characterId: z.string(),
  hp: z.number().int().min(0).max(99),
  maxHp: z.number().int().min(1).max(99),
  mp: z.number().int().min(0).max(99),
  maxMp: z.number().int().min(0).max(99),
  san: z.number().int().min(0).max(99),
  maxSan: z.number().int().min(0).max(99),
  statuses: z.array(CharacterStatusFlag),
  tags: z.array(z.string()),
  growthMarks: z.array(z.string()),
  hiddenGrowthMarks: z.array(z.string()).default([]),
});

export const Coc7eStateEditInput = z.object({
  hp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).max(99).optional(),
  mp: z.number().int().min(0).optional(),
  maxMp: z.number().int().min(0).max(99).optional(),
  san: z.number().int().min(0).optional(),
  maxSan: z.number().int().min(0).max(99).optional(),
  hpDelta: z.number().int().optional(),
  mpDelta: z.number().int().optional(),
  sanDelta: z.number().int().optional(),
  addStatuses: z.array(z.string().max(32)).optional(),
  removeStatuses: z.array(z.string().max(32)).optional(),
  addTags: z.array(z.string().max(64)).optional(),
  removeTags: z.array(z.string().max(64)).optional(),
});
export type Coc7eStateEditInput = z.infer<typeof Coc7eStateEditInput>;
export type CharacterSessionState = z.infer<typeof CharacterSessionState>;

export function coc7eStateSummary(state: unknown): string | null {
  const parsed = CharacterSessionState.safeParse(state);
  if (!parsed.success) {
    return null;
  }
  const value = parsed.data;
  return `HP ${value.hp}/${value.maxHp} · MP ${value.mp}/${value.maxMp} · SAN ${value.san}/${value.maxSan}`;
}
