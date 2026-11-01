import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { setupTestApp, type TestContext } from "../helpers/setup";
import type { BlacklistEntryDto } from "@cogm/shared";

describe("Blacklist context contract", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1"],
      characters: [{ id: "char-pc1", name: "调查员甲", kind: "pc" }],
      claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
    });
  });

  afterAll(() => {
    ctx.container.dbContext.sqlite.close();
  });

  async function gmRequest(path: string, method: string, body?: unknown): Promise<Response> {
    return ctx.app.handle(
      new Request(`http://localhost/api/v1/gm${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.gmToken}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }

  function readCode(body: unknown): string | undefined {
    return body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code
      : undefined;
  }

  function readRemoved(body: unknown): boolean | undefined {
    return body && typeof body === "object" && "removed" in body && typeof body.removed === "boolean"
      ? body.removed
      : undefined;
  }

  function readField(body: unknown, key: "banned" | "fingerprintHash"): string | undefined {
    if (!body || typeof body !== "object") {
      return undefined;
    }
    if (key === "banned") {
      return "banned" in body && typeof body.banned === "string" ? body.banned : undefined;
    }
    return "fingerprintHash" in body && typeof body.fingerprintHash === "string"
      ? body.fingerprintHash
      : undefined;
  }

  async function listEntries(): Promise<BlacklistEntryDto[]> {
    const res = await gmRequest("/blacklist", "GET");
    expect(res.status).toBe(200);
    return (await res.json()) as BlacklistEntryDto[];
  }

  test("按 playerId 拉黑记录 playerId 与封禁时的显示名", async () => {
    const playerId = ctx.playerIds.get("pc1")!;
    const banRes = await gmRequest("/blacklist", "POST", {
      playerId,
      reason: "恶意刷屏",
      durationSeconds: 3600,
    });
    expect(banRes.status).toBe(200);
    const banBody: unknown = await banRes.json();
    expect(readField(banBody, "banned")).toBe(playerId);
    const fingerprintHash = readField(banBody, "fingerprintHash");
    expect(fingerprintHash).toBeDefined();

    const entries = await listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      playerId,
      displayName: "调查员甲",
      fingerprintHash,
      reason: "恶意刷屏",
    });
  });

  test("解封后可按遗留指纹哈希再次封禁", async () => {
    const [entry] = await listEntries();
    const unbanRes = await gmRequest("/blacklist/unban", "POST", {
      fingerprintHash: entry!.fingerprintHash,
    });
    expect(unbanRes.status).toBe(200);
    expect(readRemoved(await unbanRes.json())).toBe(true);
    expect(await listEntries()).toHaveLength(0);

    const rebanRes = await gmRequest("/blacklist", "POST", {
      fingerprintHash: entry!.fingerprintHash,
      reason: "再次封禁",
    });
    expect(rebanRes.status).toBe(200);

    const restored = await listEntries();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      playerId: null,
      displayName: null,
      fingerprintHash: entry!.fingerprintHash,
      reason: "再次封禁",
    });
  });

  test("未知 playerId 与缺少标识均被拒绝", async () => {
    const missingPlayer = await gmRequest("/blacklist", "POST", {
      playerId: "does-not-exist",
      reason: "x",
    });
    expect(missingPlayer.status).toBe(404);
    expect(readCode(await missingPlayer.json())).toBe("PLAYER_NOT_FOUND");

    const emptyTarget = await gmRequest("/blacklist", "POST", { reason: "x" });
    expect(emptyTarget.status).toBe(400);
    expect(readCode(await emptyTarget.json())).toBe("VALIDATION_FAILED");
  });
});
