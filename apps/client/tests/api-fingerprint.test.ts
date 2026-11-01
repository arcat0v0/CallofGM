import { beforeEach, describe, expect, mock, test } from "bun:test";

let fingerprintCalls = 0;

mock.module("../src/lib/fingerprint", () => ({
  getFingerprint: async () => {
    fingerprintCalls += 1;
    return "fp-test";
  },
  getKnownFingerprint: () => null,
}));

const { api } = await import("../src/lib/api");

type RecordedRequest = {
  path: string;
  method: string;
  fingerprint: string | null;
  credentials: RequestCredentials | undefined;
};

let requests: RecordedRequest[] = [];

function stubFetch(): void {
  requests = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({
      path: new URL(url, "http://localhost").pathname,
      method: init?.method ?? "GET",
      fingerprint: new Headers(init?.headers).get("X-Fingerprint"),
      credentials: init?.credentials,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("api fingerprint opt-in", () => {
  beforeEach(() => {
    fingerprintCalls = 0;
    stubFetch();
  });

  test("ordinary requests never wait on FingerprintJS", async () => {
    await api("/gm/modules");
    await api("/sessions/s1/history?limit=50");
    await api("/media/asset-1");

    expect(fingerprintCalls).toBe(0);
    expect(requests.map((request) => request.fingerprint)).toEqual([null, null, null]);
    expect(requests.every((request) => request.credentials === "include")).toBe(true);
  });

  test("only requests that opt in send X-Fingerprint", async () => {
    await api("/player/identity", {
      method: "POST",
      fingerprint: true,
      body: JSON.stringify({ fingerprint: "fp-test" }),
    });

    expect(fingerprintCalls).toBe(1);
    expect(requests[0]?.fingerprint).toBe("fp-test");
    expect(requests[0]?.method).toBe("POST");
  });
});