import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { JoinInfoResponse } from "@cogm/shared";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import "@/themes/runtime/bootstrap";

mock.module("../src/lib/fingerprint", () => ({
	getFingerprint: async () => "fp-test",
	getKnownFingerprint: () => null,
}));

const { Route: JoinRoute } = await import("../src/routes/join.$sessionId");
const { resetPlayerIdentityCache } = await import("../src/lib/identity");
const { useIdentityStore } = await import("../src/stores/identity-store");

type FetchCall = {
	path: string;
	method: string;
	body: unknown;
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function makeJoinInfo(
	characters: JoinInfoResponse["characters"],
	requiresLogin = characters.some((c) => c.claimable && !c.claimed),
): JoinInfoResponse {
	return {
		session: {
			id: "session-1",
			name: "测试团",
			status: "waiting",
			phase: "free_discussion",
			moduleId: "module-1",
			moduleName: "测试模组",
			ruleId: "coc7e",
			themeId: null,
		},
		characters,
		requiresLogin,
	};
}

function renderJoinPage() {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => null,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		component: () => null,
	});
	const playRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/play/$sessionId",
		component: () => null,
	});
	const joinRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/join/$sessionId",
		component: JoinRoute.options.component,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			indexRoute,
			loginRoute,
			playRoute,
			joinRoute,
		]),
		history: createMemoryHistory({ initialEntries: ["/join/session-1"] }),
	});
	return render(createElement(RouterProvider, { router }));
}

describe("JoinPage claimable filtering", () => {
	let originalFetch: typeof fetch;
	let calls: FetchCall[];

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		calls = [];
		resetPlayerIdentityCache();
		useIdentityStore.setState({
			account: null,
			accountResolved: false,
			playerId: null,
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function stubJoinFetch(options: {
		account: unknown | null;
		joinInfo: JoinInfoResponse;
	}) {
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const path = new URL(url, "http://localhost").pathname;
			const method = init?.method ?? "GET";
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			calls.push({ path, method, body });

			if (path === "/api/v1/auth/me") {
				return options.account
					? jsonResponse(200, options.account)
					: jsonResponse(401, { code: "AUTH_REQUIRED" });
			}
			if (path === "/api/v1/player/me") {
				return jsonResponse(401, { code: "AUTH_REQUIRED" });
			}
			if (path === "/api/v1/player/identity") {
				return jsonResponse(200, { playerId: "anon-player-1" });
			}
			if (path === "/api/v1/public/sessions/session-1/join-info") {
				return jsonResponse(200, options.joinInfo);
			}
			if (path === "/api/v1/sessions/session-1/claim") {
				return jsonResponse(200, {
					id: "claim-1",
					sessionId: "session-1",
					holderKind: options.account ? "user" : "anonymous",
					playerId: options.account ? null : "anon-player-1",
					userId: options.account ? "pl-1" : null,
					role: (body as { role?: string } | null)?.role ?? "ob",
					characterId:
						(body as { characterId?: string } | null)?.characterId ?? null,
					releasedAt: null,
					createdAt: 1,
				});
			}
			return jsonResponse(404, { code: "NOT_FOUND" });
		}) as unknown as typeof fetch;
	}

	test("authenticated PL does not render or select claimable:false PCs when another PC is claimable", async () => {
		stubJoinFetch({
			account: { type: "user", userId: "pl-1", username: "pl1", role: "pl" },
			joinInfo: makeJoinInfo([
				{
					id: "pc-other",
					name: "别人的调查员",
					kind: "pc",
					claimed: false,
					claimable: false,
				},
				{
					id: "pc-mine",
					name: "我的调查员",
					kind: "pc",
					claimed: false,
					claimable: true,
				},
			]),
		});

		const view = renderJoinPage();
		await waitFor(() =>
			expect(within(view.container).queryByText("我的调查员")).toBeTruthy(),
		);

		expect(within(view.container).queryByText("别人的调查员")).toBeNull();
		const enterBtn = within(view.container).getByRole("button", {
			name: /以「我的调查员」进入/,
		});
		expect(enterBtn).toBeTruthy();
	});

	test("authenticated PL falls back to OB when all PCs are claimable:false", async () => {
		stubJoinFetch({
			account: { type: "user", userId: "pl-1", username: "pl1", role: "pl" },
			joinInfo: makeJoinInfo([
				{
					id: "pc-other",
					name: "不可认领角色",
					kind: "pc",
					claimed: false,
					claimable: false,
				},
			]),
		});

		const view = renderJoinPage();
		await waitFor(() =>
			expect(
				within(view.container).queryByRole("button", {
					name: /以「观战席」进入/,
				}),
			).toBeTruthy(),
		);

		expect(within(view.container).queryByText("不可认领角色")).toBeNull();
		fireEvent.click(
			within(view.container).getByRole("button", {
				name: /以「观战席」进入/,
			}),
		);
		await waitFor(() =>
			expect(
				calls.some(
					(c) =>
						c.path === "/api/v1/sessions/session-1/claim" &&
						c.method === "POST",
				),
			).toBe(true),
		);
		const claimCall = calls.find(
			(c) =>
				c.path === "/api/v1/sessions/session-1/claim" && c.method === "POST",
		);
		expect(claimCall?.body).toEqual({ role: "ob" });
	});

	test("anonymous visitor preserves visible login path when claimable PCs exist", async () => {
		stubJoinFetch({
			account: null,
			joinInfo: makeJoinInfo(
				[
					{
						id: "pc-1",
						name: "待认领调查员",
						kind: "pc",
						claimed: false,
						claimable: true,
					},
				],
				true,
			),
		});

		const view = renderJoinPage();
		await waitFor(() =>
			expect(
				within(view.container).queryByText(
					"认领 PC 席位需要玩家账号，请先登录",
				),
			).toBeTruthy(),
		);
		const loginLink = within(view.container).getByRole("link", {
			name: /登录并认领/,
		});
		expect(loginLink.getAttribute("href")).toContain("/login");
	});

	test("issues fresh join-info requests when viewer identity changes while prior request is deferred", async () => {
		let activeAccount: {
			type: "user";
			userId: string;
			username: string;
			role: "pl" | "gm";
		} | null = null;
		const deferredRequests: Array<
			ReturnType<typeof Promise.withResolvers<Response>>
		> = [];

		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const path = new URL(url, "http://localhost").pathname;
			const method = init?.method ?? "GET";
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			calls.push({ path, method, body });

			if (path === "/api/v1/auth/me") {
				return activeAccount
					? jsonResponse(200, activeAccount)
					: jsonResponse(401, { code: "AUTH_REQUIRED" });
			}
			if (path === "/api/v1/player/me") {
				return jsonResponse(401, { code: "AUTH_REQUIRED" });
			}
			if (path === "/api/v1/player/identity") {
				return jsonResponse(200, { playerId: "anon-player-1" });
			}
			if (path === "/api/v1/public/sessions/session-1/join-info") {
				const deferred = Promise.withResolvers<Response>();
				deferredRequests.push(deferred);
				return deferred.promise;
			}
			return jsonResponse(404, { code: "NOT_FOUND" });
		}) as unknown as typeof fetch;

		const anonView = renderJoinPage();
		await waitFor(() => expect(deferredRequests).toHaveLength(1));
		anonView.unmount();

		activeAccount = {
			type: "user",
			userId: "pl-1",
			username: "pl1",
			role: "pl",
		};
		resetPlayerIdentityCache();
		useIdentityStore.setState({
			account: null,
			accountResolved: false,
			playerId: null,
		});

		const pl1View = renderJoinPage();
		await waitFor(() => expect(deferredRequests).toHaveLength(2));
		pl1View.unmount();

		activeAccount = {
			type: "user",
			userId: "gm-1",
			username: "gm1",
			role: "gm",
		};
		resetPlayerIdentityCache();
		useIdentityStore.setState({
			account: null,
			accountResolved: false,
			playerId: null,
		});

		const gmView = renderJoinPage();
		await waitFor(() => expect(deferredRequests).toHaveLength(3));
		gmView.unmount();

		activeAccount = {
			type: "user",
			userId: "pl-2",
			username: "pl2",
			role: "pl",
		};
		resetPlayerIdentityCache();
		useIdentityStore.setState({
			account: null,
			accountResolved: false,
			playerId: null,
		});

		const pl2View = renderJoinPage();
		await waitFor(() => expect(deferredRequests).toHaveLength(4));

		deferredRequests[0]?.resolve(
			jsonResponse(
				200,
				makeJoinInfo(
					[
						{
							id: "pc-anon",
							name: "匿名可见角色",
							kind: "pc",
							claimed: false,
							claimable: true,
						},
					],
					true,
				),
			),
		);
		deferredRequests[1]?.resolve(
			jsonResponse(
				200,
				makeJoinInfo([
					{
						id: "pc-pl1",
						name: "一号玩家角色",
						kind: "pc",
						claimed: false,
						claimable: true,
					},
				]),
			),
		);
		deferredRequests[2]?.resolve(
			jsonResponse(
				200,
				makeJoinInfo([
					{
						id: "pc-gm",
						name: "主持人视图角色",
						kind: "pc",
						claimed: false,
						claimable: false,
					},
				]),
			),
		);
		deferredRequests[3]?.resolve(
			jsonResponse(
				200,
				makeJoinInfo([
					{
						id: "pc-pl1",
						name: "一号玩家角色",
						kind: "pc",
						claimed: false,
						claimable: false,
					},
					{
						id: "pc-pl2",
						name: "二号玩家角色",
						kind: "pc",
						claimed: false,
						claimable: true,
					},
				]),
			),
		);

		await waitFor(() =>
			expect(
				within(pl2View.container).queryByText("二号玩家角色"),
			).toBeTruthy(),
		);
		expect(within(pl2View.container).queryByText("一号玩家角色")).toBeNull();
		expect(within(pl2View.container).queryByText("匿名可见角色")).toBeNull();
		expect(
			within(pl2View.container).getByRole("button", {
				name: /以「二号玩家角色」进入/,
			}),
		).toBeTruthy();
	});
});
