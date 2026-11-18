import { dnd5r } from "@cogm/shared";
import { t } from "@/i18n";
import type { CatalogPickerItem } from "./catalog-picker";

export function referenceId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[’']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-$/, "");
}

export const FEAT_CATEGORIES = [
	"origin",
	"general",
	"fighting-style",
	"epic-boon",
].map((value) => ({
	value,
	label: t(`dnd5r.reference.featCategory.${value}`),
}));

export function featItems(level: number): CatalogPickerItem[] {
	return dnd5r.FEAT_INDEX.map(
		([name, category, minimumLevel, prerequisite]) => ({
			id: name,
			name,
			category,
			disabled: level < minimumLevel,
			badge:
				level < minimumLevel
					? t("dnd5r.reference.levelRequired", { level: minimumLevel })
					: undefined,
			meta: `${t(`dnd5r.reference.featCategory.${category}`)} · ${t("dnd5r.reference.minimumLevel", { level: minimumLevel })}${prerequisite ? ` · ${prerequisite}` : ""}`,
		}),
	);
}

export function gearItems(): CatalogPickerItem[] {
	return dnd5r.ADVENTURING_GEAR.map(([name, weight, copper]) => ({
		id: name,
		name,
		meta: `${t("dnd5r.reference.weight", { value: weight ?? "—" })} · ${t("dnd5r.reference.cost", { value: copper ?? "—" })}`,
	}));
}

export function creatureItems(): CatalogPickerItem[] {
	return dnd5r.CREATURE_INDEX.map(([name, cr]) => {
		const id = referenceId(name);
		const importable = Object.hasOwn(dnd5r.CREATURES, id);
		return {
			id,
			name,
			meta: `CR ${cr}`,
			disabled: !importable,
			badge: importable
				? t("dnd5r.reference.importable")
				: t("dnd5r.reference.referenceOnly"),
		};
	});
}
