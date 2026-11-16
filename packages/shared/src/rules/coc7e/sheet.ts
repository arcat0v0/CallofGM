import { z } from "zod";
import { canonicalizeCoc7eSkillKey } from "./skills";

export const Coc7eAttributeKey = z.enum([
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
]);
export type Coc7eAttributeKey = z.infer<typeof Coc7eAttributeKey>;

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

export const Coc7eEra = z.enum(["1920s", "modern"]);
export type Coc7eEra = z.infer<typeof Coc7eEra>;

const longText = z.string().trim().max(4000);
const money = z.number().finite().min(0).max(1_000_000_000_000_000);

export const Coc7eProfileInfo = z.object({
	gender: z.string().trim().max(40).default(""),
	residence: z.string().trim().max(120).default(""),
	birthplace: z.string().trim().max(120).default(""),
	appearance: z.string().trim().max(1000).default(""),
	storiedInvestigator: z.boolean().default(false),
	experienceBonusPoints: z.number().int().min(0).max(500).default(100),
});
export type Coc7eProfileInfo = z.infer<typeof Coc7eProfileInfo>;

export const Coc7eBackgroundFieldKey = z.enum([
	"ideologyBeliefs",
	"significantPeople",
	"meaningfulLocations",
	"treasuredPossessions",
	"traits",
	"injuriesScars",
	"phobiasManias",
	"appearanceSummary",
]);
export type Coc7eBackgroundFieldKey = z.infer<typeof Coc7eBackgroundFieldKey>;

export const Coc7eBackgroundProfile = z.object({
	ideologyBeliefs: longText.default(""),
	significantPeople: longText.default(""),
	meaningfulLocations: longText.default(""),
	treasuredPossessions: longText.default(""),
	traits: longText.default(""),
	injuriesScars: longText.default(""),
	phobiasManias: longText.default(""),
	appearanceSummary: longText.default(""),
	keyConnection: Coc7eBackgroundFieldKey.nullable().default(null),
	keyConnectionStory: longText.default(""),
	partnerCharacterId: z.string().trim().max(120).nullable().default(null),
	partnerName: z.string().trim().max(100).default(""),
});
export type Coc7eBackgroundProfile = z.infer<typeof Coc7eBackgroundProfile>;

export const Coc7eGearSlot = z.enum([
	"none",
	"head",
	"chest",
	"waist",
	"hand",
	"other",
]);
export type Coc7eGearSlot = z.infer<typeof Coc7eGearSlot>;

export const Coc7eGearStatus = z.enum(["in_use", "lent", "lost"]);
export type Coc7eGearStatus = z.infer<typeof Coc7eGearStatus>;

export const Coc7eExperienceEntry = z.object({
	id: z.string().trim().min(1).max(120),
	title: z.string().trim().min(1).max(200),
	sourceType: z.enum(["manual", "record", "session_phase"]).default("manual"),
	refKind: z
		.enum(["spell", "tome", "encounter", "phase"])
		.nullable()
		.default(null),
	refId: z.string().trim().max(120).nullable().default(null),
	refLabel: z.string().trim().max(240).default(""),
	summary: longText.default(""),
	changes: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
	occurredLabel: z.string().trim().max(80).default(""),
});
export type Coc7eExperienceEntry = z.infer<typeof Coc7eExperienceEntry>;

export const Coc7eSkillAllocationEntry = z.object({
	occupation: z.number().int().min(0).max(999).default(0),
	interest: z.number().int().min(0).max(999).default(0),
	experience: z.number().int().min(0).max(999).default(0),
});
export type Coc7eSkillAllocationEntry = z.infer<
	typeof Coc7eSkillAllocationEntry
>;

export const Coc7eOccupation = z.object({
	presetId: z.string().trim().max(64).nullable().default(null),
	name: z.string().trim().max(100).default(""),
	skillPointFormula: z
		.array(
			z.object({
				attribute: Coc7eAttributeKey,
				multiplier: z.number().int().min(1).max(8),
			}),
		)
		.max(4)
		.default([]),
	creditMin: z.number().int().min(0).max(99).default(0),
	creditMax: z.number().int().min(0).max(99).default(99),
	skillKeys: z.array(z.string().trim().min(1).max(100)).max(32).default([]),
	choiceSelections: z
		.record(
			z.string().trim().min(1).max(40),
			z.array(z.string().trim().min(1).max(100)).max(16),
		)
		.default({}),
	freeSkillKeys: z.array(z.string().trim().min(1).max(100)).max(16).default([]),
});
export type Coc7eOccupation = z.infer<typeof Coc7eOccupation>;

export const Coc7eCustomSkill = z.object({
	base: z.number().int().min(0).max(99),
	formula: z.enum(["halfDex", "edu"]).optional(),
});
export type Coc7eCustomSkill = z.infer<typeof Coc7eCustomSkill>;

export const Coc7eWeapon = z.object({
	name: z.string().trim().min(1).max(100),
	skillKey: z.string().trim().min(1).max(100),
	damage: z.string().trim().min(1).max(100),
	range: z.string().trim().max(100).default(""),
	attacks: z.string().trim().max(40).default(""),
	ammo: z.number().int().min(0).max(999).nullable().default(null),
	malfunction: z.number().int().min(0).max(999).nullable().default(null),
	impale: z.boolean().default(false),
	applyDamageBonus: z.boolean().default(false),
});
export type Coc7eWeapon = z.infer<typeof Coc7eWeapon>;

export const Coc7eArmor = z.object({
	name: z.string().trim().max(100).default(""),
	value: z.number().int().min(0).max(99).default(0),
	locations: z.string().trim().max(200).default(""),
	penalty: z.number().int().min(0).max(99).default(0),
});
export type Coc7eArmor = z.infer<typeof Coc7eArmor>;

export const Coc7eGearItem = z.object({
	name: z.string().trim().min(1).max(200),
	quantity: z.number().int().min(0).max(9999).default(1),
	slot: Coc7eGearSlot.optional(),
	status: Coc7eGearStatus.optional(),
	note: z.string().trim().max(400).optional(),
	linkedPossession: z.boolean().optional(),
});
export type Coc7eGearItem = z.infer<typeof Coc7eGearItem>;

export const Coc7eSpell = z.object({
	name: z.string().trim().min(1).max(200),
	mpCost: z.string().trim().max(100).default(""),
	sanCost: z.string().trim().max(100).default(""),
	castingTime: z.string().trim().max(100).default(""),
	effect: longText.default(""),
});
export type Coc7eSpell = z.infer<typeof Coc7eSpell>;

export const Coc7eMythosTome = z.object({
	name: z.string().trim().min(1).max(200),
	sanLoss: z.string().trim().max(100).default(""),
	mythosGain: z.number().int().min(0).max(999).default(0),
	studyHours: z.number().finite().min(0).max(1_000_000).default(0),
	spells: longText.default(""),
});
export type Coc7eMythosTome = z.infer<typeof Coc7eMythosTome>;

export const Coc7eEncounter = z.object({
	name: z.string().trim().min(1).max(200),
	sanLoss: z.string().trim().max(100).default(""),
	mythosGain: z.number().int().min(0).max(999).default(0),
	count: z.number().int().min(0).max(9999).default(1),
	notes: longText.default(""),
});
export type Coc7eEncounter = z.infer<typeof Coc7eEncounter>;

export const Coc7eAssetDetail = z.object({
	category: z.enum(["transport", "residence", "luxury", "securities", "other"]),
	name: z.string().trim().min(1).max(200),
	value: money,
});
export type Coc7eAssetDetail = z.infer<typeof Coc7eAssetDetail>;

export const Coc7eAssets = z.object({
	currency: z.string().trim().min(1).max(16).default("$"),
	spendingLevel: money.default(0),
	cash: money.default(0),
	otherAssets: money.default(0),
	details: z.array(Coc7eAssetDetail).max(200).default([]),
});
export type Coc7eAssets = z.infer<typeof Coc7eAssets>;

const emptyOccupation = {
	presetId: null,
	name: "",
	skillPointFormula: [],
	creditMin: 0,
	creditMax: 99,
	skillKeys: [],
	choiceSelections: {},
	freeSkillKeys: [],
} satisfies Coc7eOccupation;

const emptyArmor = {
	name: "",
	value: 0,
	locations: "",
	penalty: 0,
} satisfies Coc7eArmor;
const emptyAssets = {
	currency: "$",
	spendingLevel: 0,
	cash: 0,
	otherAssets: 0,
	details: [],
} satisfies Coc7eAssets;
const emptyProfile = {
	gender: "",
	residence: "",
	birthplace: "",
	appearance: "",
	storiedInvestigator: false,
	experienceBonusPoints: 100,
} satisfies Coc7eProfileInfo;
const emptyBackgroundProfile = {
	ideologyBeliefs: "",
	significantPeople: "",
	meaningfulLocations: "",
	treasuredPossessions: "",
	traits: "",
	injuriesScars: "",
	phobiasManias: "",
	appearanceSummary: "",
	keyConnection: null,
	keyConnectionStory: "",
	partnerCharacterId: null,
	partnerName: "",
} satisfies Coc7eBackgroundProfile;

const Coc7eCharacterSheetV2 = z.object({
	schemaVersion: z.literal(2).default(2),
	era: Coc7eEra.default("1920s"),
	age: z.number().int().min(15).max(90).nullable().default(null),
	profile: Coc7eProfileInfo.default(emptyProfile),
	backgroundProfile: Coc7eBackgroundProfile.default(emptyBackgroundProfile),
	occupation: Coc7eOccupation.default(emptyOccupation),
	movementModifier: z.number().int().min(-20).max(20).default(0),
	attributes: Coc7eAttributes,
	skills: z.record(
		z.string().trim().min(1).max(100),
		z.number().int().min(0).max(999),
	),
	skillAllocation: z
		.record(z.string().trim().min(1).max(100), Coc7eSkillAllocationEntry)
		.default({}),
	customSkills: z
		.record(z.string().trim().min(1).max(100), Coc7eCustomSkill)
		.default({}),
	weapons: z.array(Coc7eWeapon).max(100).default([]),
	armor: Coc7eArmor.default(emptyArmor),
	gear: z.array(Coc7eGearItem).max(200).default([]),
	spells: z.array(Coc7eSpell).max(100).default([]),
	mythosTomes: z.array(Coc7eMythosTome).max(100).default([]),
	encounters: z.array(Coc7eEncounter).max(100).default([]),
	experiences: z.array(Coc7eExperienceEntry).max(200).default([]),
	assets: Coc7eAssets.default(emptyAssets),
});
export type Coc7eCharacterSheet = z.infer<typeof Coc7eCharacterSheetV2>;

function normalizeSkillKeys(skills: unknown): unknown {
	if (!skills || typeof skills !== "object" || Array.isArray(skills)) {
		return skills;
	}
	const normalized: Record<string, unknown> = {};
	for (const [rawKey, value] of Object.entries(skills)) {
		const key = canonicalizeCoc7eSkillKey(rawKey) ?? rawKey;
		if (normalized[key] === undefined || key === rawKey) {
			normalized[key] = value;
		}
	}
	return normalized;
}

export const Coc7eCharacterSheet = z.preprocess((input) => {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return input;
	}
	const value = input as Record<string, unknown>;
	return {
		...value,
		schemaVersion: 2,
		skills: normalizeSkillKeys(value.skills),
	};
}, Coc7eCharacterSheetV2);

export function normalizeCoc7eSheet(input: unknown): Coc7eCharacterSheet {
	return Coc7eCharacterSheet.parse(input);
}

export function createEmptyCoc7eSheet(
	attributes: Coc7eAttributes,
): Coc7eCharacterSheet {
	return normalizeCoc7eSheet({ attributes, skills: {} });
}

export function createEmptyCoc7eAssets(): Coc7eAssets {
	return structuredClone(emptyAssets);
}

export function createEmptyCoc7eArmor(): Coc7eArmor {
	return { ...emptyArmor };
}

export function createEmptyCoc7eProfile(): Coc7eProfileInfo {
	return { ...emptyProfile };
}

export function createEmptyCoc7eBackgroundProfile(): Coc7eBackgroundProfile {
	return { ...emptyBackgroundProfile };
}
