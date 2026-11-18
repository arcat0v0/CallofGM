import type { Ability, DamageType, Skill } from "./gameplay";
import type { AttackDamage } from "./sheet";
import { SPELL_ROWS } from "./spell-data";
import { CREATURES } from "./creature-data";

export { CREATURES };
export const SRD_ATTRIBUTION =
	"This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";
export const SRD_URL =
	"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";

export interface ClassEntry {
	name: string;
	hitDie: 6 | 8 | 10 | 12;
	saves: readonly Ability[];
	armor: readonly ("light" | "medium" | "heavy" | "shield")[];
	weapons: "simple" | "martial" | "finesse-light";
	spellcastingAbility?: Ability;
	casting?: "full" | "half" | "pact";
	subclass: string;
}

export const CLASSES: Readonly<Record<string, ClassEntry>> = {
	barbarian: {
		name: "Barbarian",
		hitDie: 12,
		saves: ["str", "con"],
		armor: ["light", "medium", "shield"],
		weapons: "martial",
		subclass: "Path of the Berserker",
	},
	bard: {
		name: "Bard",
		hitDie: 8,
		saves: ["dex", "cha"],
		armor: ["light"],
		weapons: "simple",
		spellcastingAbility: "cha",
		casting: "full",
		subclass: "College of Lore",
	},
	cleric: {
		name: "Cleric",
		hitDie: 8,
		saves: ["wis", "cha"],
		armor: ["light", "medium", "shield"],
		weapons: "simple",
		spellcastingAbility: "wis",
		casting: "full",
		subclass: "Life Domain",
	},
	druid: {
		name: "Druid",
		hitDie: 8,
		saves: ["int", "wis"],
		armor: ["light", "shield"],
		weapons: "simple",
		spellcastingAbility: "wis",
		casting: "full",
		subclass: "Circle of the Land",
	},
	fighter: {
		name: "Fighter",
		hitDie: 10,
		saves: ["str", "con"],
		armor: ["light", "medium", "heavy", "shield"],
		weapons: "martial",
		subclass: "Champion",
	},
	monk: {
		name: "Monk",
		hitDie: 8,
		saves: ["str", "dex"],
		armor: [],
		weapons: "finesse-light",
		subclass: "Warrior of the Open Hand",
	},
	paladin: {
		name: "Paladin",
		hitDie: 10,
		saves: ["wis", "cha"],
		armor: ["light", "medium", "heavy", "shield"],
		weapons: "martial",
		spellcastingAbility: "cha",
		casting: "half",
		subclass: "Oath of Devotion",
	},
	ranger: {
		name: "Ranger",
		hitDie: 10,
		saves: ["str", "dex"],
		armor: ["light", "medium", "shield"],
		weapons: "martial",
		spellcastingAbility: "wis",
		casting: "half",
		subclass: "Hunter",
	},
	rogue: {
		name: "Rogue",
		hitDie: 8,
		saves: ["dex", "int"],
		armor: ["light"],
		weapons: "finesse-light",
		subclass: "Thief",
	},
	sorcerer: {
		name: "Sorcerer",
		hitDie: 6,
		saves: ["con", "cha"],
		armor: [],
		weapons: "simple",
		spellcastingAbility: "cha",
		casting: "full",
		subclass: "Draconic Sorcery",
	},
	warlock: {
		name: "Warlock",
		hitDie: 8,
		saves: ["wis", "cha"],
		armor: ["light"],
		weapons: "simple",
		spellcastingAbility: "cha",
		casting: "pact",
		subclass: "Fiend Patron",
	},
	wizard: {
		name: "Wizard",
		hitDie: 6,
		saves: ["int", "wis"],
		armor: [],
		weapons: "simple",
		spellcastingAbility: "int",
		casting: "full",
		subclass: "Evoker",
	},
};

type BackgroundEntry = {
	name: string;
	abilities: readonly Ability[];
	skills: readonly Skill[];
	feat: string;
	tool: string;
};
export const BACKGROUNDS: Readonly<Record<string, BackgroundEntry>> = {
	acolyte: {
		name: "Acolyte",
		abilities: ["int", "wis", "cha"],
		skills: ["insight", "religion"],
		feat: "Magic Initiate (Cleric)",
		tool: "Calligrapher’s Supplies",
	},
	criminal: {
		name: "Criminal",
		abilities: ["dex", "con", "int"],
		skills: ["sleight-of-hand", "stealth"],
		feat: "Alert",
		tool: "Thieves’ Tools",
	},
	sage: {
		name: "Sage",
		abilities: ["con", "int", "wis"],
		skills: ["arcana", "history"],
		feat: "Magic Initiate (Wizard)",
		tool: "Calligrapher’s Supplies",
	},
	soldier: {
		name: "Soldier",
		abilities: ["str", "dex", "con"],
		skills: ["athletics", "intimidation"],
		feat: "Savage Attacker",
		tool: "Gaming Set",
	},
};

type SpeciesEntry = {
	name: string;
	speed: number;
	darkvision?: number;
	hpPerLevel?: number;
	resistances?: readonly DamageType[];
	skills?: readonly Skill[];
};
export const SPECIES: Readonly<Record<string, SpeciesEntry>> = {
	dragonborn: { name: "Dragonborn", speed: 30, darkvision: 60 },
	dwarf: {
		name: "Dwarf",
		speed: 30,
		darkvision: 120,
		hpPerLevel: 1,
		resistances: ["poison"],
	},
	elf: { name: "Elf", speed: 30, darkvision: 60 },
	gnome: { name: "Gnome", speed: 30, darkvision: 60 },
	goliath: { name: "Goliath", speed: 35 },
	halfling: { name: "Halfling", speed: 30 },
	human: { name: "Human", speed: 30 },
	orc: { name: "Orc", speed: 30, darkvision: 120 },
	tiefling: { name: "Tiefling", speed: 30, darkvision: 60 },
};

type ArmorCategory = "light" | "medium" | "heavy";
type ArmorEntry = {
	name: string;
	category: ArmorCategory;
	ac: number;
	strength?: number;
	stealthDisadvantage?: boolean;
};
const armor = (
	name: string,
	category: ArmorCategory,
	ac: number,
	strength?: number,
	stealthDisadvantage?: boolean,
): ArmorEntry => ({ name, category, ac, strength, stealthDisadvantage });
export const ARMORS: Readonly<Record<string, ArmorEntry>> = {
	padded: armor("Padded Armor", "light", 11, undefined, true),
	leather: armor("Leather Armor", "light", 11),
	"studded-leather": armor("Studded Leather Armor", "light", 12),
	hide: armor("Hide Armor", "medium", 12),
	"chain-shirt": armor("Chain Shirt", "medium", 13),
	"scale-mail": armor("Scale Mail", "medium", 14, undefined, true),
	breastplate: armor("Breastplate", "medium", 14),
	"half-plate": armor("Half Plate Armor", "medium", 15, undefined, true),
	"ring-mail": armor("Ring Mail", "heavy", 14, undefined, true),
	"chain-mail": armor("Chain Mail", "heavy", 16, 13, true),
	splint: armor("Splint Armor", "heavy", 17, 15, true),
	plate: armor("Plate Armor", "heavy", 18, 15, true),
};

export type WeaponEntry = {
	name: string;
	category: "simple" | "martial";
	kind: "melee" | "ranged";
	damage: AttackDamage;
	mastery: string;
	properties: readonly string[];
	versatileDie?: AttackDamage["sides"];
	flatDamage?: number;
};
const weapon = (
	name: string,
	category: WeaponEntry["category"],
	kind: WeaponEntry["kind"],
	sides: AttackDamage["sides"],
	type: DamageType,
	mastery: string,
	properties: readonly string[] = [],
	versatileDie?: AttackDamage["sides"],
	count = 1,
	flatDamage?: number,
): WeaponEntry => ({
	name,
	category,
	kind,
	damage: { count, sides, type },
	mastery,
	properties,
	versatileDie,
	flatDamage,
});
export const WEAPONS: Readonly<Record<string, WeaponEntry>> = {
	club: weapon("Club", "simple", "melee", 4, "bludgeoning", "slow", ["light"]),
	dagger: weapon("Dagger", "simple", "melee", 4, "piercing", "nick", [
		"finesse",
		"light",
		"thrown",
	]),
	greatclub: weapon("Greatclub", "simple", "melee", 8, "bludgeoning", "push", [
		"two-handed",
	]),
	handaxe: weapon("Handaxe", "simple", "melee", 6, "slashing", "vex", [
		"light",
		"thrown",
	]),
	javelin: weapon("Javelin", "simple", "melee", 6, "piercing", "slow", [
		"thrown",
	]),
	"light-hammer": weapon(
		"Light Hammer",
		"simple",
		"melee",
		4,
		"bludgeoning",
		"nick",
		["light", "thrown"],
	),
	mace: weapon("Mace", "simple", "melee", 6, "bludgeoning", "sap"),
	quarterstaff: weapon(
		"Quarterstaff",
		"simple",
		"melee",
		6,
		"bludgeoning",
		"topple",
		["versatile"],
		8,
	),
	sickle: weapon("Sickle", "simple", "melee", 4, "slashing", "nick", ["light"]),
	spear: weapon(
		"Spear",
		"simple",
		"melee",
		6,
		"piercing",
		"sap",
		["thrown", "versatile"],
		8,
	),
	dart: weapon("Dart", "simple", "ranged", 4, "piercing", "vex", [
		"finesse",
		"thrown",
	]),
	"light-crossbow": weapon(
		"Light Crossbow",
		"simple",
		"ranged",
		8,
		"piercing",
		"slow",
		["ammunition", "loading", "two-handed"],
	),
	shortbow: weapon("Shortbow", "simple", "ranged", 6, "piercing", "vex", [
		"ammunition",
		"two-handed",
	]),
	sling: weapon("Sling", "simple", "ranged", 4, "bludgeoning", "slow", [
		"ammunition",
	]),
	battleaxe: weapon(
		"Battleaxe",
		"martial",
		"melee",
		8,
		"slashing",
		"topple",
		["versatile"],
		10,
	),
	flail: weapon("Flail", "martial", "melee", 8, "bludgeoning", "sap"),
	glaive: weapon("Glaive", "martial", "melee", 10, "slashing", "graze", [
		"heavy",
		"reach",
		"two-handed",
	]),
	greataxe: weapon("Greataxe", "martial", "melee", 12, "slashing", "cleave", [
		"heavy",
		"two-handed",
	]),
	greatsword: weapon(
		"Greatsword",
		"martial",
		"melee",
		6,
		"slashing",
		"graze",
		["heavy", "two-handed"],
		undefined,
		2,
	),
	halberd: weapon("Halberd", "martial", "melee", 10, "slashing", "cleave", [
		"heavy",
		"reach",
		"two-handed",
	]),
	lance: weapon("Lance", "martial", "melee", 10, "piercing", "topple", [
		"heavy",
		"reach",
		"two-handed-unmounted",
	]),
	longsword: weapon(
		"Longsword",
		"martial",
		"melee",
		8,
		"slashing",
		"sap",
		["versatile"],
		10,
	),
	maul: weapon(
		"Maul",
		"martial",
		"melee",
		6,
		"bludgeoning",
		"topple",
		["heavy", "two-handed"],
		undefined,
		2,
	),
	morningstar: weapon("Morningstar", "martial", "melee", 8, "piercing", "sap"),
	pike: weapon("Pike", "martial", "melee", 10, "piercing", "push", [
		"heavy",
		"reach",
		"two-handed",
	]),
	rapier: weapon("Rapier", "martial", "melee", 8, "piercing", "vex", [
		"finesse",
	]),
	scimitar: weapon("Scimitar", "martial", "melee", 6, "slashing", "nick", [
		"finesse",
		"light",
	]),
	shortsword: weapon("Shortsword", "martial", "melee", 6, "piercing", "vex", [
		"finesse",
		"light",
	]),
	trident: weapon(
		"Trident",
		"martial",
		"melee",
		8,
		"piercing",
		"topple",
		["thrown", "versatile"],
		10,
	),
	warhammer: weapon(
		"Warhammer",
		"martial",
		"melee",
		8,
		"bludgeoning",
		"push",
		["versatile"],
		10,
	),
	"war-pick": weapon(
		"War Pick",
		"martial",
		"melee",
		8,
		"piercing",
		"sap",
		["versatile"],
		10,
	),
	whip: weapon("Whip", "martial", "melee", 4, "slashing", "slow", [
		"finesse",
		"reach",
	]),
	blowgun: weapon(
		"Blowgun",
		"martial",
		"ranged",
		4,
		"piercing",
		"vex",
		["ammunition", "loading"],
		undefined,
		0,
		1,
	),
	"hand-crossbow": weapon(
		"Hand Crossbow",
		"martial",
		"ranged",
		6,
		"piercing",
		"vex",
		["ammunition", "light", "loading"],
	),
	"heavy-crossbow": weapon(
		"Heavy Crossbow",
		"martial",
		"ranged",
		10,
		"piercing",
		"push",
		["ammunition", "heavy", "loading", "two-handed"],
	),
	longbow: weapon("Longbow", "martial", "ranged", 8, "piercing", "slow", [
		"ammunition",
		"heavy",
		"two-handed",
	]),
	musket: weapon("Musket", "martial", "ranged", 12, "piercing", "slow", [
		"ammunition",
		"loading",
		"two-handed",
	]),
	pistol: weapon("Pistol", "martial", "ranged", 10, "piercing", "vex", [
		"ammunition",
		"loading",
	]),
};

export interface SpellEntry {
	name: string;
	level: number;
	school: string;
	classes: readonly string[];
}
export const SPELLS: Readonly<Record<string, SpellEntry>> = Object.fromEntries(
	SPELL_ROWS.map(([name, level, school, classes]) => [
		catalogKey(name),
		{ name, level, school, classes },
	]),
);
function catalogKey(name: string): string {
	return name
		.toLowerCase()
		.replace(/[’']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-$/, "");
}
