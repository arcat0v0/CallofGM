import {
	createEmptyCoc7eArmor,
	createEmptyCoc7eAssets,
	normalizeCoc7eSheet,
	type Coc7eCharacterSheet,
} from "./sheet";

export function projectPublicCoc7eSheet(input: unknown): Coc7eCharacterSheet {
	const sheet = normalizeCoc7eSheet(input);
	return {
		...sheet,
		weapons: [],
		armor: createEmptyCoc7eArmor(),
		gear: [],
		spells: [],
		mythosTomes: [],
		encounters: [],
		assets: createEmptyCoc7eAssets(),
	};
}
