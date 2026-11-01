import { redirect } from "@tanstack/react-router";
import type { GmMeResponse, PlayerIdentityResponse, PlayerMeResponse } from "@cogm/shared";
import { api, isApiError } from "./api";
import { getFingerprint } from "./fingerprint";
import { useIdentityStore } from "@/stores/identity-store";

let identityRequest: Promise<PlayerIdentityResponse> | null = null;

async function resolvePlayer(): Promise<PlayerIdentityResponse> {
  try {
    const me = await api<PlayerMeResponse>("/player/me");
    useIdentityStore.getState().setPlayer(me.playerId);
    return { playerId: me.playerId };
  } catch (error) {
    if (!isApiError(error) || error.status !== 401) {
      throw error;
    }
  }

  const fingerprint = await getFingerprint();
  const result = await api<PlayerIdentityResponse>("/player/identity", {
    method: "POST",
    fingerprint: true,
    body: JSON.stringify({ fingerprint }),
  });
  useIdentityStore.getState().setPlayer(result.playerId);
  return result;
}

export function ensurePlayer(): Promise<PlayerIdentityResponse> {
  if (!identityRequest) {
    identityRequest = resolvePlayer();
    identityRequest.catch(() => {
      identityRequest = null;
    });
  }
  return identityRequest;
}

export function resetPlayerIdentityCache(): void {
  identityRequest = null;
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