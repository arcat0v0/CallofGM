import { AppError } from "@/platform/errors/app-error";

export function parseCorsOrigins(
	raw: string | undefined,
	nodeEnv: string,
): string[] {
	if (raw !== undefined && raw.trim() !== "") {
		return raw
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}
	if (nodeEnv === "production") {
		return [];
	}
	return ["http://localhost:15633", "http://localhost:15632"];
}

function firstHeaderValue(value: string | null): string | null {
	const first = value?.split(",")[0]?.trim();
	return first || null;
}

function originOf(raw: string): string | null {
	try {
		const url = new URL(raw);
		return `${url.protocol}//${url.host}`;
	} catch {
		return null;
	}
}

/**
 * 浏览器实际访问的来源。TLS 在受信反向代理处终止时，
 * 服务端必须从 X-Forwarded-Proto / Host 还原公网来源，
 * 否则会拿内部 http://127.0.0.1:15632 去和浏览器 Origin 比较。
 */
export function requestOrigin(request: Request, trustProxy: boolean): string {
	if (trustProxy) {
		const proto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
		const host =
			firstHeaderValue(request.headers.get("x-forwarded-host")) ??
			firstHeaderValue(request.headers.get("host"));
		if ((proto === "http" || proto === "https") && host) {
			return `${proto}://${host}`;
		}
	}
	return originOf(request.url) ?? "";
}

export function isAllowedOrigin(
	origin: string,
	allowed: string[],
	expectedOrigin: string,
): boolean {
	if (allowed.includes(origin)) {
		return true;
	}
	if (allowed.length === 0) {
		return origin === expectedOrigin;
	}
	return false;
}

/** Cookie 写接口：浏览器带 Origin 时必须命中允许列表；测试/非浏览器无 Origin 则放行。 */
export function assertTrustedOrigin(
	request: Request,
	allowed: string[],
	trustProxy = false,
): void {
	const expected = requestOrigin(request, trustProxy);
	const origin = request.headers.get("origin");
	if (origin) {
		if (!isAllowedOrigin(origin, allowed, expected)) {
			throw new AppError("FORBIDDEN", "Invalid origin", 403);
		}
		return;
	}
	const referer = request.headers.get("referer");
	if (referer) {
		const derived = originOf(referer);
		if (!derived || !isAllowedOrigin(derived, allowed, expected)) {
			throw new AppError("FORBIDDEN", "Invalid origin", 403);
		}
	}
}
