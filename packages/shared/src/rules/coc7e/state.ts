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
  hp: z.number().int().min(0),
  maxHp: z.number().int().min(1),
  mp: z.number().int().min(0),
  maxMp: z.number().int().min(0),
  san: z.number().int().min(0),
  maxSan: z.number().int().min(0),
  statuses: z.array(CharacterStatusFlag),
  tags: z.array(z.string()),
  growthMarks: z.array(z.string()),
});
export type CharacterSessionState = z.infer<typeof CharacterSessionState>;
