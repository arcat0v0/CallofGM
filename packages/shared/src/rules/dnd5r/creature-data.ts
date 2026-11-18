import type { Ability, DamageType, Skill } from "./gameplay";
import type { AbilityScores, AttackDamage } from "./sheet";

interface CreatureAttack {
	id: string;
	name: string;
	attackBonus: number;
	damageBonus: number;
	damage: AttackDamage;
}

interface CreatureEntry {
	name: string;
	cr: string;
	abilities: AbilityScores;
	armorClass: number;
	maxHp: number;
	speed: number;
	initiative: number;
	passivePerception?: number;
	attacks: readonly CreatureAttack[];
	saves?: Partial<Record<Ability, number>>;
	skills?: Partial<Record<Skill, number>>;
	immunities?: readonly DamageType[];
	vulnerabilities?: readonly DamageType[];
}

function creature(
	name: string,
	cr: string,
	[str, dex, con, int, wis, cha]: [
		number,
		number,
		number,
		number,
		number,
		number,
	],
	armorClass: number,
	maxHp: number,
	speed: number,
	initiative: number,
	attacks: CreatureAttack[],
	extra: Partial<
		Pick<
			CreatureEntry,
			| "saves"
			| "skills"
			| "passivePerception"
			| "immunities"
			| "vulnerabilities"
		>
	> = {},
): CreatureEntry {
	return {
		name,
		cr,
		abilities: { str, dex, con, int, wis, cha },
		armorClass,
		maxHp,
		speed,
		initiative,
		attacks,
		...extra,
	};
}

function attack(
	id: string,
	name: string,
	attackBonus: number,
	count: number,
	sides: AttackDamage["sides"],
	damageBonus: number,
	type: DamageType,
): CreatureAttack {
	return { id, name, attackBonus, damageBonus, damage: { count, sides, type } };
}

export const CREATURES: Readonly<Record<string, CreatureEntry>> = {
	"air-elemental": creature(
		"Air Elemental",
		"5",
		[14, 20, 14, 6, 10, 6],
		15,
		90,
		10,
		5,
		[attack("thunderous-slam", "Thunderous Slam", 8, 2, 8, 5, "thunder")],
		{ immunities: ["poison", "thunder"] },
	),
	bandit: creature("Bandit", "1/8", [11, 12, 12, 10, 10, 10], 12, 11, 30, 1, [
		attack("scimitar", "Scimitar", 3, 1, 6, 1, "slashing"),
		attack("light-crossbow", "Light Crossbow", 3, 1, 8, 1, "piercing"),
	]),
	"black-bear": creature(
		"Black Bear",
		"1/2",
		[15, 12, 14, 2, 12, 7],
		11,
		19,
		30,
		1,
		[attack("rend", "Rend", 4, 1, 6, 2, "slashing")],
		{ skills: { perception: 5 }, passivePerception: 15 },
	),
	commoner: creature("Commoner", "0", [10, 10, 10, 10, 10, 10], 10, 4, 30, 0, [
		attack("club", "Club", 2, 1, 4, 0, "bludgeoning"),
	]),
	cultist: creature(
		"Cultist",
		"1/8",
		[11, 12, 10, 10, 11, 10],
		12,
		9,
		30,
		1,
		[attack("ritual-sickle", "Ritual Sickle", 3, 1, 4, 1, "slashing")],
		{ saves: { wis: 2 }, skills: { deception: 2, religion: 2 } },
	),
	"giant-rat": creature(
		"Giant Rat",
		"1/8",
		[7, 16, 11, 2, 10, 4],
		13,
		7,
		30,
		3,
		[attack("bite", "Bite", 5, 1, 4, 3, "piercing")],
		{ saves: { dex: 5 }, skills: { perception: 2 }, passivePerception: 12 },
	),
	"goblin-minion": creature(
		"Goblin Minion",
		"1/8",
		[8, 15, 10, 10, 8, 8],
		12,
		7,
		30,
		2,
		[attack("dagger", "Dagger", 4, 1, 4, 2, "piercing")],
		{ skills: { stealth: 6 }, passivePerception: 9 },
	),
	"goblin-warrior": creature(
		"Goblin Warrior",
		"1/4",
		[8, 15, 10, 10, 8, 8],
		15,
		10,
		30,
		2,
		[
			attack("scimitar", "Scimitar", 4, 1, 6, 2, "slashing"),
			attack("shortbow", "Shortbow", 4, 1, 6, 2, "piercing"),
		],
		{ skills: { stealth: 6 }, passivePerception: 9 },
	),
	guard: creature(
		"Guard",
		"1/8",
		[13, 12, 12, 10, 11, 10],
		16,
		11,
		30,
		1,
		[attack("spear", "Spear", 3, 1, 6, 1, "piercing")],
		{ skills: { perception: 2 }, passivePerception: 12 },
	),
	ogre: creature("Ogre", "2", [19, 8, 16, 5, 7, 7], 11, 68, 40, -1, [
		attack("greatclub", "Greatclub", 6, 2, 8, 4, "bludgeoning"),
		attack("javelin", "Javelin", 6, 2, 6, 4, "piercing"),
	]),
	skeleton: creature(
		"Skeleton",
		"1/4",
		[10, 16, 15, 6, 8, 5],
		14,
		13,
		30,
		3,
		[
			attack("shortsword", "Shortsword", 5, 1, 6, 3, "piercing"),
			attack("shortbow", "Shortbow", 5, 1, 6, 3, "piercing"),
		],
		{ immunities: ["poison"], vulnerabilities: ["bludgeoning"] },
	),
	wolf: creature(
		"Wolf",
		"1/4",
		[14, 15, 12, 3, 12, 6],
		12,
		11,
		40,
		2,
		[attack("bite", "Bite", 4, 1, 6, 2, "piercing")],
		{ skills: { perception: 5, stealth: 4 }, passivePerception: 15 },
	),
	zombie: creature(
		"Zombie",
		"1/4",
		[13, 6, 16, 3, 6, 5],
		8,
		15,
		20,
		-2,
		[attack("slam", "Slam", 3, 1, 8, 1, "bludgeoning")],
		{ saves: { wis: 0 }, immunities: ["poison"] },
	),
};
