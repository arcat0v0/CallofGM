import { expect, test } from "bun:test";
import { dnd5r } from "@cogm/shared";
import { Dnd5rRuleSystem } from "@/rules/dnd5r";
import type { RuleRuntime, RuntimeCharacter } from "@/rules/rule-system";
import { ScriptedRandomSource } from "../helpers/setup";

const rule = new Dnd5rRuleSystem();
const starter = dnd5r.createBlankSheet();
type Character = RuntimeCharacter<dnd5r.CharacterSheet, dnd5r.SessionState>;

function combat(sheet: dnd5r.CharacterSheet, rolls: number[]) {
	const character: Character = {
		id: "knight",
		name: "Knight",
		kind: "pc",
		sheet,
		state: rule.initializeSessionState(sheet),
	};
	const runtime: RuleRuntime<dnd5r.CharacterSheet, dnd5r.SessionState> = {
		isGm: true,
		requested: false,
		hidden: false,
		random: new ScriptedRandomSource(rolls),
		ruleState: null,
		async findCharacter(id) {
			return id === character.id ? character : null;
		},
	};
	return { character, runtime };
}

test("natural twenty and one do not force ability or save results", async () => {
	const { character, runtime } = combat(starter, [20, 1]);
	const failure = await rule.resolveCheck(
		character,
		"ability:cha",
		{ options: { dc: 20 } },
		runtime,
	);
	const success = await rule.resolveCheck(
		character,
		"save:str",
		{ options: { dc: 6 } },
		runtime,
	);
	expect(failure.result).toMatchObject({
		roll: 20,
		total: 19,
		outcome: "failure",
	});
	expect(success.result).toMatchObject({
		roll: 1,
		total: 6,
		outcome: "success",
	});
});

test("a shield blocks two-handed weapons before rolling, and disadvantage sources cancel advantage together", async () => {
	const { character, runtime } = combat(
		{
			...starter,
			weaponIds: ["greatsword"],
			abilities: { ...starter.abilities, str: 12 },
		},
		[11, 4, 6],
	);
	await expect(
		rule.resolveCheck(
			character,
			"attack:greatsword",
			{ options: { dc: 10 } },
			runtime,
		),
	).rejects.toThrow("A shield occupies one hand");
	character.sheet.shield = false;
	character.state.conditions = ["poisoned"];
	const { result } = await rule.resolveCheck(
		character,
		"attack:greatsword",
		{ options: { mode: "advantage", dc: 10 } },
		runtime,
	);
	expect(result).toMatchObject({
		mode: "normal",
		rolls: [11],
		outcome: "hit",
		damage: { rolls: [4, 6], total: 11 },
	});
});

test("Warlock pact slots recharge on a short rest without restoring all Hit Point Dice", async () => {
	const { character, runtime } = combat(
		{ ...starter, classId: "warlock", level: 5, armorId: null, shield: false },
		[6],
	);
	const spent = await rule.applyRuleAction(
		{ action: "spell-slot", characterId: character.id, input: { level: 3 } },
		runtime,
	);
	character.state = spent.mutations![0]!.state;
	const higherLevel = rule.recalculateStateOnSync(character.state, {
		...character.sheet,
		level: 7,
	});
	expect(higherLevel.spellSlots).toEqual([0, 0, 0, 1]);
	character.state.hp = 10;
	character.state.hitDice = 2;
	const rested = await rule.applyRuleAction(
		{ action: "short-rest", characterId: character.id, input: { hitDice: 1 } },
		runtime,
	);
	expect(rested.mutations?.[0]?.state).toMatchObject({
		hp: 18,
		hitDice: 1,
		spellSlots: [0, 0, 2],
	});
});
