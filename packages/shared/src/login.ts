import { z } from "zod";

export const LoginSearch = z.object({
	returnTo: z.string().optional(),
});

export type LoginSearch = z.infer<typeof LoginSearch>;

const LOGIN_PATH = "/login";
const JOIN_PATH = "/join/";
const PLAY_PATH = "/play/";
const SUBMIT_PATH = "/submit/";

export function loginHref(returnTo?: string | null): string {
	return returnTo
		? `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`
		: LOGIN_PATH;
}

export function safeReturnTo(value: string | null | undefined): string | null {
	if (
		!value?.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("/../") ||
		value.includes("/./") ||
		value.includes("\\")
	) {
		return null;
	}
	return [JOIN_PATH, PLAY_PATH, SUBMIT_PATH].some((prefix) =>
		value.startsWith(prefix),
	)
		? value
		: null;
}
