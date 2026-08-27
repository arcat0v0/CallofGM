import { createHash } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 高熵不透明 token：数据库只存 hash，token 本身不含 playerId。 */
export function issueOpaqueToken(): { token: string; tokenHash: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Buffer.from(bytes).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
