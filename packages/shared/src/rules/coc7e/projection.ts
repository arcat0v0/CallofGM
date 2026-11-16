import {
	type Coc7eCharacterSheet,
	createEmptyCoc7eArmor,
	createEmptyCoc7eAssets,
	createEmptyCoc7eBackgroundProfile,
	normalizeCoc7eSheet,
} from "./sheet";

export function projectPublicCoc7eSheet(input: unknown): Coc7eCharacterSheet {
	const sheet = normalizeCoc7eSheet(input);
	return {
		...sheet,
		backgroundProfile: createEmptyCoc7eBackgroundProfile(),
		weapons: [],
		armor: createEmptyCoc7eArmor(),
		gear: [],
		spells: [],
		mythosTomes: [],
		encounters: [],
		experiences: [],
		assets: createEmptyCoc7eAssets(),
	};
}
