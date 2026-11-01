import { describe, expect, test } from "bun:test";
import type { MyClaimResponse } from "@cogm/shared";
import { resolvePlayEntry } from "../src/lib/play-entry";

function claimResponse(overrides: Partial<MyClaimResponse> = {}): MyClaimResponse {
  return {
    claim: null,
    sessionStatus: "active",
    isGm: false,
    ...overrides,
  };
}

const activeClaim: MyClaimResponse["claim"] = {
  id: "claim-1",
  sessionId: "s1",
  playerId: "p1",
  role: "pc",
  characterId: "c1",
  releasedAt: null,
  createdAt: 1,
};

describe("play entry gating", () => {
  test("stays in checking while the claim lookup is pending", () => {
    expect(resolvePlayEntry({ claim: null, failed: false })).toEqual({ state: "checking" });
  });

  test("reports an error when the claim lookup fails", () => {
    expect(resolvePlayEntry({ claim: null, failed: true })).toEqual({ state: "error" });
  });

  test("blocks a player without an active claim in a running session", () => {
    expect(resolvePlayEntry({ claim: claimResponse(), failed: false })).toEqual({
      state: "no-seat",
      ended: false,
    });
  });

  test("keeps the ended-session copy for a player without a claim", () => {
    expect(
      resolvePlayEntry({ claim: claimResponse({ sessionStatus: "ended" }), failed: false }),
    ).toEqual({ state: "no-seat", ended: true });
  });

  test("allows entry when the player holds an active claim", () => {
    expect(resolvePlayEntry({ claim: claimResponse({ claim: activeClaim }), failed: false })).toEqual({
      state: "ready",
    });
  });

  test("allows entry for the GM console reviewer", () => {
    expect(resolvePlayEntry({ claim: claimResponse({ isGm: true }), failed: false })).toEqual({
      state: "ready",
    });
  });
});
