import type { DiceSkin } from "@cogm/shared";

export type DiceSkinOption = {
	id: DiceSkin;
	labelKey: string;
	descriptionKey: string;
	preview: string;
	fallbackKey: string;
};

export const DICE_SKIN_OPTIONS: readonly DiceSkinOption[] = (
	["olive", "bone"] as const satisfies readonly DiceSkin[]
).map((id) => ({
	id,
	labelKey: `diceSkin.${id}.label`,
	descriptionKey: `diceSkin.${id}.description`,
	preview: `/dice/previews/${id}-d20.webp`,
	fallbackKey: `diceSkin.${id}.fallback`,
}));

export function diceSkinPreviewUrl(skin: DiceSkin): string {
	return (
		DICE_SKIN_OPTIONS.find((option) => option.id === skin)?.preview ??
		DICE_SKIN_OPTIONS[0]?.preview ??
		""
	);
}
