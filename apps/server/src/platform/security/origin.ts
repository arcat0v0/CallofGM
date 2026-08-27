import { AppError } from "@/platform/errors/app-error";

export function parseCorsOrigins(raw: string | undefined, nodeEnv: string): string[] {
  if (raw !== undefined && raw.trim() !== "") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (nodeEnv === "production") {
    return [];
  }
  return ["http://localhost:15633"];
}

export function isAllowedOrigin(origin: string, allowed: string[], requestUrl: string): boolean {
  if (allowed.includes(origin)) {
    return true;
  }
  if (allowed.length === 0) {
    try {
      const url = new URL(requestUrl);
      return origin === `${url.protocol}//${url.host}`;
    } catch {
      return false;
    }
  }
  return false;
}

/** Cookie 写接口：浏览器带 Origin 时必须命中允许列表；测试/非浏览器无 Origin 则放行。 */
export function assertTrustedOrigin(request: Request, allowed: string[]): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }
  if (!isAllowedOrigin(origin, allowed, request.url)) {
    throw new AppError("FORBIDDEN", "Invalid origin", 403);
  }
}
