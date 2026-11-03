import { z } from "zod";

export const DiceRollResult = z.object({
	expression: z.string(),
	detail: z.string(),
	total: z.number().int(),
	comment: z.string().optional(),
});
export type DiceRollResult = z.infer<typeof DiceRollResult>;
