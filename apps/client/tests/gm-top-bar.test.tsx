import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { PhaseCard } from "../src/features/gm-console/gm-panel-stage";
import { GmTopBar } from "../src/features/gm-console/gm-top-bar";
import { usePlayStore } from "../src/stores/play-store";
import {
	computeDockPlacement,
	DOCK_TOPBAR_CLEARANCE,
	GmConsoleLayout,
	MIN_TOPBAR_START_WIDTH,
} from "../src/themes/default/slots/gm-console-layout";

function renderInConsoleRoute(
	component: () => React.ReactNode,
	sessionId = "s-top-bar",
) {
	const root = createRootRoute();
	const route = createRoute({
		getParentRoute: () => root,
		path: "/gm/session/$sessionId",
		component,
	});
	const router = createRouter({
		routeTree: root.addChildren([route]),
		history: createMemoryHistory({
			initialEntries: [`/gm/session/${sessionId}`],
		}),
	});
	return render(<RouterProvider router={router} />);
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		sessionId: "s-top-bar",
		moduleId: "m-1",
		moduleName: "死光",
		sessionName: "11",
		ruleId: "coc7e",
		status: "waiting",
		phase: "free_discussion",
		presenceAvailable: true,
	});
});

afterEach(() => {
	usePlayStore.getState().reset();
});

describe("GmTopBar session status control", () => {
	test("exposes an interactive status trigger and advances from waiting to preparing", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			if (url.endsWith("/api/v1/version")) {
				return jsonResponse({
					server: { version: "0.2.1", commit: "abc", buildTime: null, component: "server" },
				});
			}
			const parsed = init?.body ? JSON.parse(String(init.body)) : null;
			calls.push({ url, body: parsed });
			return jsonResponse({
				id: "s-top-bar",
				moduleId: "m-1",
				name: "11",
				ruleId: "coc7e",
				status: (parsed as { status: string }).status,
				phase: "free_discussion",
				createdAt: 1,
			});
		}) as unknown as typeof fetch);

		try {
			const view = renderInConsoleRoute(() => <GmTopBar />);
			const trigger = await view.findByRole("button", {
				name: "团状态：等待开始，点击切换",
			});
			fireEvent.click(trigger);

			const endedButton = await view.findByRole("button", { name: /已结团/ });
			expect((endedButton as HTMLButtonElement).disabled).toBe(true);

			const preparingButton = view.getByRole("button", { name: /准备中/ });
			expect((preparingButton as HTMLButtonElement).disabled).toBe(false);
			fireEvent.click(preparingButton);

			await waitFor(() => {
				expect(calls).toEqual([
					{
						url: "/api/v1/gm/sessions/s-top-bar/status",
						body: { status: "preparing" },
					},
				]);
				expect(usePlayStore.getState().status).toBe("preparing");
			});
			expect(
				await view.findByRole("button", { name: "团状态：准备中，点击切换" }),
			).toBeTruthy();
		} finally {
			fetcher.mockRestore();
		}
	});

	test("steps from waiting through preparing when directly starting active session", async () => {
		const statuses: string[] = [];
		const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			if (url.endsWith("/api/v1/version")) {
				return jsonResponse({
					server: { version: "0.2.1", commit: "abc", buildTime: null, component: "server" },
				});
			}
			const body = JSON.parse(String(init?.body ?? "{}")) as { status: string };
			statuses.push(body.status);
			return jsonResponse({
				id: "s-top-bar",
				moduleId: "m-1",
				name: "11",
				ruleId: "coc7e",
				status: body.status,
				phase: "free_discussion",
				createdAt: 1,
			});
		}) as unknown as typeof fetch);

		try {
			const view = renderInConsoleRoute(() => <GmTopBar />);
			const trigger = await view.findByRole("button", {
				name: "团状态：等待开始，点击切换",
			});
			fireEvent.click(trigger);

			const activeButton = await view.findByRole("button", { name: /进行中/ });
			fireEvent.click(activeButton);

			await waitFor(() => {
				expect(statuses).toEqual(["preparing", "active"]);
				expect(usePlayStore.getState().status).toBe("active");
			});
		} finally {
			fetcher.mockRestore();
		}
	});

	test("requires confirmation before ending an active session and locks ended badge", async () => {
		usePlayStore.setState({ status: "active" });
		const statuses: string[] = [];
		const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			if (url.endsWith("/api/v1/version")) {
				return jsonResponse({
					server: { version: "0.2.1", commit: "abc", buildTime: null, component: "server" },
				});
			}
			const body = JSON.parse(String(init?.body ?? "{}")) as { status: string };
			statuses.push(body.status);
			return jsonResponse({
				id: "s-top-bar",
				moduleId: "m-1",
				name: "11",
				ruleId: "coc7e",
				status: body.status,
				phase: "free_discussion",
				createdAt: 1,
			});
		}) as unknown as typeof fetch);

		try {
			const view = renderInConsoleRoute(() => <GmTopBar />);
			const trigger = await view.findByRole("button", {
				name: "团状态：进行中，点击切换",
			});
			fireEvent.click(trigger);

			const endOption = await view.findByRole("button", { name: /已结团/ });
			fireEvent.click(endOption);

			expect(await view.findByText("确认结团？")).toBeTruthy();
			expect(statuses).toEqual([]);

			fireEvent.click(view.getByRole("button", { name: "确认结团" }));
			await waitFor(() => {
				expect(statuses).toEqual(["ended"]);
				expect(usePlayStore.getState().status).toBe("ended");
			});
			expect(
				view.queryByRole("button", { name: /团状态：/ }),
			).toBeNull();
			expect(view.getByText("已结团")).toBeTruthy();
		} finally {
			fetcher.mockRestore();
		}
	});
});

describe("PhaseCard session status guard", () => {
	test("explains and disables phase changes while session is not active", async () => {
		usePlayStore.setState({ status: "waiting", phase: "free_discussion" });
		const view = renderInConsoleRoute(() => <PhaseCard />);
		const trigger = await view.findByRole("button", {
			name: /团内阶段/,
		});
		expect(view.getByText("仅「进行中」可切换团内阶段")).toBeTruthy();
		fireEvent.click(trigger);

		expect(
			await view.findByText(
				"当前团状态为「等待开始」，请在顶部栏将团状态切换为「进行中」后再调整团内阶段。",
			),
		).toBeTruthy();
		const option = view.getByRole("button", { name: /演绎时间/ });
		expect((option as HTMLButtonElement).disabled).toBe(true);
	});
});

describe("GmTopBar layout cleanup and dock collision guard", () => {
	test("omits the decorative KP avatar, keeps VersionBadge, and hides trigger title while status popover is open", async () => {
		const view = renderInConsoleRoute(() => <GmTopBar />);
		const trigger = await view.findByRole("button", {
			name: "团状态：等待开始，点击切换",
		});

		expect(view.queryByText("KP")).toBeNull();
		expect(view.getByRole("button", { name: /^v/ })).toBeTruthy();
		expect(trigger.getAttribute("title")).toBe("团状态");

		fireEvent.click(trigger);
		await view.findByRole("button", { name: /准备中/ });
		expect(trigger.getAttribute("title")).toBeNull();
	});

	test("computeDockPlacement keeps dock on row 1 when clear and stacks on row 2 before any collision", () => {
		expect(
			computeDockPlacement({
				containerWidth: 0,
				topbarLeft: 0,
				topbarWidth: 0,
				dockWidth: 0,
				endWidth: 0,
				hasStart: true,
			}),
		).toEqual({ stacked: null, startMaxWidth: null });

		// 1440px viewport with compact labeled dock (430px) and right cluster without KP (432px)
		const fits1440 = computeDockPlacement({
			containerWidth: 1440,
			topbarLeft: 24,
			topbarWidth: 1392,
			dockWidth: 430,
			endWidth: 432,
			hasStart: true,
		});
		expect(fits1440).toEqual({
			stacked: false,
			startMaxWidth: 1440 / 2 - 430 / 2 - DOCK_TOPBAR_CLEARANCE - 24,
		});

		// Future topbar expansion (endWidth grows to 520px at 1440px): stacks onto row 2 instead of covering status control
		expect(
			computeDockPlacement({
				containerWidth: 1440,
				topbarLeft: 24,
				topbarWidth: 1392,
				dockWidth: 430,
				endWidth: 520,
				hasStart: true,
			}),
		).toEqual({ stacked: true, startMaxWidth: null });

		// Below lg breakpoint (< 1024px), dock renders in mobile flex flow rather than overlaying topbar
		expect(
			computeDockPlacement({
				containerWidth: 768,
				topbarLeft: 12,
				topbarWidth: 744,
				dockWidth: 274,
				endWidth: 320,
				hasStart: true,
			}),
		).toEqual({ stacked: null, startMaxWidth: null });

		// Narrow lg viewport where left title clearance falls below minimum
		expect(
			computeDockPlacement({
				containerWidth: 1080,
				topbarLeft: 24,
				topbarWidth: 1032,
				dockWidth: 680,
				endWidth: 200,
				hasStart: true,
			}),
		).toEqual({ stacked: true, startMaxWidth: null });
		expect(MIN_TOPBAR_START_WIDTH).toBe(160);
	});

	test("GmConsoleLayout reacts to ResizeObserver changes and drops dock to top-24 when right cluster would collide", async () => {
		const originalResizeObserver = globalThis.ResizeObserver;
		const originalGetBcr = HTMLElement.prototype.getBoundingClientRect;
		const callbacks = new Set<ResizeObserverCallback>();
		let containerWidth = 1560;
		let endWidth = 420;
		let dockWidth = 430;

		class MockResizeObserver {
			private callback: ResizeObserverCallback;
			constructor(callback: ResizeObserverCallback) {
				this.callback = callback;
				callbacks.add(callback);
			}
			observe() {}
			unobserve() {}
			disconnect() {
				callbacks.delete(this.callback);
			}
		}

		globalThis.ResizeObserver =
			MockResizeObserver as unknown as typeof ResizeObserver;
		HTMLElement.prototype.getBoundingClientRect = function mockRect() {
			if (this.hasAttribute("data-topbar-end")) {
				return new DOMRect(containerWidth - 24 - endWidth, 20, endWidth, 40);
			}
			if (this.getAttribute("role") === "toolbar") {
				return new DOMRect((containerWidth - dockWidth) / 2, 20, dockWidth, 52);
			}
			if (this.dataset.slot === "gm-console-root" || this.className.includes("overflow-hidden")) {
				return new DOMRect(0, 0, containerWidth, 900);
			}
			if (this.className.includes("inset-x-6")) {
				return new DOMRect(24, 20, containerWidth - 48, 64);
			}
			return new DOMRect(0, 0, 160, 40);
		};

		try {
			const view = render(
				<GmConsoleLayout
					nodes={{
						topbar: (
							<div className="flex h-16 items-center justify-between gap-4">
								<div data-topbar-start="">标题</div>
								<div data-topbar-end="">状态按钮组</div>
							</div>
						),
						dock: <div role="toolbar">工具栏</div>,
						controls: <div />,
						stage: <div />,
						chat: <div />,
						overlays: null,
						connection: null,
						endedBanner: null,
					}}
					view={{ sessionId: "s-top-bar", status: "active" }}
				/>,
			);

			const root = view.container.firstElementChild as HTMLElement;
			const dockEl = view.getByRole("toolbar");
			const dockWrap = dockEl.parentElement as HTMLElement;

			expect(root.getAttribute("data-dock-stacked")).toBeNull();
			expect(dockWrap.className).toContain("lg:top-5");
			expect(root.style.getPropertyValue("--gm-dock-panel-max-h")).toBe(
				"calc(100dvh - 112px)",
			);

			// Simulate future growth in right-side topbar controls causing overlap at center
			endWidth = 580;
			act(() => {
				for (const cb of callbacks) {
					cb([], {} as ResizeObserver);
				}
			});

			await waitFor(() => {
				expect(root.getAttribute("data-dock-stacked")).toBe("true");
				expect(dockWrap.className).toContain("lg:top-24");
				expect(root.style.getPropertyValue("--gm-topbar-start-max")).toBe(
					"none",
				);
				expect(root.style.getPropertyValue("--gm-dock-panel-max-h")).toBe(
					"calc(100dvh - 176px)",
				);
			});

			// Simulate wider viewport restoring room on row 1
			containerWidth = 1920;
			dockWidth = 430;
			act(() => {
				for (const cb of callbacks) {
					cb([], {} as ResizeObserver);
				}
			});

			await waitFor(() => {
				expect(root.getAttribute("data-dock-stacked")).toBeNull();
				expect(dockWrap.className).toContain("lg:top-5");
			});
		} finally {
			globalThis.ResizeObserver = originalResizeObserver;
			HTMLElement.prototype.getBoundingClientRect = originalGetBcr;
		}
	});
});
