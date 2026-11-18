import { z } from "zod";
import { Condition, catalogId } from "./gameplay";

const slots = z.array(z.number().int().min(0).max(20)).max(9);
export const DeathSaves = z.object({
	successes: z.number().int().min(0).max(3),
	failures: z.number().int().min(0).max(3),
	stable: z.boolean(),
	dead: z.boolean(),
});
export const SessionState = z.object({
	hp: z.number().int().min(0).max(9999),
	maxHp: z.number().int().min(1).max(9999),
	tempHp: z.number().int().min(0).max(9999),
	conditions: z.array(Condition).max(14),
	exhaustion: z.number().int().min(0).max(6),
	deathSaves: DeathSaves,
	hitDice: z.number().int().min(0).max(20),
	maxHitDice: z.number().int().min(0).max(20),
	spellSlots: slots,
	maxSpellSlots: slots,
	resources: z.record(
		catalogId,
		z.object({
			name: z.string(),
			current: z.number().int().min(0),
			max: z.number().int().positive(),
			recharge: z.enum(["short", "long", "manual"]),
		}),
	),
});
export type SessionState = z.infer<typeof SessionState>;

export const SESSION_PUBLIC_FIELDS = ["hp", "tempHp", "conditions"] as const;
export const PublicSessionState = SessionState.pick({
	hp: true,
	maxHp: true,
	tempHp: true,
	conditions: true,
	exhaustion: true,
}).partial();
export type PublicSessionState = z.infer<typeof PublicSessionState>;
