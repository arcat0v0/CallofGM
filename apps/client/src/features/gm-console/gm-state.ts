import type { SnapshotCharacter } from "@cogm/shared";
import { getRuleComponent } from "@/rules/registry";

export type CharacterStateEntry = {
	character: SnapshotCharacter;
	score: number;
	critical: boolean;
	summary: string;
};

export function stateEntries(
	characters: SnapshotCharacter[],
): CharacterStateEntry[] {
	const entries: CharacterStateEntry[] = [];
	for (const character of characters) {
		const rule = getRuleComponent(character.ruleId);
		const lines = rule.gmStateSummaryLines(character.state);
		if (lines.length === 0) continue;
		const hp = rule.stateBars(character.state).find(({ key }) => key === "hp");
		const critical =
			rule.statusLabelsOfState(character.state).length > 0 ||
			(hp !== undefined && hp.max > 0 && hp.current / hp.max <= 0.25);
		entries.push({
			character,
			score: rule.stateHealthScore(character.state),
			critical,
			summary: lines.join(" · "),
		});
	}
	return entries;
}

export function orderBySeverity(
	entries: CharacterStateEntry[],
): CharacterStateEntry[] {
	return [...entries].sort((a, b) => b.score - a.score);
}
