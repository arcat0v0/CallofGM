import { z } from "zod";
import { safeMultiLineText, safeSingleLineText } from "../../text-safety";
import {
	ARMORS,
	BACKGROUNDS,
	CLASSES,
	CREATURES,
	SPECIES,
	SPELLS,
	WEAPONS,
} from "./catalog";
import { Ability, catalogId, DamageType, Skill } from "./gameplay";

export const AbilityScores = z.strictObject({
	str: z.number().int().min(1).max(30),
	dex: z.number().int().min(1).max(30),
	con: z.number().int().min(1).max(30),
	int: z.number().int().min(1).max(30),
	wis: z.number().int().min(1).max(30),
	cha: z.number().int().min(1).max(30),
});
export type AbilityScores = z.infer<typeof AbilityScores>;

export const AttackDamage = z.strictObject({
	count: z.number().int().min(0).max(20),
	sides: z.union([
		z.literal(4),
		z.literal(6),
		z.literal(8),
		z.literal(10),
		z.literal(12),
	]),
	type: DamageType,
});
export type AttackDamage = z.infer<typeof AttackDamage>;
const label = safeSingleLineText({ min: 1, max: 120 });
const attackBonus = z.number().int().min(-10).max(30);
export const CustomAttack = z.strictObject({
	id: catalogId,
	name: label,
	damage: AttackDamage,
	ability: Ability.default("str"),
	proficient: z.boolean().default(true),
	attackBonus: attackBonus.optional(),
	damageBonus: attackBonus.optional(),
});
export type CustomAttack = z.infer<typeof CustomAttack>;

const Resource = z.strictObject({
	id: catalogId,
	name: label,
	max: z.number().int().min(1).max(99),
	recharge: z.enum(["short", "long", "manual"]),
});
export type Resource = z.infer<typeof Resource>;
const classId = z.enum([...Object.keys(CLASSES), "custom"]);
const speciesId = z.enum([...Object.keys(SPECIES), "custom"]);
const backgroundId = z.enum([...Object.keys(BACKGROUNDS), "custom"]);
const idList = z.array(catalogId).max(256);

export const CharacterSheet = z
	.strictObject({
		level: z.number().int().min(1).max(20),
		abilities: AbilityScores,
		classId,
		className: label.optional(),
		subclass: safeSingleLineText({ max: 120 }).default(""),
		speciesId,
		speciesName: label.optional(),
		backgroundId,
		backgroundName: label.optional(),
		skills: z.array(Skill).max(18).default([]),
		expertise: z.array(Skill).max(18).default([]),
		saveProficiencies: z.array(Ability).max(6).optional(),
		armorId: catalogId.nullable().default(null),
		shield: z.boolean().default(false),
		weaponIds: idList.default([]),
		spellIds: idList.default([]),
		customAttacks: z.array(CustomAttack).max(32).default([]),
		customSpells: z
			.array(
				z.strictObject({ name: label, level: z.number().int().min(0).max(9) }),
			)
			.max(64)
			.default([]),
		inventory: z
			.array(
				z.strictObject({
					name: label,
					quantity: z.number().int().min(1).max(9999),
				}),
			)
			.max(100)
			.default([]),
		feats: z.array(label).max(32).default([]),
		languages: z.array(label).max(32).default([]),
		notes: safeMultiLineText({ max: 8000 }).default(""),
		maxHpOverride: z.number().int().min(1).max(9999).optional(),
		armorClassOverride: z.number().int().min(1).max(40).optional(),
		speedOverride: z.number().int().min(0).max(300).optional(),
		hitDieOverride: z
			.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)])
			.optional(),
		spellcastingAbility: Ability.optional(),
		spellSlotsOverride: z
			.array(z.number().int().min(0).max(20))
			.max(9)
			.optional(),
		experiencePoints: z.number().int().min(0).max(999999999).optional(),
		initiativeModifier: attackBonus.optional(),
		resistances: z.array(DamageType).max(13).default([]),
		immunities: z.array(DamageType).max(13).default([]),
		vulnerabilities: z.array(DamageType).max(13).default([]),
		resources: z.array(Resource).max(32).default([]),
		creatureId: catalogId.optional(),
	})
	.superRefine((sheet, ctx) => {
		const invalid = (path: string, message: string) =>
			ctx.addIssue({ code: "custom", path: [path], message });
		for (const [field, ids, catalog] of [
			["armorId", sheet.armorId ? [sheet.armorId] : [], ARMORS],
			["weaponIds", sheet.weaponIds, WEAPONS],
			["spellIds", sheet.spellIds, SPELLS],
			["creatureId", sheet.creatureId ? [sheet.creatureId] : [], CREATURES],
		] as const) {
			if (ids.some((id) => !Object.hasOwn(catalog, id)))
				invalid(field, "Unknown catalog entry");
			if (new Set(ids).size !== ids.length)
				invalid(field, "Duplicate catalog entry");
		}
		for (const [field, choices] of [
			["skills", sheet.skills],
			["expertise", sheet.expertise],
			["saveProficiencies", sheet.saveProficiencies ?? []],
			["customAttacks", sheet.customAttacks.map(({ id }) => id)],
			["resources", sheet.resources.map(({ id }) => id)],
		] as const) {
			if (new Set(choices).size !== choices.length)
				invalid(field, "Duplicate choice");
		}
		if (
			sheet.customAttacks.some(
				({ id }) => sheet.weaponIds.includes(id) || id === "unarmed",
			)
		)
			invalid("customAttacks", "Attack ID is already in use");
		const background = BACKGROUNDS[sheet.backgroundId];
		const species = SPECIES[sheet.speciesId];
		if (
			sheet.expertise.some(
				(skill) =>
					!sheet.skills.includes(skill) &&
					!background?.skills.includes(skill) &&
					!species?.skills?.includes(skill),
			)
		)
			invalid("expertise", "Expertise requires skill proficiency");
	});
export type CharacterSheet = z.infer<typeof CharacterSheet>;

export function createBlankSheet(): CharacterSheet {
	return CharacterSheet.parse({
		level: 1,
		abilities: { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 },
		classId: "fighter",
		speciesId: "human",
		backgroundId: "soldier",
		skills: ["perception", "survival", "insight"],
		armorId: "chain-mail",
		shield: true,
		weaponIds: ["longsword", "javelin"],
		languages: ["Common", "Dwarvish", "Elvish"],
	});
}
