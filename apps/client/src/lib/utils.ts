import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClasses = extendTailwindMerge({
	extend: {
		theme: {
			text: [
				...["display", "headline", "title", "body", "label"].flatMap((family) =>
					["large", "medium", "small"].flatMap((size) => [
						`${family}-${size}`,
						`${family}-${size}-emph`,
					]),
				),
				"ticket-total",
				"check-roll",
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return mergeClasses(clsx(inputs));
}
