import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { MyClaimResponse } from "@cogm/shared";
import { render, waitFor } from "@testing-library/react";

mock.module("../src/lib/fingerprint", () => ({
	getFingerprint: async () => "fp-test",
	getKnownFingerprint: () => null,
}));

const { usePlayEntry } = await import("@/features/play/use-play-entry");
const { resetPlayerIdentityCache } = await import("@/lib/identity");

type Request = {
	path: string;
	method: string;
	body: unknown;
};

type Scenario = {
	account: unknown | null;
	claim: MyClaimResponse;
};

const MY_CLAIM_PATH = "/api/v1/sessions/session-1/my-claim";
const CLAIM_PATH = "/api/v1/sessions/session-1/claim";
const AUTH_ME_PATH = "/api/v1/auth/me";
const PLAYER_ME_PATH = "/api/v1/player/me";
const PLAYER_IDENTITY_PATH = "/api/v1/player/identity";

const NO_SEAT: MyClaimResponse = {
	claim: null,
	sessionStatus: "active",
	isGm: false,
	canAutoClaimCharacterId: null,
};

const ANONYMOUS_CLAIM: NonNullable<MyClaimResponse["claim"]> = {
	id: "claim-1",
	sessionId: "session-1",
	holderKind: "anonymous",
	playerId: "player-1",
	userId: null,
	role: "ob",
	characterId: null,
	releasedAt: null,
	createdAt: 1,
};

let requests: Request[] = [];
let scenario: Scenario = { account: null, claim: NO_SEAT };

function json(status: number, body: unknown): Response {
	return new Response(status === 204 ? null : JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function record(input: RequestInfo | URL, init?: RequestInit): Request {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.toString()
				: input.url;
	const request: Request = {
		path: new URL(url, "http://localhost").pathname,
		method: init?.method ?? "GET",
		body: init?.body ? JSON.parse(String(init.body)) : null,
	};
	requests.push(request);
	return request;
}

function stubFetch(next: Scenario): void {
	scenario = next;
	requests = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const { path } = record(input, init);
		if (path === AUTH_ME_PATH) {
			return scenario.account
				? json(200, scenario.account)
				: json(401, { code: "AUTH_REQUIRED" });
		}
		if (path === PLAYER_ME_PATH) {
			return json(401, { code: "AUTH_REQUIRED" });
		}
		if (path === PLAYER_IDENTITY_PATH) {
			return json(200, { playerId: "player-1" });
		}
		if (path === MY_CLAIM_PATH) {
			return json(200, scenario.claim);
		}
		if (path === CLAIM_PATH) {
			return json(200, {});
		}
		return json(500, { code: "UNEXPECTED", message: path });
	}) as typeof fetch;
}

function Harness({ onGate }: { onGate: (gate: unknown) => void }) {
	const { gate } = usePlayEntry("session-1");
	onGate(gate);
	return null;
}

async function renderEntry(next: Scenario): Promise<unknown[]> {
	stubFetch(next);
	const gates: unknown[] = [];
	render(<Harness onGate={(gate) => gates.push(gate)} />);
	await waitFor(() =>
		expect(requests.some(({ path }) => path === MY_CLAIM_PATH)).toBe(true),
	);
	await waitFor(() =>
		expect((gates.at(-1) as { state?: string } | undefined)?.state).not.toBe(
			"checking",
		),
	);
	return gates;
}

function claimPosts(): Request[] {
	return requests.filter(
		({ path, method }) => path === CLAIM_PATH && method === "POST",
	);
}

describe("usePlayEntry", () => {
	beforeEach(() => {
		resetPlayerIdentityCache();
	});

	test("a fresh anonymous browser establishes its player identity before my-claim", async () => {
		await renderEntry({ account: null, claim: NO_SEAT });

		const relevant = requests.map(({ path, method }) => `${method} ${path}`);
		expect(relevant.indexOf(`GET ${AUTH_ME_PATH}`)).toBeLessThan(
			relevant.indexOf(`POST ${PLAYER_IDENTITY_PATH}`),
		);
		expect(relevant.indexOf(`POST ${PLAYER_IDENTITY_PATH}`)).toBeLessThan(
			relevant.indexOf(`GET ${MY_CLAIM_PATH}`),
		);
	});

	test("a fresh anonymous browser without a seat stays in the no-seat gate", async () => {
		const gates = await renderEntry({ account: null, claim: NO_SEAT });

		expect(gates.at(-1)).toEqual({ state: "no-seat", ended: false });
		expect(claimPosts()).toHaveLength(0);
	});

	test("a fresh anonymous browser never auto-claims an advertised PC", async () => {
		const gates = await renderEntry({
			account: null,
			claim: { ...NO_SEAT, canAutoClaimCharacterId: "character-1" },
		});

		expect(gates.at(-1)).toEqual({ state: "no-seat", ended: false });
		expect(claimPosts()).toHaveLength(0);
	});

	test("an authenticated PL auto-claims the single available character", async () => {
		const account = {
			type: "user",
			userId: "user-1",
			username: "player",
			role: "pl",
		};
		const first: MyClaimResponse = {
			...NO_SEAT,
			canAutoClaimCharacterId: "character-1",
		};
		const second: MyClaimResponse = {
			...first,
			claim: {
				...ANONYMOUS_CLAIM,
				holderKind: "user",
				playerId: null,
				userId: "user-1",
				role: "pc",
				characterId: "character-1",
			},
		};
		stubFetch({ account, claim: first });
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		): Promise<Response> => {
			const { path } = record(input, init);
			if (path === AUTH_ME_PATH) {
				return json(200, account);
			}
			if (path === MY_CLAIM_PATH) {
				return json(200, claimPosts().length > 0 ? second : first);
			}
			if (path === CLAIM_PATH) {
				return json(200, {});
			}
			return json(500, { code: "UNEXPECTED", message: path });
		}) as typeof fetch;

		const gates: unknown[] = [];
		render(<Harness onGate={(gate) => gates.push(gate)} />);
		await waitFor(() => expect(gates.at(-1)).toEqual({ state: "ready" }));

		expect(claimPosts().map(({ body }) => body)).toEqual([
			{ role: "pc", characterId: "character-1" },
		]);
		expect(
			requests.filter(({ path }) => path === PLAYER_IDENTITY_PATH),
		).toHaveLength(0);
	});

	test("a GM account restores its GM view without claiming or creating an anonymous player", async () => {
		const gates = await renderEntry({
			account: {
				type: "user",
				userId: "gm-1",
				username: "gm",
				role: "gm",
			},
			claim: { ...NO_SEAT, isGm: true },
		});

		expect(gates.at(-1)).toEqual({ state: "ready" });
		expect(
			requests.filter(({ path }) => path === PLAYER_IDENTITY_PATH),
		).toHaveLength(0);
		expect(claimPosts()).toHaveLength(0);
	});

	test("an existing anonymous claim restores the play view without auto-claiming OB or PC", async () => {
		const gates = await renderEntry({
			account: null,
			claim: {
				claim: ANONYMOUS_CLAIM,
				sessionStatus: "active",
				isGm: false,
				canAutoClaimCharacterId: "character-1",
			},
		});

		expect(gates.at(-1)).toEqual({ state: "ready" });
		expect(claimPosts()).toHaveLength(0);
	});
});
