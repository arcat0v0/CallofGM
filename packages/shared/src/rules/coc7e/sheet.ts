import { z } from "zod";

export const Coc7eAttributes = z.object({
  str: z.number().int().min(1).max(99),
  con: z.number().int().min(1).max(99),
  siz: z.number().int().min(1).max(99),
  dex: z.number().int().min(1).max(99),
  app: z.number().int().min(1).max(99),
  int: z.number().int().min(1).max(99),
  pow: z.number().int().min(1).max(99),
  edu: z.number().int().min(1).max(99),
  luck: z.number().int().min(1).max(99),
});
export type Coc7eAttributes = z.infer<typeof Coc7eAttributes>;

export const Coc7eCharacterSheet = z.object({
  attributes: Coc7eAttributes,
  skills: z.record(z.string(), z.number().int().min(0).max(99)),
});
export type Coc7eCharacterSheet = z.infer<typeof Coc7eCharacterSheet>;
