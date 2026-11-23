import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { CharacterDetailDto } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { createElement } from "react";
import "../src/themes/runtime/bootstrap";
import { AddNpcDialog } from "../src/features/gm-console/add-npc-dialog";
import { GmTopBar } from "../src/features/gm-console/gm-top-bar";
import { HandoutPanel } from "../src/features/gm-console/handout-panel";
import { ScenePanel } from "../src/features/gm-console/scene-panel";
import { parseLibrarySearch } from "../src/features/gm-characters/library-model";
import {
	parseModuleDetailSearch,
	parseModulesSearch,
} from "../src/features/gm-modules/module-model";
import { t } from "../src/i18n";
import {
	backParam,
	GM_BACK_PREFIXES,
	parseBackSearch,
	PL_BACK_PREFIXES,
	resolveBackTarget,
	safeBackPath,
} from "../src/lib/back-navigation";
import { Route as GmCharacterSheetRoute } from "../src/routes/gm/characters_.$characterId";
import { Route as ModuleRoute } from "../src/routes/gm/module.$moduleId";
import { Route as PlCharacterSheetRoute } from "../src/routes/pl/characters_.$characterId";
import { Route as PlCharacterNewRoute } from "../src/routes/pl/characters_.new";
import { useIdentityStore } from "../src/stores/identity-store";
import { usePlayStore } from "../src/stores/play-store";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function characterDetail(
	overrides: Partial<CharacterDetailDto> = {},
): CharacterDetailDto {
	return {
		id: "char-1",
		ownerId: "gm-1",
		ownerKind: "gm",
		name: "神秘馆长",
		background: "",
		kind: "npc",
		ruleId: "coc7e",
		sheetJson: JSON.stringify(
			coc7e.normalizeCoc7eSheet({
				attributes: {
					str: 50,
					con: 50,
					siz: 50,
					dex: 50,
					app: 50,
					int: 60,
					pow: 50,
					edu: 70,
					luck: 50,
				},
				skills: { 侦查: 60 },
			}),
		),
		sheetVersion: 1,
		profileVersion: 1,
		version: 1,
		originType: null,
		originRefId: null,
		createdAt: 1,
		updatedAt: 1,
		portraits: [],
		...overrides,
	};
}

describe("back navigation helpers", () => {
	test("validates internal back paths and blocks unsafe or self-referential paths", () => {
		expect(safeBackPath("/gm/session/s-1", GM_BACK_PREFIXES)).toBe(
			"/gm/session/s-1",
		);
		expect(
			safeBackPath("/gm/modules?rule=coc7e&view=ledger", GM_BACK_PREFIXES),
		).toBe("/gm/modules?rule=coc7e&view=ledger");
		expect(safeBackPath("//evil.example/phish", GM_BACK_PREFIXES)).toBeUndefined();
		expect(safeBackPath("https://evil.example/gm", GM_BACK_PREFIXES)).toBeUndefined();
		expect(safeBackPath("/gm/../admin", GM_BACK_PREFIXES)).toBeUndefined();
		expect(safeBackPath("/gm\\evil", GM_BACK_PREFIXES)).toBeUndefined();
		expect(safeBackPath("/pl/characters", GM_BACK_PREFIXES)).toBeUndefined();
		expect(
			safeBackPath("/gm/module/mod-1?tab=characters", GM_BACK_PREFIXES, "/gm/module/mod-1"),
		).toBeUndefined();
		expect(safeBackPath("/submit/tok-1", PL_BACK_PREFIXES)).toBe(
			"/submit/tok-1",
		);
	});

	test("omits default parent path in backParam when there are no query parameters", () => {
		expect(backParam("/gm/modules", "/gm/modules")).toBeUndefined();
		expect(
			backParam("/gm/modules?rule=coc7e", "/gm/modules"),
		).toBe("/gm/modules?rule=coc7e");
		expect(backParam("/gm", "/gm/modules")).toBe("/gm");
	});

	test("resolves parent labels and preserves query parameters", () => {
		const fromWorkbench = resolveBackTarget(
			{
				from: "/gm/session/sess-1",
				fallback: "/gm/modules",
				allowedPrefixes: GM_BACK_PREFIXES,
			},
			t,
		);
		expect(fromWorkbench).toEqual({
			href: "/gm/session/sess-1",
			to: "/gm/session/sess-1",
			label: "工作台",
		});

		const fromDashboard = resolveBackTarget(
			{
				from: "/gm",
				fallback: "/gm/modules",
				allowedPrefixes: GM_BACK_PREFIXES,
			},
			t,
		);
		expect(fromDashboard).toEqual({
			href: "/gm",
			to: "/gm",
			label: "团管理",
		});

		const fromFilteredModules = resolveBackTarget(
			{
				from: "/gm/modules?rule=coc7e&view=ledger",
				fallback: "/gm/modules",
				allowedPrefixes: GM_BACK_PREFIXES,
			},
			t,
		);
		expect(fromFilteredModules).toEqual({
			href: "/gm/modules?rule=coc7e&view=ledger",
			to: "/gm/modules",
			search: { rule: "coc7e", view: "ledger" },
			label: "模组管理",
		});

		const fromModuleCharacters = resolveBackTarget(
			{
				from: "/gm/module/mod-1?tab=characters&from=%2Fgm%2Fsession%2Fsess-1",
				fallback: "/gm/characters",
				allowedPrefixes: GM_BACK_PREFIXES,
			},
			t,
		);
		expect(fromModuleCharacters).toEqual({
			href: "/gm/module/mod-1?tab=characters&from=%2Fgm%2Fsession%2Fsess-1",
			to: "/gm/module/mod-1",
			search: { tab: "characters", from: "/gm/session/sess-1" },
			label: "模组详情",
		});

		const fallback = resolveBackTarget(
			{
				from: "https://evil.example",
				fallback: "/gm/modules",
				allowedPrefixes: GM_BACK_PREFIXES,
			},
			t,
		);
		expect(fallback).toEqual({
			href: "/gm/modules",
			to: "/gm/modules",
			label: "模组管理",
		});
	});
});

describe("hierarchical back navigation integration", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
		usePlayStore.getState().reset();
		useIdentityStore.setState({
			account: {
				userId: "gm-1",
				username: "gm",
				role: "gm",
			},
			accountResolved: true,
		});
		usePlayStore.setState({
			sessionId: "sess-1",
			moduleId: "mod-1",
			moduleName: "测试模组",
			sessionName: "测试团",
			ruleId: "coc7e",
			status: "active",
			phase: "free_discussion",
			catalogScenes: [],
			catalogHandouts: [],
			characters: [],
			handoutGrants: [],
			presence: [],
		});
		originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/api/v1/version")) {
					return jsonResponse({
						server: {
							version: "0.2.1",
							commit: "abc",
							buildTime: null,
							component: "server",
						},
					});
				}
				if (url.endsWith("/api/v1/rules")) {
					return jsonResponse([
						{
							id: "coc7e",
							name: "克苏鲁的呼唤 7 版",
							version: "2.0.0",
							apiVersion: 1,
							description: "CoC 7e",
							permanentSheetFields: [],
						},
					]);
				}
				if (url.endsWith("/api/v1/pl/invites/tok-1")) {
					return jsonResponse({
						scope: "module",
						targetId: "mod-1",
						targetName: "测试模组",
						ruleId: "coc7e",
						expiresAt: 4102444800000,
						creationOptions: null,
						creationRoll: null,
						ownedCharacters: [],
					});
				}
				if (url.endsWith("/api/v1/gm/modules/mod-1")) {
					return jsonResponse({
						id: "mod-1",
						name: "测试",
						description: "测试",
						ruleId: "coc7e",
						themeId: null,
						createdAt: 1,
						updatedAt: 1,
					});
				}
				if (url.includes("/api/v1/gm/characters/library?")) {
					return jsonResponse({
						items: [
							{
								id: "char-1",
								name: "神秘馆长",
								kind: "npc",
								ruleId: "coc7e",
								ownerId: "gm-1",
								ownerName: "gm",
								ownedByMe: true,
								portraitAssetId: null,
								expressionCount: 0,
								modules: [{ id: "mod-1", name: "测试" }],
								updatedAt: 1,
							},
						],
						total: 1,
						nextCursor: null,
						facets: {
							rules: [{ ruleId: "coc7e", count: 1 }],
							kinds: { pc: 0, npc: 1 },
							owners: { gm: 1, pl: 0 },
							modules: [{ id: "mod-1", name: "测试", count: 1 }],
							unlinked: 0,
						},
					});
				}
				if (
					url.endsWith("/api/v1/gm/characters/char-1") ||
					url.endsWith("/api/v1/pl/characters/char-1")
				) {
					return jsonResponse(characterDetail());
				}
				if (url.includes("/sheet-context")) {
					return jsonResponse({
						companions: [],
						phaseRecords: [],
						growthRecords: [],
					});
				}
				return jsonResponse({ items: [], nextCursor: null });
			}) as typeof fetch,
		});
	});

	afterEach(() => {
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
		usePlayStore.getState().reset();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
	});

	function createTestRouter(
		initialEntry: string,
		options?: { openNpcDialog?: boolean },
	) {
		const ModulePage = ModuleRoute.options.component!;
		const GmCharacterPage = GmCharacterSheetRoute.options.component!;
		const PlCharacterPage = PlCharacterSheetRoute.options.component!;
		const PlCharacterNewPage = PlCharacterNewRoute.options.component!;

		const rootRoute = createRootRoute();
		const gmIndexRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm",
			component: () => createElement("div", { "data-testid": "gm-dashboard" }, "GM 后台"),
		});
		const gmModulesRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm/modules",
			validateSearch: (search: Record<string, unknown>) =>
				parseModulesSearch(search),
			component: () => createElement("div", { "data-testid": "gm-modules" }, "模组管理页"),
		});
		const gmCharactersRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm/characters",
			validateSearch: (search: Record<string, unknown>) =>
				parseLibrarySearch(search),
			component: () => createElement("div", { "data-testid": "gm-characters" }, "人物管理页"),
		});
		const plCharactersRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/pl/characters",
			component: () => createElement("div", { "data-testid": "pl-characters" }, "我的人物页"),
		});
		const submitRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/submit/$token",
			component: () => createElement("div", { "data-testid": "submit-page" }, "提交人物页"),
		});
		const gmSessionRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm/session/$sessionId",
			validateSearch: (search: Record<string, unknown>) =>
				parseBackSearch(search, GM_BACK_PREFIXES),
			component: () =>
				createElement(
					"div",
					{ "data-testid": "gm-session" },
					createElement(GmTopBar),
					createElement(ScenePanel, { onClose: () => undefined }),
					createElement(HandoutPanel, { onClose: () => undefined }),
					options?.openNpcDialog
						? createElement(AddNpcDialog, {
								open: true,
								onOpenChange: () => undefined,
								sessionId: "sess-1",
								moduleId: "mod-1",
								ruleId: "coc7e",
								existingIds: [],
							})
						: null,
				),
		});
		const gmModuleRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm/module/$moduleId",
			validateSearch: (search: Record<string, unknown>) =>
				parseModuleDetailSearch(search),
			component: ModulePage,
		});
		const gmCharacterSheetRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/gm/characters/$characterId",
			validateSearch: (search: Record<string, unknown>) =>
				parseBackSearch(search, GM_BACK_PREFIXES),
			component: GmCharacterPage,
		});
		const plCharacterSheetRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/pl/characters/$characterId",
			validateSearch: (search: Record<string, unknown>) =>
				parseBackSearch(search, PL_BACK_PREFIXES),
			component: PlCharacterPage,
		});
		const plCharacterNewRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/pl/characters/new",
			validateSearch: PlCharacterNewRoute.options.validateSearch,
			beforeLoad: () => ({ userId: "pl-1" }),
			component: PlCharacterNewPage,
		});

		const router = createRouter({
			routeTree: rootRoute.addChildren([
				gmIndexRoute,
				gmModulesRoute,
				gmCharactersRoute,
				plCharactersRoute,
				submitRoute,
				gmSessionRoute,
				gmModuleRoute,
				gmCharacterSheetRoute,
				plCharacterSheetRoute,
				plCharacterNewRoute,
			]),
			history: createMemoryHistory({ initialEntries: [initialEntry] }),
		});

		return {
			router,
			view: render(createElement(RouterProvider, { router })),
		};
	}

	test("entering module from KP workbench ScenePanel shows '< 工作台' and returns to /gm/session/$sessionId", async () => {
		const { router, view } = createTestRouter("/gm/session/sess-1");
		const manageScenes = await view.findByRole("link", {
			name: "管理模组场景",
		});
		fireEvent.click(manageScenes);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/module/mod-1");
			expect(router.state.location.search).toEqual({
				from: "/gm/session/sess-1",
			});
		});

		const backLink = await within(view.container).findByRole("link", {
			name: "工作台",
		});
		expect(backLink.getAttribute("href")).toBe("/gm/session/sess-1");

		// 切换页签时保留来源路由，仍显示「工作台」
		const musicTab = within(view.container).getByRole("tab", {
			name: /音乐/,
		});
		fireEvent.mouseDown(musicTab, { button: 0, ctrlKey: false });
		fireEvent.click(musicTab);
		await waitFor(() =>
			expect(
				within(view.container).getByRole("link", { name: "工作台" }),
			).toBeTruthy(),
		);

		fireEvent.click(
			within(view.container).getByRole("link", { name: "工作台" }),
		);
		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/session/sess-1");
		});
		// 返回到 KP 工作台后，顶栏返回按钮仍回到 GM 后台，不回环到模组页
		const topBarBack = await within(view.container).findByRole("link", {
			name: "返回后台",
		});
		expect(topBarBack.getAttribute("href")).toBe("/gm");
	});

	test("multi-hop workbench -> module characters -> character sheet returns step by step", async () => {
		const { router, view } = createTestRouter("/gm/session/sess-1", {
			openNpcDialog: true,
		});
		const manageCharacters = await within(document.body).findByRole("link", {
			name: "管理模组人物",
		});
		fireEvent.click(manageCharacters);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/module/mod-1");
			expect(router.state.location.search).toEqual({
				tab: "characters",
				from: "/gm/session/sess-1",
			});
		});

		const charLink = await within(view.container).findByRole("link", {
			name: /神秘馆长/,
		});
		fireEvent.click(charLink);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/characters/char-1");
		});

		const backToModule = await within(view.container).findByRole("button", {
			name: "模组详情",
		});
		fireEvent.click(backToModule);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/module/mod-1");
			expect(router.state.location.search).toEqual({
				tab: "characters",
				from: "/gm/session/sess-1",
			});
		});

		const backToWorkbench = await within(view.container).findByRole("link", {
			name: "工作台",
		});
		fireEvent.click(backToWorkbench);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/session/sess-1");
		});
	});

	test("HandoutPanel opens handouts tab and returns to workbench", async () => {
		const { router, view } = createTestRouter("/gm/session/sess-1");
		const manageHandouts = await view.findByRole("link", {
			name: "管理模组情报",
		});
		fireEvent.click(manageHandouts);

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/gm/module/mod-1");
			expect(router.state.location.search).toEqual({
				tab: "handouts",
				from: "/gm/session/sess-1",
			});
		});
		expect(
			await within(view.container).findByRole("link", { name: "工作台" }),
		).toBeTruthy();
	});

	test("module and character pages preserve filtered parent routes and safe fallbacks", async () => {
		const direct = createTestRouter("/gm/module/mod-1");
		const directBack = await within(direct.view.container).findByRole("link", {
			name: "模组管理",
		});
		expect(directBack.getAttribute("href")).toBe("/gm/modules");
		cleanup();

		const fromFilteredModules = createTestRouter(
			"/gm/module/mod-1?from=%2Fgm%2Fmodules%3Frule%3Dcoc7e%26view%3Dledger",
		);
		const modulesBack = await within(
			fromFilteredModules.view.container,
		).findByRole("link", { name: "模组管理" });
		fireEvent.click(modulesBack);
		await waitFor(() => {
			expect(fromFilteredModules.router.state.location.pathname).toBe(
				"/gm/modules",
			);
			expect(
				fromFilteredModules.router.state.location.search as Record<
					string,
					unknown
				>,
			).toEqual({
				rule: "coc7e",
				view: "ledger",
			});
		});
		cleanup();

		const fromDashboard = createTestRouter("/gm/module/mod-1?from=%2Fgm");
		const dashboardBack = await within(
			fromDashboard.view.container,
		).findByRole("link", { name: "团管理" });
		expect(dashboardBack.getAttribute("href")).toBe("/gm");
		fireEvent.click(dashboardBack);
		await waitFor(() => {
			expect(fromDashboard.router.state.location.pathname).toBe("/gm");
		});
		cleanup();

		const fromFilteredChars = createTestRouter(
			"/gm/characters/char-1?from=%2Fgm%2Fcharacters%3Frule%3Dcoc7e%26kind%3Dnpc",
		);
		const charBack = await within(
			fromFilteredChars.view.container,
		).findByRole("button", { name: "人物管理" });
		fireEvent.click(charBack);
		await waitFor(() => {
			expect(fromFilteredChars.router.state.location.pathname).toBe(
				"/gm/characters",
			);
			expect(
				fromFilteredChars.router.state.location.search as Record<
					string,
					unknown
				>,
			).toEqual({
				rule: "coc7e",
				kind: "npc",
			});
		});
		cleanup();

		const plChar = createTestRouter("/pl/characters/char-1");
		const plBack = await within(plChar.view.container).findByRole("button", {
			name: "我的人物",
		});
		fireEvent.click(plBack);
		await waitFor(() => {
			expect(plChar.router.state.location.pathname).toBe("/pl/characters");
		});
		cleanup();

		const plInviteNew = createTestRouter("/pl/characters/new?invite=tok-1");
		const plNewBack = await within(plInviteNew.view.container).findByRole(
			"button",
			{ name: "提交人物" },
		);
		fireEvent.click(plNewBack);
		await waitFor(() => {
			expect(plInviteNew.router.state.location.pathname).toBe("/submit/tok-1");
		});
	});
});
