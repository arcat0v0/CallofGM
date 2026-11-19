import { dnd5r } from "@cogm/shared";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import type { RandomSource } from "@/platform/ports";
import {
	type CheckInput,
	type PermanentFieldEditInput,
	RULE_API_VERSION,
	type RuleCheckResult,
	type RuleRuntime,
	RuleSystem,
	type RuntimeCharacter,
	type SessionStateContext,
	unsupportedRuleAction,
} from "../rule-system";

const { deriveCharacter } = dnd5r;
type Sheet = dnd5r.CharacterSheet;
type State = dnd5r.SessionState;
type Character = RuntimeCharacter<Sheet, State>;
type Runtime = RuleRuntime<Sheet, State>;
type Derived = dnd5r.DerivedCharacter;
const deathSaves = { successes: 0, failures: 0, stable: false, dead: false };

function ruleError(message: string): never {
	throw new AppError("VALIDATION_FAILED", message, 400);
}

function cleanDeathState(state: State, hp: number): State {
	return {
		...state,
		hp,
		deathSaves,
		conditions:
			state.hp === 0
				? state.conditions.filter((condition) => condition !== "unconscious")
				: state.conditions,
	};
}

function damageCharacter(
	character: Character,
	amount: number,
	type?: dnd5r.DamageType,
	critical = false,
): State {
	const { state, sheet } = character;
	if (state.deathSaves.dead || amount === 0) return state;
	if (type) {
		const profile = deriveCharacter(sheet);
		if (profile.immunities.includes(type)) return state;
		if (profile.resistances.includes(type)) amount = Math.floor(amount / 2);
		if (profile.vulnerabilities.includes(type)) amount *= 2;
	}
	const harm = Math.max(0, amount - state.tempHp);
	const tempHp = Math.max(0, state.tempHp - amount);
	if (harm === 0 || state.hp > harm)
		return { ...state, tempHp, hp: state.hp - harm };
	const dead = character.kind === "npc" || harm - state.hp >= state.maxHp;
	const failures =
		state.hp === 0
			? Math.min(3, state.deathSaves.failures + (critical ? 2 : 1))
			: 0;
	return {
		...state,
		hp: 0,
		tempHp,
		deathSaves: {
			successes: state.deathSaves.successes,
			failures,
			stable: false,
			dead: dead || failures === 3,
		},
		conditions: state.conditions.includes("unconscious")
			? state.conditions
			: [...state.conditions, "unconscious"],
	};
}

function rollD20(random: RandomSource, mode: dnd5r.RollMode) {
	const first = random.randomInt(1, 20);
	if (mode === "normal") return { rolls: [first], roll: first };
	const second = random.randomInt(1, 20);
	return {
		rolls: [first, second],
		roll:
			mode === "advantage" ? Math.max(first, second) : Math.min(first, second),
	};
}

function checkMode(
	character: Character,
	key: string,
	supplied: dnd5r.RollMode,
	profile: Derived,
	ability?: dnd5r.Ability,
	target?: Character,
	heavy = false,
): dnd5r.RollMode {
	const { conditions } = character.state;
	const attacking = key.startsWith("attack:");
	const abilityCheck =
		key.startsWith("ability:") ||
		key.startsWith("skill:") ||
		key === "initiative";
	const targetConditions = target?.state.conditions ?? [];
	const advantage =
		supplied === "advantage" ||
		(attacking &&
			(conditions.includes("invisible") ||
				targetConditions.some(
					(condition) =>
						condition === "blinded" ||
						condition === "restrained" ||
						condition === "paralyzed" ||
						condition === "stunned" ||
						condition === "unconscious",
				)));
	const disadvantage =
		supplied === "disadvantage" ||
		heavy ||
		(!profile.armorTrained && (ability === "str" || ability === "dex")) ||
		(key === "skill:stealth" && profile.stealthDisadvantage) ||
		((attacking || abilityCheck) && conditions.includes("poisoned")) ||
		(attacking &&
			(conditions.some(
				(condition) =>
					condition === "blinded" ||
					condition === "restrained" ||
					condition === "prone",
			) ||
				targetConditions.includes("invisible"))) ||
		(key === "save:dex" && conditions.includes("restrained"));
	return advantage === disadvantage
		? "normal"
		: advantage
			? "advantage"
			: "disadvantage";
}

export class Dnd5rRuleSystem extends RuleSystem<Sheet, State> {
	readonly id = "dnd5r";
	readonly metadata = {
		id: this.id,
		name: "D&D 5e (2024)",
		version: "1.0.0",
		apiVersion: RULE_API_VERSION,
		description: "2024 fifth-edition compatibility based on SRD 5.2.1",
		permanentSheetFields: dnd5r.ABILITIES.map(
			(ability) => `abilities.${ability}`,
		),
		permanentFieldRange: { min: 1, max: 30 },
	};
	readonly characterSheetSchema = dnd5r.CharacterSheet;
	readonly sessionStateSchema = dnd5r.SessionState;
	readonly publicStateFields = dnd5r.SESSION_PUBLIC_FIELDS;

	createEmptySheet() {
		return dnd5r.createBlankSheet();
	}

	initializeSessionState(sheet: Sheet, context?: SessionStateContext): State {
		const derived = deriveCharacter(sheet);
		return {
			hp: derived.maxHp,
			maxHp: derived.maxHp,
			tempHp: 0,
			conditions: [],
			exhaustion: 0,
			deathSaves,
			hitDice: derived.maxHitDice,
			maxHitDice: derived.maxHitDice,
			spellSlots: [...derived.spellSlots],
			maxSpellSlots: [...derived.spellSlots],
			resources: Object.fromEntries(
				derived.resources.map((resource) => [
					resource.id,
					{
						name: resource.name,
						max: resource.max,
						current: resource.max,
						recharge: resource.recharge,
					},
				]),
			),
			...context,
		};
	}

	recalculateStateOnSync(state: State, newSheet: Sheet): State {
		const next = this.initializeSessionState(newSheet);
		const preserveSpent = (max: number, oldMax: number, current: number) =>
			Math.max(0, Math.min(max, max - (oldMax - current)));
		const pactSlot =
			newSheet.classId === "warlock" &&
			!newSheet.creatureId &&
			!newSheet.spellSlotsOverride
				? state.maxSpellSlots.findIndex((max) => max > 0)
				: -1;
		return {
			...state,
			hp: Math.min(state.hp, next.maxHp),
			maxHp: next.maxHp,
			hitDice: preserveSpent(next.maxHitDice, state.maxHitDice, state.hitDice),
			maxHitDice: next.maxHitDice,
			spellSlots: next.maxSpellSlots.map((max, i) =>
				preserveSpent(
					max,
					state.maxSpellSlots[pactSlot >= 0 ? pactSlot : i] ?? 0,
					state.spellSlots[pactSlot >= 0 ? pactSlot : i] ?? 0,
				),
			),
			maxSpellSlots: next.maxSpellSlots,
			resources: Object.fromEntries(
				Object.entries(next.resources).map(([id, resource]) => [
					id,
					{
						...resource,
						current: preserveSpent(
							resource.max,
							state.resources[id]?.max ?? 0,
							state.resources[id]?.current ?? 0,
						),
					},
				]),
			),
		};
	}

	projectSyncState(state: State) {
		return {
			hp: state.hp,
			maxHp: state.maxHp,
			tempHp: state.tempHp,
			hitDice: state.hitDice,
			maxHitDice: state.maxHitDice,
		};
	}

	projectPublicSheet(sheet: Sheet) {
		return { ...sheet, notes: "" };
	}
	mergeSheetPatch(base: Sheet, patch: unknown): Sheet {
		return this.characterSheetSchema.parse({ ...base, ...Object(patch) });
	}
	viewSessionState(state: State): State {
		return state;
	}

	projectPublicSessionState(state: State, fields: readonly string[]) {
		if (!fields.length) return null;
		return {
			...(fields.includes("hp") ? { hp: state.hp, maxHp: state.maxHp } : {}),
			...(fields.includes("tempHp") ? { tempHp: state.tempHp } : {}),
			...(fields.includes("conditions")
				? { conditions: state.conditions, exhaustion: state.exhaustion }
				: {}),
		};
	}

	readPermanentFields(sheet: Sheet) {
		return Object.fromEntries(
			Object.entries(sheet.abilities).map(([ability, value]) => [
				`abilities.${ability}`,
				value,
			]),
		);
	}

	applyPermanentFieldEdit(sheet: Sheet, edit: PermanentFieldEditInput): Sheet {
		if (!this.metadata.permanentSheetFields.includes(edit.field))
			ruleError("Unknown ability score");
		return this.characterSheetSchema.parse({
			...sheet,
			abilities: { ...sheet.abilities, [edit.field.slice(10)]: edit.value },
		});
	}

	applyGmStateEdit(state: State, edit: Record<string, unknown>) {
		const hp =
			typeof edit.hp === "number" ? Math.min(state.maxHp, edit.hp) : state.hp;
		if (hp === state.hp) unsupportedRuleAction();
		if (hp > 0) return { state: cleanDeathState(state, hp), hints: [] };
		return {
			state: {
				...state,
				hp,
				conditions: state.conditions.includes("unconscious")
					? state.conditions
					: ([...state.conditions, "unconscious"] as State["conditions"]),
			},
			hints: [],
		};
	}

	async validateCheckOptions(
		character: Character,
		skillKey: string,
		check: CheckInput,
		runtime: Runtime,
	) {
		const options = check && "options" in check ? check.options : undefined;
		const parsed = dnd5r.CheckOptions.safeParse(
			options === undefined ? {} : options,
		);
		if (!parsed.success) throw validationFailed(parsed.error);
		const input = parsed.data;
		const [kind, key, trailing] = skillKey.split(":");
		const profile = deriveCharacter(character.sheet);
		if (
			trailing !== undefined ||
			(kind === "ability" || kind === "save"
				? !dnd5r.Ability.safeParse(key).success
				: kind === "skill"
					? !dnd5r.Skill.safeParse(key).success
					: kind === "attack"
						? !profile.attacks.some((attack) => attack.id === key)
						: (kind !== "initiative" && kind !== "death") || key !== undefined)
		) {
			throw new AppError("SKILL_NOT_FOUND", "Unknown D&D test or attack", 400);
		}
		if (
			kind !== "attack" &&
			(input.targetId || input.ability || input.twoHanded)
		)
			ruleError("Attack options require an attack");
		if (kind === "attack") {
			const weapon = profile.attacks.find(
				(attack) => attack.id === key,
			)?.weapon;
			const needsTwoHands = Boolean(
				weapon?.properties.includes("two-handed") ||
					weapon?.properties.includes("two-handed-unmounted"),
			);
			if (input.twoHanded && !weapon?.versatileDie && !needsTwoHands)
				ruleError("This attack does not support a two-handed grip");
			if (
				(input.twoHanded || needsTwoHands) &&
				character.sheet.shield &&
				!character.sheet.creatureId
			)
				ruleError("A shield occupies one hand");
		}
		if ((kind === "death" || kind === "initiative") && input.dc !== undefined)
			ruleError("This roll does not accept a DC");
		if (input.targetId) {
			if (input.dc !== undefined || input.targetId === character.id)
				ruleError("Choose a target or manual AC");
			const encounter = dnd5r.EncounterState.safeParse(runtime.ruleState);
			if (
				!runtime.isGm &&
				!runtime.requested &&
				(!encounter.success ||
					!encounter.data.combatants.some(
						({ characterId }) => characterId === input.targetId,
					) ||
					!encounter.data.combatants.some(
						({ characterId }) => characterId === character.id,
					))
			) {
				throw new AppError(
					"FORBIDDEN",
					"Targeted attacks require encounter membership",
					403,
				);
			}
			if (!(await runtime.findCharacter(input.targetId)))
				ruleError("Target is unavailable in this session");
		}
		return input;
	}

	async resolveCheck(
		character: Character,
		skillKey: string,
		options: CheckInput,
		runtime: Runtime,
	): Promise<RuleCheckResult<State>> {
		const input = await this.validateCheckOptions(
			character,
			skillKey,
			options,
			runtime,
		);
		const [kind, key] = skillKey.split(":") as [
			dnd5r.CheckResult["kind"],
			string,
		];
		const { random } = runtime;
		const { state } = character;
		const profile = deriveCharacter(character.sheet);
		if (state.deathSaves.dead) ruleError("A dead character cannot roll tests");
		if (kind === "death") {
			if (state.hp !== 0 || state.deathSaves.stable || character.kind !== "pc")
				ruleError("Only a dying player character makes death saves");
			const mode = input.mode ?? "normal";
			const dice = rollD20(random, mode);
			const modifier = -2 * state.exhaustion;
			const total = dice.roll + modifier;
			const success = dice.roll === 20 || (dice.roll !== 1 && total >= 10);
			const saves = {
				...state.deathSaves,
				successes: state.deathSaves.successes + Number(success),
				failures:
					state.deathSaves.failures + (dice.roll === 1 ? 2 : Number(!success)),
			};
			const outcome =
				dice.roll === 20
					? "revived"
					: saves.successes >= 3
						? "stable"
						: saves.failures >= 3
							? "dead"
							: success
								? "success"
								: "failure";
			const next =
				outcome === "revived"
					? cleanDeathState(state, 1)
					: {
							...state,
							deathSaves:
								outcome === "stable"
									? { ...deathSaves, stable: true }
									: {
											...saves,
											failures: Math.min(3, saves.failures),
											dead: outcome === "dead",
										},
						};
			const result: dnd5r.CheckResult = {
				ruleId: "dnd5r",
				kind,
				mode,
				...dice,
				modifier,
				total,
				dc: 10,
				outcome,
				success,
			};
			return {
				result,
				mutations: [{ characterId: character.id, state: next, hints: [] }],
			};
		}
		const target = input.targetId
			? ((await runtime.findCharacter(input.targetId)) ?? undefined)
			: undefined;
		const attack =
			kind === "attack"
				? profile.attacks.find(({ id }) => id === key)
				: undefined;
		let ability =
			kind === "skill"
				? dnd5r.SKILLS[key as dnd5r.Skill]
				: kind === "initiative"
					? ("dex" as const)
					: (attack?.ability ?? (key as dnd5r.Ability));
		if (input.ability && attack) {
			if (
				!attack.abilityChoice ||
				(input.ability !== "str" && input.ability !== "dex")
			)
				ruleError("Only eligible attacks allow a Strength or Dexterity choice");
			ability = input.ability;
		}
		if (
			attack &&
			(state.hp === 0 ||
				state.conditions.some((condition) =>
					[
						"incapacitated",
						"paralyzed",
						"petrified",
						"stunned",
						"unconscious",
					].includes(condition),
				))
		)
			ruleError("An incapacitated character cannot attack");
		const supplied = input.mode ?? "normal";
		const heavy =
			attack?.weapon?.properties.includes("heavy") &&
			profile.abilities[attack.weapon.kind === "melee" ? "str" : "dex"] < 13;
		const mode = checkMode(
			character,
			skillKey,
			supplied,
			profile,
			ability,
			target,
			heavy,
		);
		const dice = rollD20(random, mode);
		const abilityDelta = attack
			? profile.abilityModifiers[ability] -
				profile.abilityModifiers[attack.ability]
			: 0;
		const modifier =
			(attack
				? attack.attackBonus + abilityDelta
				: kind === "skill"
					? profile.skillModifiers[key as dnd5r.Skill]
					: kind === "save"
						? profile.savingThrows[key as dnd5r.Ability]
						: kind === "initiative"
							? profile.initiative
							: profile.abilityModifiers[ability]) -
			2 * state.exhaustion;
		const total = dice.roll + modifier;
		const dc = target
			? deriveCharacter(target.sheet).armorClass
			: (input.dc ?? null);
		const incapacitatedSave =
			kind === "save" &&
			(ability === "str" || ability === "dex") &&
			state.conditions.some((condition) =>
				["paralyzed", "petrified", "stunned", "unconscious"].includes(
					condition,
				),
			);
		const champion =
			character.sheet.classId === "fighter" &&
			character.sheet.subclass.toLowerCase() === "champion";
		const critical =
			attack !== undefined &&
			dice.roll >=
				(champion && character.sheet.level >= 15
					? 18
					: champion && character.sheet.level >= 3
						? 19
						: 20);
		const success = incapacitatedSave
			? false
			: critical
				? true
				: attack && dice.roll === 1
					? false
					: dc === null
						? null
						: total >= dc;
		const result: dnd5r.CheckResult = {
			ruleId: "dnd5r",
			kind,
			mode,
			...dice,
			modifier,
			total,
			dc: target ? null : dc,
			outcome: critical
				? "critical"
				: success === null
					? "rolled"
					: attack
						? success
							? "hit"
							: "miss"
						: success
							? "success"
							: "failure",
			success,
			...(target ? { targetId: target.id } : {}),
		};
		if (!attack || success === false) return { result };
		const sides = input.twoHanded
			? (attack.weapon?.versatileDie ?? attack.damage.sides)
			: attack.damage.sides;
		const rolls = Array.from(
			{ length: attack.damage.count * (critical ? 2 : 1) },
			() => random.randomInt(1, sides),
		);
		const damageModifier = attack.damageBonus + abilityDelta;
		const damage = Math.max(
			0,
			rolls.reduce((sum, value) => sum + value, damageModifier),
		);
		result.damage = {
			type: attack.damage.type,
			rolls,
			sides,
			modifier: damageModifier,
			total: damage,
		};
		if (!target || !success) return { result };
		return {
			result,
			mutations: [
				{
					characterId: target.id,
					state: damageCharacter(target, damage, attack.damage.type, critical),
					hints: [],
				},
			],
		};
	}

	async applyRuleAction(command: unknown, runtime: Runtime) {
		const parsed = dnd5r.Action.safeParse(command);
		if (!parsed.success) throw validationFailed(parsed.error);
		const action = parsed.data;
		const encounter = dnd5r.EncounterState.safeParse(runtime.ruleState);
		if (!("characterId" in action)) {
			if (!runtime.isGm)
				throw new AppError(
					"FORBIDDEN",
					"Only the GM can manage an encounter",
					403,
				);
			if (action.action === "encounter-end") return { ruleState: null };
			if (action.action === "encounter-next") {
				if (!encounter.success) ruleError("There is no active encounter");
				const active = encounter.data;
				const turnIndex = (active.turnIndex + 1) % active.combatants.length;
				return {
					ruleState: {
						...active,
						turnIndex,
						round: active.round + (turnIndex === 0 ? 1 : 0),
					},
				};
			}
			const ids = [...new Set(action.input.characterIds)];
			const combatants: dnd5r.EncounterState["combatants"] = [];
			for (const characterId of ids) {
				const character = await runtime.findCharacter(characterId);
				if (!character) ruleError("Encounter character is unavailable");
				const profile = deriveCharacter(character.sheet);
				const initiative =
					action.input.initiatives?.[characterId] ??
					runtime.random.randomInt(1, 20) +
						profile.initiative -
						character.state.exhaustion * 2;
				combatants.push({
					characterId,
					name: character.name,
					kind: character.kind,
					initiative,
				});
			}
			combatants.sort((a, b) => b.initiative - a.initiative);
			return {
				ruleState: {
					round: 1,
					turnIndex: 0,
					combatants,
				} satisfies dnd5r.EncounterState,
			};
		}
		const character = await runtime.findCharacter(action.characterId);
		if (!character) ruleError("Character is unavailable in this session");
		const { state } = character;
		if (
			!runtime.isGm &&
			!(action.action === "spell-slot" && !action.input.restore) &&
			!(action.action === "resource" && action.input.delta < 0)
		)
			throw new AppError(
				"FORBIDDEN",
				"Only the GM can manage this character state",
				403,
			);
		if (state.deathSaves.dead && action.action !== "condition")
			ruleError("A dead character cannot use this action");
		let next: State;
		switch (action.action) {
			case "damage":
				next = damageCharacter(
					character,
					action.input.amount,
					action.input.type,
					action.input.critical,
				);
				break;
			case "heal":
				next = cleanDeathState(
					state,
					Math.min(state.maxHp, state.hp + action.input.amount),
				);
				break;
			case "temp-hp":
				next = {
					...state,
					tempHp: action.input.replace
						? action.input.amount
						: Math.max(state.tempHp, action.input.amount),
				};
				break;
			case "stabilize": {
				if (state.hp !== 0 || character.kind !== "pc")
					ruleError("Only a dying player character can be stabilized");
				next = { ...state, deathSaves: { ...deathSaves, stable: true } };
				break;
			}
			case "condition": {
				const { condition, active, level } = action.input;
				if (condition === "unconscious" && !active && state.hp === 0)
					ruleError("Heal the character to remove unconsciousness at zero HP");
				const exhaustion =
					condition === "exhaustion"
						? active
							? (level ?? Math.min(6, state.exhaustion + 1))
							: 0
						: state.exhaustion;
				const conditions = active
					? [...new Set([...state.conditions, condition])]
					: state.conditions.filter((current) => current !== condition);
				next =
					exhaustion === 6
						? {
								...state,
								hp: 0,
								conditions,
								exhaustion,
								deathSaves: { ...deathSaves, dead: true },
							}
						: { ...state, exhaustion, conditions };
				break;
			}
			case "spell-slot": {
				const i = action.input.level - 1;
				const value =
					(state.spellSlots[i] ?? 0) + (action.input.restore ? 1 : -1);
				if (value < 0 || value > (state.maxSpellSlots[i] ?? 0))
					ruleError("No available slot of that level");
				if (
					!action.input.restore &&
					!deriveCharacter(character.sheet).armorTrained
				)
					ruleError("Spellcasting requires armor training");
				const spellSlots = state.spellSlots.slice();
				spellSlots[i] = value;
				next = { ...state, spellSlots };
				break;
			}
			case "resource": {
				const { id, delta } = action.input;
				const resource = Object.hasOwn(state.resources, id)
					? state.resources[id]
					: undefined;
				if (
					!resource ||
					resource.current + delta < 0 ||
					resource.current + delta > resource.max
				)
					ruleError("Insufficient or unavailable resource");
				next = {
					...state,
					resources: {
						...state.resources,
						[id]: { ...resource, current: resource.current + delta },
					},
				};
				break;
			}
			case "short-rest":
			case "long-rest": {
				if (state.hp === 0) ruleError("Rest requires at least 1 HP");
				const long = action.action === "long-rest";
				const dice =
					action.action === "short-rest" ? (action.input?.hitDice ?? 0) : 0;
				if (dice > state.hitDice)
					ruleError("There are not enough unspent Hit Point Dice");
				const profile = deriveCharacter(character.sheet);
				let healing = 0;
				for (let i = 0; i < dice; i++)
					healing += Math.max(
						0,
						runtime.random.randomInt(1, profile.hitDie) +
							profile.abilityModifiers.con,
					);
				const resources = Object.fromEntries(
					Object.entries(state.resources).map(([id, resource]) => {
						let current = resource.current;
						if (
							resource.recharge === "short" ||
							(long && resource.recharge === "long")
						)
							current = resource.max;
						else if (
							!long &&
							((id === "second-wind" &&
								character.sheet.classId === "fighter") ||
								(id === "rage" && character.sheet.classId === "barbarian"))
						)
							current = Math.min(resource.max, current + 1);
						return [id, { ...resource, current }];
					}),
				);
				const exhaustion = long
					? Math.max(0, state.exhaustion - 1)
					: state.exhaustion;
				next = {
					...state,
					hp: long ? state.maxHp : Math.min(state.maxHp, state.hp + healing),
					tempHp: long ? 0 : state.tempHp,
					hitDice: long ? state.maxHitDice : state.hitDice - dice,
					spellSlots:
						long || profile.pactMagic
							? state.maxSpellSlots.slice()
							: state.spellSlots,
					resources,
					exhaustion,
					conditions: exhaustion
						? state.conditions
						: state.conditions.filter(
								(condition) => condition !== "exhaustion",
							),
				};
				break;
			}
		}
		return {
			mutations: [{ characterId: character.id, state: next, hints: [] }],
		};
	}

	reconcileRuleState(
		state: unknown,
		isEnrolled: (characterId: string) => boolean,
	) {
		const parsed = dnd5r.EncounterState.safeParse(state);
		if (!parsed.success) return null;
		const { combatants, round, turnIndex } = parsed.data;
		const remaining: typeof combatants = [];
		let nextTurn: number | undefined;
		for (const [index, combatant] of combatants.entries()) {
			if (!isEnrolled(combatant.characterId)) continue;
			if (index >= turnIndex) nextTurn ??= remaining.length;
			remaining.push(combatant);
		}
		if (remaining.length === combatants.length) return state;
		if (remaining.length === 0) return null;
		return {
			combatants: remaining,
			round: nextTurn === undefined ? round + 1 : round,
			turnIndex: nextTurn ?? 0,
		} satisfies dnd5r.EncounterState;
	}

	viewRuleState(
		state: unknown,
		viewer: { isGm: boolean; characterIds: readonly string[] },
	) {
		const parsed = dnd5r.EncounterState.safeParse(state);
		if (!parsed.success) return null;
		if (viewer.isGm) return parsed.data;
		const { combatants, turnIndex } = parsed.data;
		const active = combatants[turnIndex];
		const visible = combatants.filter(({ characterId }) =>
			viewer.characterIds.includes(characterId),
		);
		if (!visible.length) return null;
		return {
			...parsed.data,
			combatants: visible,
			turnIndex: Math.max(
				0,
				visible.findIndex(
					({ characterId }) => characterId === active?.characterId,
				),
			),
		};
	}
}
