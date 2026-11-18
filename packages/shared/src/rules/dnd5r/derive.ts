import {
	ARMORS,
	BACKGROUNDS,
	CLASSES,
	CREATURES,
	SPECIES,
	WEAPONS,
	type WeaponEntry,
} from "./catalog";
import {
	ABILITIES,
	type Ability,
	type DamageType,
	SKILLS,
	type Skill,
} from "./gameplay";
import type {
	AbilityScores,
	AttackDamage,
	CharacterSheet,
	Resource,
} from "./sheet";

const FULL_SLOTS = [
	[2],
	[3],
	[4, 2],
	[4, 3],
	[4, 3, 2],
	[4, 3, 3],
	[4, 3, 3, 1],
	[4, 3, 3, 2],
	[4, 3, 3, 3, 1],
	[4, 3, 3, 3, 2],
	[4, 3, 3, 3, 2, 1],
	[4, 3, 3, 3, 2, 1],
	[4, 3, 3, 3, 2, 1, 1],
	[4, 3, 3, 3, 2, 1, 1],
	[4, 3, 3, 3, 2, 1, 1, 1],
	[4, 3, 3, 3, 2, 1, 1, 1],
	[4, 3, 3, 3, 2, 1, 1, 1, 1],
	[4, 3, 3, 3, 3, 1, 1, 1, 1],
	[4, 3, 3, 3, 3, 2, 1, 1, 1],
	[4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const HALF_SLOTS = [
	[2],
	[2],
	[3],
	[3],
	[4, 2],
	[4, 2],
	[4, 3],
	[4, 3],
	[4, 3, 2],
	[4, 3, 2],
	[4, 3, 3],
	[4, 3, 3],
	[4, 3, 3, 1],
	[4, 3, 3, 1],
	[4, 3, 3, 2],
	[4, 3, 3, 2],
	[4, 3, 3, 3, 1],
	[4, 3, 3, 3, 1],
	[4, 3, 3, 3, 2],
	[4, 3, 3, 3, 2],
];

export const EXPERIENCE_THRESHOLDS = [
	0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
	120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const;

export interface DerivedAttack {
	id: string;
	name: string;
	ability: Ability;
	attackBonus: number;
	damageBonus: number;
	damage: AttackDamage;
	weapon?: WeaponEntry;
	abilityChoice?: boolean;
}

export interface DerivedCharacter {
	abilities: AbilityScores;
	abilityModifiers: Record<Ability, number>;
	proficiencyBonus: number;
	saveProficiencies: readonly Ability[];
	savingThrows: Record<Ability, number>;
	skillProficiencies: readonly Skill[];
	skillModifiers: Record<Skill, number>;
	maxHp: number;
	armorClass: number;
	armorTrained: boolean;
	stealthDisadvantage: boolean;
	initiative: number;
	speed: number;
	hitDie: 6 | 8 | 10 | 12;
	maxHitDice: number;
	spellcastingAbility: Ability | null;
	spellSaveDc: number | null;
	spellAttackBonus: number | null;
	spellSlots: readonly number[];
	pactMagic: boolean;
	passivePerception: number;
	attacks: readonly DerivedAttack[];
	resources: readonly Resource[];
	resistances: readonly DamageType[];
	immunities: readonly DamageType[];
	vulnerabilities: readonly DamageType[];
}

export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

export function deriveCharacter(sheet: CharacterSheet): DerivedCharacter {
	const cls = CLASSES[sheet.classId];
	const creature = sheet.creatureId ? CREATURES[sheet.creatureId] : undefined;
	const species = creature ? undefined : SPECIES[sheet.speciesId];
	const background = creature ? undefined : BACKGROUNDS[sheet.backgroundId];
	const abilities = creature?.abilities ?? sheet.abilities;
	const { level } = sheet;
	const abilityModifiers = Object.fromEntries(
		ABILITIES.map((ability) => [ability, abilityModifier(abilities[ability])]),
	) as Record<Ability, number>;
	const proficiencyBonus = creature
		? 2 + Math.max(0, Math.ceil(Number(creature.cr) / 4) - 1 || 0)
		: 2 + Math.floor((level - 1) / 4);
	const { str, dex, con, wis } = abilityModifiers;
	const hitDie = sheet.hitDieOverride ?? cls?.hitDie ?? 8;
	const maxHitDice = creature ? 0 : level;
	const maxHp =
		sheet.maxHpOverride ??
		creature?.maxHp ??
		hitDie +
			con +
			(level - 1) * Math.max(1, hitDie / 2 + 1 + con) +
			(species?.hpPerLevel ?? 0) * level;
	const armor = sheet.armorId ? ARMORS[sheet.armorId] : undefined;
	const armorTrained =
		!armor ||
		Boolean(
			creature ||
				sheet.classId === "custom" ||
				cls?.armor.includes(armor.category),
		);
	const shieldTrained =
		sheet.shield &&
		Boolean(
			creature || sheet.classId === "custom" || cls?.armor.includes("shield"),
		);
	let baseAc = 10 + dex;
	if (armor)
		baseAc =
			armor.ac +
			(armor.category === "light"
				? dex
				: armor.category === "medium"
					? Math.min(2, dex)
					: 0);
	else if (sheet.classId === "barbarian") baseAc += con;
	else if (sheet.classId === "monk" && !sheet.shield) baseAc += wis;
	const armorClass =
		sheet.armorClassOverride ??
		creature?.armorClass ??
		baseAc + (shieldTrained ? 2 : 0);
	const speed =
		sheet.speedOverride ??
		creature?.speed ??
		Math.max(
			0,
			(species?.speed ?? 30) -
				(armor?.strength && abilities.str < armor.strength ? 10 : 0) +
				(sheet.classId === "barbarian" &&
				level >= 5 &&
				armor?.category !== "heavy"
					? 10
					: 0) +
				(sheet.classId === "monk" && level >= 2 && !armor && !sheet.shield
					? 10 + 5 * Math.floor((level + 2) / 4 - 1)
					: 0),
		);
	const saveProficiencies =
		sheet.saveProficiencies ?? (creature ? [] : (cls?.saves ?? []));
	const savingThrows = Object.fromEntries(
		ABILITIES.map((ability) => [
			ability,
			creature?.saves?.[ability] ??
				abilityModifiers[ability] +
					(saveProficiencies.includes(ability) ? proficiencyBonus : 0),
		]),
	) as Record<Ability, number>;
	const skillProficiencies = [
		...new Set([
			...(background?.skills ?? []),
			...(species?.skills ?? []),
			...sheet.skills,
		]),
	];
	const jackOfAllTrades =
		sheet.classId === "bard" && level >= 2
			? Math.floor(proficiencyBonus / 2)
			: 0;
	const skillModifiers = Object.fromEntries(
		Object.entries(SKILLS).map(([id, ability]) => {
			const skill = id as Skill;
			const bonus = skillProficiencies.includes(skill)
				? proficiencyBonus * (sheet.expertise.includes(skill) ? 2 : 1)
				: jackOfAllTrades;
			return [
				id,
				creature?.skills?.[skill] ?? abilityModifiers[ability] + bonus,
			];
		}),
	) as Record<Skill, number>;
	const spellcastingAbility =
		sheet.spellcastingAbility ??
		(creature ? undefined : cls?.spellcastingAbility) ??
		null;
	const spellAttackBonus = spellcastingAbility
		? abilityModifiers[spellcastingAbility] + proficiencyBonus
		: null;
	let spellSlots: readonly number[] = [];
	const casting = creature ? undefined : cls?.casting;
	if (casting === "full") spellSlots = FULL_SLOTS[level - 1]!;
	else if (casting === "half") spellSlots = HALF_SLOTS[level - 1]!;
	else if (casting === "pact") {
		spellSlots = Array<number>(Math.min(5, Math.ceil(level / 2))).fill(0);
		(spellSlots as number[])[spellSlots.length - 1] =
			level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
	}
	spellSlots = sheet.spellSlotsOverride ?? spellSlots;
	const monk = !creature && sheet.classId === "monk" && !armor && !sheet.shield;
	const martialArtsDie = level < 5 ? 6 : level < 11 ? 8 : level < 17 ? 10 : 12;
	const attacks: DerivedAttack[] = creature
		? creature.attacks.map((attack) => ({ ...attack, ability: "str" }))
		: [];
	if (!creature) {
		const unarmedAbility = monk && dex > str ? "dex" : "str";
		attacks.push({
			id: "unarmed",
			name: "Unarmed Strike",
			ability: unarmedAbility,
			abilityChoice: monk,
			attackBonus: abilityModifiers[unarmedAbility] + proficiencyBonus,
			damageBonus: abilityModifiers[unarmedAbility] + (monk ? 0 : 1),
			damage: {
				count: monk ? 1 : 0,
				sides: monk ? martialArtsDie : 4,
				type: "bludgeoning",
			},
		});
	}
	for (const id of sheet.weaponIds) {
		const weapon = WEAPONS[id];
		if (!weapon || attacks.some((attack) => attack.id === id)) continue;
		const finesse = weapon.properties.includes("finesse");
		const light = weapon.properties.includes("light");
		const monkWeapon =
			weapon.kind === "melee" && (weapon.category === "simple" || light);
		const abilityChoice = finesse || (monk && monkWeapon);
		const ability = (abilityChoice ? dex > str : weapon.kind === "ranged")
			? "dex"
			: "str";
		const proficient =
			weapon.category === "simple" ||
			cls?.weapons === "martial" ||
			(sheet.classId === "monk" && light) ||
			(sheet.classId === "rogue" && (finesse || light));
		const damage: AttackDamage =
			monk &&
			monkWeapon &&
			weapon.damage.count === 1 &&
			weapon.damage.sides < martialArtsDie
				? { ...weapon.damage, sides: martialArtsDie }
				: weapon.damage;
		attacks.push({
			id,
			name: weapon.name,
			ability,
			abilityChoice,
			weapon,
			attackBonus:
				abilityModifiers[ability] + (proficient ? proficiencyBonus : 0),
			damageBonus: abilityModifiers[ability] + (weapon.flatDamage ?? 0),
			damage,
		});
	}
	for (const attack of sheet.customAttacks) {
		attacks.push({
			id: attack.id,
			name: attack.name,
			ability: attack.ability,
			attackBonus:
				attack.attackBonus ??
				abilityModifiers[attack.ability] +
					(attack.proficient ? proficiencyBonus : 0),
			damageBonus: attack.damageBonus ?? abilityModifiers[attack.ability],
			damage: attack.damage,
		});
	}
	const resources: Resource[] = [...sheet.resources];
	if (!creature) {
		if (
			sheet.classId === "barbarian" &&
			!resources.some(({ id }) => id === "rage")
		)
			resources.push({
				id: "rage",
				name: "Rage",
				max:
					level >= 17
						? 6
						: level >= 12
							? 5
							: level >= 6
								? 4
								: level >= 3
									? 3
									: 2,
				recharge: "long",
			});
		if (sheet.classId === "fighter") {
			if (!resources.some(({ id }) => id === "second-wind"))
				resources.push({
					id: "second-wind",
					name: "Second Wind",
					max: level >= 10 ? 4 : level >= 4 ? 3 : 2,
					recharge: "long",
				});
			if (level >= 2 && !resources.some(({ id }) => id === "action-surge"))
				resources.push({
					id: "action-surge",
					name: "Action Surge",
					max: level < 17 ? 1 : 2,
					recharge: "short",
				});
		}
		if (
			sheet.classId === "monk" &&
			level >= 2 &&
			!resources.some(({ id }) => id === "focus")
		)
			resources.push({
				id: "focus",
				name: "Focus Points",
				max: level,
				recharge: "short",
			});
		if (
			sheet.classId === "sorcerer" &&
			level >= 2 &&
			!resources.some(({ id }) => id === "sorcery")
		)
			resources.push({
				id: "sorcery",
				name: "Sorcery Points",
				max: level,
				recharge: "long",
			});
		if (
			sheet.classId === "paladin" &&
			!resources.some(({ id }) => id === "lay-on-hands")
		)
			resources.push({
				id: "lay-on-hands",
				name: "Lay on Hands",
				max: level * 5,
				recharge: "long",
			});
		if (
			sheet.classId === "bard" &&
			!resources.some(({ id }) => id === "bardic-inspiration")
		)
			resources.push({
				id: "bardic-inspiration",
				name: "Bardic Inspiration",
				max: Math.max(1, abilityModifiers.cha),
				recharge: level >= 5 ? "short" : "long",
			});
	}
	return {
		abilities,
		abilityModifiers,
		proficiencyBonus,
		saveProficiencies,
		savingThrows,
		skillProficiencies,
		skillModifiers,
		maxHp,
		armorClass,
		armorTrained,
		stealthDisadvantage: armor?.stealthDisadvantage ?? false,
		initiative:
			sheet.initiativeModifier ??
			creature?.initiative ??
			dex +
				(background?.feat === "Alert" || sheet.feats.includes("Alert")
					? proficiencyBonus
					: jackOfAllTrades),
		speed,
		hitDie,
		maxHitDice,
		spellcastingAbility,
		spellSaveDc: spellAttackBonus === null ? null : 8 + spellAttackBonus,
		spellAttackBonus,
		spellSlots,
		pactMagic: casting === "pact",
		passivePerception:
			creature?.passivePerception ?? 10 + skillModifiers.perception,
		attacks,
		resources,
		resistances: [...(species?.resistances ?? []), ...sheet.resistances],
		immunities: [...(creature?.immunities ?? []), ...sheet.immunities],
		vulnerabilities: [
			...(creature?.vulnerabilities ?? []),
			...sheet.vulnerabilities,
		],
	};
}
