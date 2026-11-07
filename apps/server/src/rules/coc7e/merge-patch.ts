import { coc7e } from "@cogm/shared";

type Sheet = coc7e.Coc7eCharacterSheet;

const SECTION_KEYS = [
	"weapons",
	"armor",
	"gear",
	"spells",
	"mythosTomes",
	"encounters",
	"assets",
	"age",
	"era",
	"occupation",
	"movementModifier",
] as const;

export function mergeCoc7eSheetPatch(base: Sheet, patch: unknown): Sheet {
	if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
		return base;
	}
	const raw = patch as Record<string, unknown>;
	const merged: Record<string, unknown> = { ...base };

	if (
		raw.attributes &&
		typeof raw.attributes === "object" &&
		!Array.isArray(raw.attributes)
	) {
		merged.attributes = {
			...base.attributes,
			...(raw.attributes as Record<string, unknown>),
		};
	}

	if (
		raw.skills &&
		typeof raw.skills === "object" &&
		!Array.isArray(raw.skills)
	) {
		merged.skills = {
			...base.skills,
			...(raw.skills as Record<string, unknown>),
		};
	}

	if (
		raw.customSkills &&
		typeof raw.customSkills === "object" &&
		!Array.isArray(raw.customSkills)
	) {
		merged.customSkills = {
			...base.customSkills,
			...(raw.customSkills as Record<string, unknown>),
		};
	}

	if (
		raw.occupation &&
		typeof raw.occupation === "object" &&
		!Array.isArray(raw.occupation)
	) {
		merged.occupation = {
			...base.occupation,
			...(raw.occupation as Record<string, unknown>),
		};
	}

	if (
		raw.assets &&
		typeof raw.assets === "object" &&
		!Array.isArray(raw.assets)
	) {
		merged.assets = {
			...base.assets,
			...(raw.assets as Record<string, unknown>),
			details: Array.isArray((raw.assets as Record<string, unknown>).details)
				? (raw.assets as Record<string, unknown>).details
				: base.assets.details,
		};
	}

	if (raw.armor && typeof raw.armor === "object" && !Array.isArray(raw.armor)) {
		merged.armor = { ...base.armor, ...(raw.armor as Record<string, unknown>) };
	}

	for (const key of SECTION_KEYS) {
		if (key === "assets" || key === "occupation" || key === "armor") {
			continue;
		}
		if (raw[key] !== undefined) {
			merged[key] = raw[key];
		}
	}

	return coc7e.normalizeCoc7eSheet(merged);
}
