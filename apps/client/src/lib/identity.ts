import { redirect } from "@tanstack/react-router";
import type { GmMeResponse, PlayerIdentityResponse } from "@cogm/shared";
import { api, isApiError } from "./api";
import { getFingerprint } from "./fingerprint";
import { useIdentityStore } from "@/stores/identity-store";

export async function ensurePlayer(): Promise<PlayerIdentityResponse> {
  const fingerprint = await getFingerprint();
  const result = await api<PlayerIdentityResponse>("/player/identity", {
    method: "POST",
    body: JSON.stringify({ fingerprint }),
  });
  useIdentityStore.getState().setPlayer(result.playerId);
  return result;
}

export async function loginGm(password: string): Promise<void> {
  await api("/gm/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "gm", password }),
  });
  useIdentityStore.getState().setGmAuthenticated(true);
}

export async function logoutGm(): Promise<void> {
  try {
    await api("/gm/auth/logout", { method: "POST" });
  } finally {
    useIdentityStore.getState().setGmAuthenticated(false);
  }
}

export async function fetchGmMe(): Promise<GmMeResponse> {
  const me = await api<GmMeResponse>("/gm/auth/me");
  useIdentityStore.getState().setGmAuthenticated(true);
  return me;
}

export async function requireGmAuth(): Promise<void> {
  try {
    await fetchGmMe();
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      throw redirect({ to: "/gm/login" });
    }
    throw error;
  }
}
