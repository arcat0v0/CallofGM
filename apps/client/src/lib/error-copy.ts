import { t, translateOr } from "@/i18n";

const STATUS_KEYS: Record<number, string> = {
	400: "error.status.400",
	401: "error.status.401",
	403: "error.status.403",
	404: "error.status.404",
	409: "error.status.409",
	413: "error.status.413",
};

export function errorCopy(input: {
	code?: string | null;
	status?: number | null;
}): string {
	const code = input.code;
	if (code) {
		const key = `error.${code}`;
		const text = translateOr(key, "");
		if (text) {
			return text;
		}
	}
	const status = input.status ?? 0;
	if (status === 429) {
		return t("error.RATE_LIMITED");
	}
	if (status >= 500) {
		return t("error.status.500");
	}
	const statusKey = STATUS_KEYS[status];
	return statusKey ? t(statusKey) : t("error.fallback");
}
