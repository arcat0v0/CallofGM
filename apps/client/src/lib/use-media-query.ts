import { useSyncExternalStore } from "react";

/** 订阅 CSS 媒体查询；服务端/无 matchMedia 环境返回 fallback */
export function useMediaQuery(query: string, fallback = false): boolean {
	return useSyncExternalStore(
		(onChange) => {
			if (typeof window === "undefined" || !window.matchMedia) {
				return () => undefined;
			}
			const media = window.matchMedia(query);
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		() =>
			typeof window !== "undefined" && window.matchMedia
				? window.matchMedia(query).matches
				: fallback,
		() => fallback,
	);
}
