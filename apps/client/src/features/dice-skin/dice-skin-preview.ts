import type { DiceSkin } from "@cogm/shared";
import { normalizeDiceAssetBaseUrl } from "@/features/dice-animation/model";

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

export function diceSkinPreviewUrl(
	skin: DiceSkin,
	baseUrl?: string | null,
): string {
	const resolvedBase = normalizeDiceAssetBaseUrl(baseUrl);
	const option =
		DICE_SKIN_OPTIONS.find((item) => item.id === skin) ?? DICE_SKIN_OPTIONS[0];
	if (!option) {
		return "";
	}
	return `${resolvedBase}/previews/${option.id}-d20.webp`;
}
