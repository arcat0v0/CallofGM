import { deriveCoc7eSheetStats } from "./derive";
import type { Coc7eCharacterSheet } from "./sheet";
import type { CharacterSessionState } from "./state";

export function recalculateCoc7eStateOnSync(
	state: CharacterSessionState,
	newSheet: Coc7eCharacterSheet,
): CharacterSessionState {
	const derived = deriveCoc7eSheetStats(newSheet);
	const hpLost = state.maxHp - state.hp;
	const mpLost = state.maxMp - state.mp;
	return {
		...state,
		maxHp: derived.maxHp,
		hp: Math.max(0, derived.maxHp - hpLost),
		maxMp: derived.maxMp,
		mp: Math.max(0, derived.maxMp - mpLost),
		maxSan: derived.maxSan,
		san: Math.min(state.san, derived.maxSan),
	};
}
