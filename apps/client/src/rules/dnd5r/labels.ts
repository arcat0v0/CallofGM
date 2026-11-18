import { dnd5r } from "@cogm/shared";
import { t } from "@/i18n";

export type DndSheet = dnd5r.CharacterSheet;
export type DndAbility = dnd5r.Ability;
export type DndSkill = dnd5r.Skill;

export const ABILITIES = dnd5r.ABILITIES;
export const SKILLS = Object.keys(dnd5r.SKILLS) as DndSkill[];

export function abilityLabel(ability: string): string {
	return t(`dnd5r.ability.${ability}`);
}

export function skillLabel(skill: string): string {
	return t(`dnd5r.skill.${skill}`);
}

export function classLabel(sheet: DndSheet): string {
	return sheet.classId === "custom"
		? (sheet.className ?? t("dnd5r.custom.class"))
		: (dnd5r.CLASSES[sheet.classId]?.name ?? sheet.classId);
}

export function speciesLabel(sheet: DndSheet): string {
	return sheet.speciesId === "custom"
		? (sheet.speciesName ?? t("dnd5r.custom.species"))
		: (dnd5r.SPECIES[sheet.speciesId]?.name ?? sheet.speciesId);
}

export function backgroundLabel(sheet: DndSheet): string {
	return sheet.backgroundId === "custom"
		? (sheet.backgroundName ?? t("dnd5r.custom.background"))
		: (dnd5r.BACKGROUNDS[sheet.backgroundId]?.name ?? sheet.backgroundId);
}

export function conditionLabel(condition: string): string {
	return t(`dnd5r.condition.${condition}`);
}

export function damageLabel(damage: string): string {
	return t(`dnd5r.damage.${damage}`);
}

export function checkLabel(key: string): string {
	if (key === "initiative") {
		return t("dnd5r.check.initiative");
	}
	if (key === "death") {
		return t("dnd5r.check.death");
	}
	const [kind, id] = key.split(":");
	if (kind === "ability" && id) {
		return t("dnd5r.check.ability", { name: abilityLabel(id) });
	}
	if (kind === "skill" && id) {
		return skillLabel(id);
	}
	if (kind === "save" && id) {
		return t("dnd5r.check.save", { name: abilityLabel(id) });
	}
	if (kind === "attack" && id) {
		return dnd5r.WEAPONS[id]?.name ?? id;
	}
	return key;
}

export function signed(value: number): string {
	return value >= 0 ? `+${value}` : String(value);
}

export function rechargeLabel(recharge: string): string {
	return t(`dnd5r.recharge.${recharge}`);
}

export function sourceTitle(url: string): string {
	return url === dnd5r.SRD_URL
		? t("dnd5r.source.srd")
		: t("dnd5r.source.basicRules");
}
