import { COC7E_ARMOR_DATA } from "./armor-data";
import type { Coc7eArmor, Coc7eEra, Coc7eWeapon } from "./sheet";
import { COC7E_WEAPON_DATA } from "./weapon-data";

export interface Coc7eWeaponDefinition {
	name: string;
	skillKey: string;
	damage: string;
	damageBonus: "none" | "half" | "full";
	range: string;
	impale: boolean;
	attacks: string;
	ammo: number | null;
	malfunction: number | null;
	eras: Coc7eEra[];
	rare: boolean;
	anachronistic: boolean;
	price: string;
	invented: string;
	type: string;
}

export interface Coc7eArmorDefinition {
	name: string;
	value: number;
	penalty: number;
	locations: string;
	eras: Coc7eEra[];
	price: string;
	official: boolean;
}

export const COC7E_WEAPONS: readonly Coc7eWeaponDefinition[] =
	COC7E_WEAPON_DATA;
export const COC7E_ARMOR: readonly Coc7eArmorDefinition[] = COC7E_ARMOR_DATA;

function matchesEra(eras: readonly Coc7eEra[], era: Coc7eEra): boolean {
	return eras.length === 0 || eras.includes(era);
}

export function coc7eWeaponsForEra(era: Coc7eEra): Coc7eWeaponDefinition[] {
	return COC7E_WEAPONS.filter((weapon) => matchesEra(weapon.eras, era));
}

export function coc7eArmorForEra(era: Coc7eEra): Coc7eArmorDefinition[] {
	return COC7E_ARMOR.filter((armor) => matchesEra(armor.eras, era));
}

export function coc7eWeaponFromCatalog(
	definition: Coc7eWeaponDefinition,
): Coc7eWeapon {
	return {
		name: definition.name,
		skillKey: definition.skillKey,
		damage: definition.damage,
		range: definition.range,
		attacks: definition.attacks,
		ammo: definition.ammo,
		malfunction: definition.malfunction,
		impale: definition.impale,
		applyDamageBonus: definition.damageBonus !== "none",
	};
}

export function coc7eArmorFromCatalog(
	definition: Coc7eArmorDefinition,
): Coc7eArmor {
	return {
		name: definition.name,
		value: definition.value,
		locations: definition.locations,
		penalty: definition.penalty,
	};
}
