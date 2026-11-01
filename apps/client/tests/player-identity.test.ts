import { beforeEach, describe, expect, mock, test } from "bun:test";

let fingerprintCalls = 0;

mock.module("../src/lib/fingerprint", () => ({
  getFingerprint: async () => {
    fingerprintCalls += 1;
    return "fp-test";
  },
  getKnownFingerprint: () => null,
}));

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

const { ensurePlayer, resetPlayerIdentityCache } = await import("../src/lib/identity");

type RecordedRequest = {
  path: string;
  method: string;
  fingerprint: string | null;
};

let requests: RecordedRequest[] = [];

function stubFetch(handler: (path: string, method: string) => Response): void {
  requests = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    requests.push({
      path: new URL(url, "http://localhost").pathname,
      method,
      fingerprint: new Headers(init?.headers).get("X-Fingerprint"),
    });
    return handler(new URL(url, "http://localhost").pathname, method);
  }) as typeof fetch;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const meRequests = () => requests.filter((request) => request.path === "/api/v1/player/me");
const identityRequests = () => requests.filter((request) => request.path === "/api/v1/player/identity");

describe("player identity resolution", () => {
  beforeEach(() => {
    resetPlayerIdentityCache();
    fingerprintCalls = 0;
  });

  test("a valid player cookie resolves through GET /player/me without fingerprinting or a POST", async () => {
    stubFetch((path) => (path === "/api/v1/player/me" ? json(200, { playerId: "p-cookie" }) : json(500, {})));

    const results = await Promise.all([ensurePlayer(), ensurePlayer(), ensurePlayer()]);

    expect(results.map((result) => result.playerId)).toEqual(["p-cookie", "p-cookie", "p-cookie"]);
    expect(meRequests()).toHaveLength(1);
    expect(identityRequests()).toHaveLength(0);
    expect(fingerprintCalls).toBe(0);
    expect(meRequests()[0]?.fingerprint).toBeNull();
  });

  test("concurrent mounts share one identity POST when the cookie is missing", async () => {
    stubFetch((path) =>
      path === "/api/v1/player/me" ? json(401, { code: "AUTH_REQUIRED" }) : json(200, { playerId: "p-new" }),
    );

    const results = await Promise.all([ensurePlayer(), ensurePlayer(), ensurePlayer()]);

    expect(results.every((result) => result.playerId === "p-new")).toBe(true);
    expect(meRequests()).toHaveLength(1);
    expect(identityRequests()).toHaveLength(1);
    expect(identityRequests()[0]?.method).toBe("POST");
    expect(identityRequests()[0]?.fingerprint).toBe("fp-test");
    expect(fingerprintCalls).toBe(2);
  });

  test("a 429 identity response rejects without an automatic retry loop", async () => {
    stubFetch((path) =>
      path === "/api/v1/player/me" ? json(401, { code: "AUTH_REQUIRED" }) : json(429, { code: "RATE_LIMITED" }),
    );

    const error = await ensurePlayer().catch((cause: unknown) => cause);

    expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    await Promise.resolve();
    expect(identityRequests()).toHaveLength(1);
    expect(fingerprintCalls).toBe(2);
  });
});