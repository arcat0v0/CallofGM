import { expect, test } from "bun:test";
import { dnd5r } from "../src";

const starter = dnd5r.createBlankSheet();

test("the ready-to-play Fighter starts with origin boosts, class saves and trained armor", () => {
	expect(starter.abilities).toEqual({
		str: 17,
		dex: 13,
		con: 15,
		int: 10,
		wis: 12,
		cha: 8,
	});
	expect(starter.languages).toEqual(["Common", "Dwarvish", "Elvish"]);
	expect(dnd5r.deriveCharacter(starter)).toMatchObject({
		proficiencyBonus: 2,
		armorClass: 18,
		maxHp: 12,
		initiative: 1,
		savingThrows: { str: 5, dex: 1, con: 4, int: 0, wis: 1, cha: -1 },
		skillModifiers: { athletics: 5, perception: 3 },
		passivePerception: 13,
	});
});

test("full, half and pact casting advance through level 20 using 2024 slot progressions", () => {
	const wizard = {
		...starter,
		classId: "wizard",
		armorId: null,
		shield: false,
		abilities: { ...starter.abilities, int: 20 },
		backgroundId: "sage",
		level: 20,
	};
	expect(dnd5r.deriveCharacter(wizard)).toMatchObject({
		proficiencyBonus: 6,
		spellSaveDc: 19,
		spellAttackBonus: 11,
		spellSlots: [4, 3, 3, 3, 3, 2, 2, 1, 1],
	});
	expect(
		dnd5r.deriveCharacter({ ...starter, classId: "ranger" }).spellSlots,
	).toEqual([2]);
	expect(
		dnd5r.deriveCharacter({ ...wizard, classId: "warlock", level: 17 }),
	).toMatchObject({ pactMagic: true, spellSlots: [0, 0, 0, 0, 4] });
	expect(
		dnd5r.deriveCharacter({
			...starter,
			classId: "custom",
			spellcastingAbility: "wis",
			spellSlotsOverride: [1, 0, 1],
		}),
	).toMatchObject({ spellSaveDc: 11, spellSlots: [1, 0, 1] });
});

test("Monk martial arts applies to the class's melee weapons without granting rapier proficiency", () => {
	const monk = {
		...starter,
		classId: "monk",
		armorId: null,
		shield: false,
		abilities: { ...starter.abilities, str: 10, dex: 16 },
		level: 5,
		weaponIds: ["dagger", "rapier", "shortsword"],
	};
	const derived = dnd5r.deriveCharacter(monk);
	expect(derived.attacks.find(({ id }) => id === "dagger")).toMatchObject({
		ability: "dex",
		attackBonus: 6,
		damage: { sides: 8 },
	});
	expect(derived.attacks.find(({ id }) => id === "rapier")).toMatchObject({
		attackBonus: 3,
	});
	expect(derived.attacks.find(({ id }) => id === "shortsword")).toMatchObject({
		attackBonus: 6,
		damage: { sides: 8 },
	});
});

test("SRD catalogs retain structured 5.2.1 metadata and reject unknown or duplicate IDs", () => {
	expect(Object.keys(dnd5r.SPELLS)).toHaveLength(339);
	expect(Object.keys(dnd5r.WEAPONS)).toHaveLength(38);
	expect(Object.keys(dnd5r.CLASSES)).toHaveLength(12);
	expect(Object.keys(dnd5r.SPECIES)).toHaveLength(9);
	expect(Object.keys(dnd5r.BACKGROUNDS)).toHaveLength(4);
	expect(Object.keys(dnd5r.ARMORS)).toHaveLength(12);
	expect(Object.keys(dnd5r.CREATURES)).toHaveLength(13);
	expect(dnd5r.CREATURE_INDEX).toHaveLength(326);
	expect(dnd5r.CREATURE_INDEX).toContainEqual(["Aboleth", "10"]);
	expect(dnd5r.ADVENTURING_GEAR).toHaveLength(81);
	expect(dnd5r.ADVENTURING_GEAR).toContainEqual([
		"Potion of Healing",
		0.5,
		5000,
	]);
	expect(dnd5r.FEAT_INDEX).toHaveLength(17);
	expect(dnd5r.FEAT_INDEX).toContainEqual(["Alert", "origin", 1, null]);
	expect(dnd5r.SPELLS["acid-splash"]).toEqual({
		name: "Acid Splash",
		level: 0,
		school: "evocation",
		classes: ["sorcerer", "wizard"],
	});
	expect(dnd5r.SPELLS["divine-smite"]).toMatchObject({
		level: 1,
		classes: ["paladin"],
	});
	expect(dnd5r.CREATURES["goblin-warrior"]).toMatchObject({
		maxHp: 10,
		armorClass: 15,
		initiative: 2,
	});
	expect(
		dnd5r.CharacterSheet.safeParse({ ...starter, spellIds: ["invented"] })
			.success,
	).toBe(false);
	expect(
		dnd5r.CharacterSheet.safeParse({
			...starter,
			weaponIds: ["shortbow", "shortbow"],
		}).success,
	).toBe(false);
	expect(
		dnd5r.CharacterSheet.safeParse({ ...starter, level: 21 }).success,
	).toBe(false);
});
