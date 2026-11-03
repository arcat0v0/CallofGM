import type { SnapshotCharacter } from "@cogm/shared";
import { parseCocState } from "@/lib/coc-live";
import { getRuleComponent, type RuleSessionState } from "@/rules/registry";

type CharacterState = RuleSessionState;

export type CharacterStateEntry = {
	character: SnapshotCharacter;
	state: CharacterState;
};

const STATUS_WEIGHT: Record<string, number> = {
	dead: 100,
	dying: 90,
	unconscious: 80,
	indefinite_insanity: 70,
	temp_insanity: 60,
	major_wound: 50,
};

export function severityScore(state: CharacterState): number {
	const statusScore = state.statuses.reduce(
		(highest, flag) => Math.max(highest, STATUS_WEIGHT[flag] ?? 10),
		0,
	);
	const hpScore = state.maxHp > 0 ? (1 - state.hp / state.maxHp) * 40 : 0;
	const sanScore = state.maxSan > 0 ? (1 - state.san / state.maxSan) * 20 : 0;
	return statusScore + hpScore + sanScore;
}

export function stateEntries(
	characters: SnapshotCharacter[],
): CharacterStateEntry[] {
	return characters.flatMap((character) => {
		const state = parseCocState(character.state, character.ruleId);
		return state ? [{ character, state }] : [];
	});
}

export function orderBySeverity(
	entries: CharacterStateEntry[],
): CharacterStateEntry[] {
	return [...entries].sort(
		(a, b) => severityScore(b.state) - severityScore(a.state),
	);
}

export function hpLine(state: CharacterState): string {
	return `HP ${state.hp} / ${state.maxHp}`;
}

export function statusLine(
	state: CharacterState,
	ruleId?: string | null,
): string {
	const labels = getRuleComponent(ruleId).statusLabels(state.statuses);
	const resources = `${hpLine(state)} · SAN ${state.san} / ${state.maxSan}`;
	return labels.length > 0 ? `${labels.join(" · ")} · ${resources}` : resources;
}

export function othersLine(entries: CharacterStateEntry[]): string {
	return entries
		.map(
			({ character, state }) =>
				`${character.name} · ${hpLine(state)} · SAN ${state.san} / ${state.maxSan}`,
		)
		.join("  ·  ");
}

export function isCritical(state: CharacterState): boolean {
	if (state.statuses.length > 0) {
		return true;
	}
	return state.maxHp > 0 && state.hp / state.maxHp <= 0.25;
}
