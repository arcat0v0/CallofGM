import type {
	AuthMeResponse,
	LoginResponse,
	PlayerIdentityResponse,
	PlayerMeResponse,
	UserRole,
} from "@cogm/shared";
import { redirect } from "@tanstack/react-router";
import { type AccountRole, useIdentityStore } from "@/stores/identity-store";
import { api, isApiError } from "./api";
import { getFingerprint } from "./fingerprint";

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

export async function loginAccount(
	username: string,
	password: string,
): Promise<LoginResponse> {
	const result = await api<LoginResponse>("/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	});
	resetPlayerIdentityCache();
	useIdentityStore.getState().setAccount({
		userId: result.userId,
		username: result.username,
		role: result.role as AccountRole,
	});
	return result;
}

export async function logoutAccount(): Promise<void> {
	try {
		await api("/auth/logout", { method: "POST" });
	} finally {
		resetPlayerIdentityCache();
		useIdentityStore.getState().setAccount(null);
	}
}

export async function fetchAccountMe(): Promise<AuthMeResponse | null> {
	try {
		const me = await api<AuthMeResponse>("/auth/me");
		useIdentityStore.getState().setAccount({
			userId: me.userId,
			username: me.username,
			role: me.role as AccountRole,
		});
		return me;
	} catch (error) {
		if (isApiError(error) && error.status === 401) {
			useIdentityStore.getState().setAccount(null);
			return null;
		}
		throw error;
	}
}

export function roleHome(role: UserRole): "/admin" | "/gm" | "/pl" {
	const homes: Record<UserRole, "/admin" | "/gm" | "/pl"> = {
		admin: "/admin",
		gm: "/gm",
		pl: "/pl",
	};
	return homes[role];
}

export async function requireAccount(
	roles: AccountRole[] = ["gm", "admin", "pl"],
): Promise<AuthMeResponse> {
	const me = await fetchAccountMe();
	if (!me) {
		throw redirect({ to: "/login" });
	}
	if (!roles.includes(me.role as AccountRole)) {
		throw redirect({ to: roleHome(me.role) });
	}
	return me;
}

export async function requireGmAuth(): Promise<AuthMeResponse> {
	return requireAccount(["gm"]);
}

export async function resolveAccountRole(): Promise<AccountRole | null> {
	if (useIdentityStore.getState().accountResolved) {
		return useIdentityStore.getState().account?.role ?? null;
	}
	const me = await fetchAccountMe();
	return (me?.role as AccountRole | undefined) ?? null;
}
