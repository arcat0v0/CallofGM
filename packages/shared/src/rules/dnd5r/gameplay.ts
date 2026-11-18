import { z } from "zod";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const Ability = z.enum(ABILITIES);
export type Ability = z.infer<typeof Ability>;

export const SKILLS = {
	acrobatics: "dex",
	"animal-handling": "wis",
	arcana: "int",
	athletics: "str",
	deception: "cha",
	history: "int",
	insight: "wis",
	intimidation: "cha",
	investigation: "int",
	medicine: "wis",
	nature: "int",
	perception: "wis",
	performance: "cha",
	persuasion: "cha",
	religion: "int",
	"sleight-of-hand": "dex",
	stealth: "dex",
	survival: "wis",
} as const satisfies Record<string, Ability>;
export const Skill = z.enum(Object.keys(SKILLS) as (keyof typeof SKILLS)[]);
export type Skill = z.infer<typeof Skill>;

export const CONDITIONS = [
	"blinded",
	"charmed",
	"deafened",
	"exhaustion",
	"frightened",
	"grappled",
	"incapacitated",
	"invisible",
	"paralyzed",
	"petrified",
	"poisoned",
	"prone",
	"restrained",
	"stunned",
	"unconscious",
] as const;
export const Condition = z.enum(CONDITIONS);
export type Condition = z.infer<typeof Condition>;

export const DAMAGE_TYPES = [
	"acid",
	"bludgeoning",
	"cold",
	"fire",
	"force",
	"lightning",
	"necrotic",
	"piercing",
	"poison",
	"psychic",
	"radiant",
	"slashing",
	"thunder",
] as const;
export const DamageType = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof DamageType>;
export const RollMode = z.enum(["normal", "advantage", "disadvantage"]);
export type RollMode = z.infer<typeof RollMode>;
export const catalogId = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	.max(56);
const characterId = z.string().min(1).max(128);
export const CheckOptions = z.strictObject({
	mode: RollMode.optional(),
	dc: z.number().int().min(1).max(40).optional(),
	targetId: characterId.optional(),
	ability: Ability.optional(),
	twoHanded: z.boolean().optional(),
});
export type CheckOptions = z.infer<typeof CheckOptions>;

export const CheckResult = z.object({
	ruleId: z.literal("dnd5r"),
	kind: z.enum(["ability", "skill", "save", "attack", "initiative", "death"]),
	mode: RollMode,
	rolls: z.array(z.number().int().min(1).max(20)).min(1).max(2),
	roll: z.number().int().min(1).max(20),
	modifier: z.number().int(),
	total: z.number().int(),
	dc: z.number().int().nullable(),
	outcome: z.enum([
		"rolled",
		"success",
		"failure",
		"critical",
		"miss",
		"hit",
		"stable",
		"dead",
		"revived",
	]),
	success: z.boolean().nullable(),
	damage: z
		.object({
			type: DamageType,
			rolls: z.array(z.number().int()),
			sides: z.number().int(),
			modifier: z.number().int(),
			total: z.number().int(),
		})
		.optional(),
	targetId: characterId.optional(),
});
export type CheckResult = z.infer<typeof CheckResult>;

export const EncounterState = z.object({
	round: z.number().int().positive(),
	turnIndex: z.number().int().nonnegative(),
	combatants: z
		.array(
			z.object({
				characterId,
				name: z.string(),
				kind: z.enum(["pc", "npc"]),
				initiative: z.number().int(),
			}),
		)
		.min(1)
		.max(100),
});
export type EncounterState = z.infer<typeof EncounterState>;

const amount = z.number().int().min(1).max(9999);
export const Action = z.discriminatedUnion("action", [
	z.strictObject({
		action: z.literal("damage"),
		characterId,
		input: z.strictObject({
			amount,
			type: DamageType.optional(),
			critical: z.boolean().optional(),
		}),
	}),
	z.strictObject({
		action: z.literal("heal"),
		characterId,
		input: z.strictObject({ amount }),
	}),
	z.strictObject({
		action: z.literal("temp-hp"),
		characterId,
		input: z.strictObject({ amount, replace: z.boolean().optional() }),
	}),
	z.strictObject({
		action: z.literal("short-rest"),
		characterId,
		input: z
			.strictObject({ hitDice: z.number().int().min(0).max(20) })
			.optional(),
	}),
	z.strictObject({ action: z.literal("long-rest"), characterId }),
	z.strictObject({
		action: z.literal("condition"),
		characterId,
		input: z.strictObject({
			condition: Condition,
			active: z.boolean(),
			level: z.number().int().min(1).max(6).optional(),
		}),
	}),
	z.strictObject({
		action: z.literal("spell-slot"),
		characterId,
		input: z.strictObject({
			level: z.number().int().min(1).max(9),
			restore: z.boolean().optional(),
		}),
	}),
	z.strictObject({
		action: z.literal("resource"),
		characterId,
		input: z.strictObject({
			id: catalogId,
			delta: z.number().int().min(-100).max(100),
		}),
	}),
	z.strictObject({ action: z.literal("stabilize"), characterId }),
	z.strictObject({
		action: z.literal("encounter-start"),
		input: z.strictObject({
			characterIds: z.array(characterId).min(1).max(100),
			initiatives: z
				.record(characterId, z.number().int().min(-30).max(100))
				.optional(),
		}),
	}),
	z.strictObject({ action: z.literal("encounter-next") }),
	z.strictObject({ action: z.literal("encounter-end") }),
]);
export type Action = z.infer<typeof Action>;
