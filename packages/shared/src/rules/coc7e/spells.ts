import { COC7E_SPELL_DATA } from "./spells-data";

export interface Coc7eSpellDefinition {
	name: string;
	englishName: string;
	category: string;
	mpCost: string;
	sanCost: string;
	castingTime: string;
	effect: string;
}

export const COC7E_SPELLS: readonly Coc7eSpellDefinition[] = COC7E_SPELL_DATA;

export function coc7eSpell(name: string): Coc7eSpellDefinition | null {
	return COC7E_SPELLS.find((spell) => spell.name === name) ?? null;
}
