import { beforeEach, describe, expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { ConnectionBanner } from "../src/features/play/connection-banner";
import { SessionLoadingTransition } from "../src/features/session-stage/session-loading-transition";
import { usePlayStore } from "../src/stores/play-store";

beforeEach(() => {
	usePlayStore.getState().reset();
});

describe("SessionLoadingTransition", () => {
	test("renders the loading curtain while waiting and cross-fades cleanly into content once ready", async () => {
		const view = render(
			<SessionLoadingTransition
				ready={false}
				variant="console"
				eyebrow="导演工作台"
				title="正在进入导演工作台…"
				description="正在同步场景、立绘与实时状态"
				minHoldMs={10}
				exitMs={40}
				fallbackOverlay={<div data-testid="terminal-fallback">错误兜底</div>}
			>
				<div data-testid="console-content">已载入工作台</div>
			</SessionLoadingTransition>,
		);

		expect(view.getByText("正在进入导演工作台…")).toBeTruthy();
		expect(view.getByText("导演工作台")).toBeTruthy();
		expect(view.queryByTestId("console-content")).toBeNull();
		expect(view.getByTestId("terminal-fallback")).toBeTruthy();
		expect(
			view.container
				.querySelector('[data-slot="session-loading-overlay"]')
				?.getAttribute("data-state"),
		).toBe("loading");

		view.rerender(
			<SessionLoadingTransition
				ready={true}
				variant="console"
				eyebrow="导演工作台"
				title="正在进入导演工作台…"
				description="正在同步场景、立绘与实时状态"
				minHoldMs={10}
				exitMs={40}
				fallbackOverlay={<div data-testid="terminal-fallback">错误兜底</div>}
			>
				<div data-testid="console-content">已载入工作台</div>
			</SessionLoadingTransition>,
		);

		await waitFor(() => {
			expect(view.getByTestId("console-content")).toBeTruthy();
			const overlay = view.container.querySelector(
				'[data-slot="session-loading-overlay"]',
			);
			expect(overlay?.getAttribute("data-state")).toBe("exiting");
			expect(overlay?.className).toContain("pointer-events-none");
			expect(
				view.container
					.querySelector('[data-slot="session-stage-reveal"]')
					?.getAttribute("data-reveal"),
			).toBe("entering");
		});

		await waitFor(() => {
			expect(
				view.container.querySelectorAll('[data-slot="session-loading-overlay"]')
					.length,
			).toBe(0);
		});
		expect(view.getByTestId("console-content")).toBeTruthy();
	});

	test("renders content immediately without a curtain when already ready on mount", () => {
		const view = render(
			<SessionLoadingTransition
				ready={true}
				title="正在进入导演工作台…"
				minHoldMs={200}
				exitMs={300}
			>
				<div data-testid="console-content">已载入工作台</div>
			</SessionLoadingTransition>,
		);

		expect(view.getByTestId("console-content")).toBeTruthy();
		expect(
			view.container.querySelectorAll('[data-slot="session-loading-overlay"]')
				.length,
		).toBe(0);
		expect(
			view.container
				.querySelector('[data-slot="session-stage-reveal"]')
				?.getAttribute("data-reveal"),
		).toBeNull();
	});

	test("yields the loading curtain immediately when suppressed by a terminal error", () => {
		const view = render(
			<SessionLoadingTransition
				ready={false}
				suppressed={true}
				title="正在进入导演工作台…"
				fallbackOverlay={<div data-testid="terminal-overlay">无法连接到团</div>}
			>
				<div data-testid="console-content">已载入工作台</div>
			</SessionLoadingTransition>,
		);

		expect(view.getByTestId("terminal-overlay")).toBeTruthy();
		expect(
			view.container.querySelectorAll('[data-slot="session-loading-overlay"]')
				.length,
		).toBe(0);
		expect(view.queryByTestId("console-content")).toBeNull();
	});

	test("returns to the loading curtain if ready becomes false for a new session", async () => {
		const view = render(
			<SessionLoadingTransition
				ready={true}
				title="正在进入导演工作台…"
				minHoldMs={10}
				exitMs={30}
			>
				<div data-testid="console-content">团 A</div>
			</SessionLoadingTransition>,
		);
		expect(view.getByTestId("console-content")).toBeTruthy();

		view.rerender(
			<SessionLoadingTransition
				ready={false}
				title="正在进入导演工作台…"
				minHoldMs={10}
				exitMs={30}
			>
				<div data-testid="console-content">团 B</div>
			</SessionLoadingTransition>,
		);

		expect(view.queryByTestId("console-content")).toBeNull();
		expect(
			view.container
				.querySelector('[data-slot="session-loading-overlay"]')
				?.getAttribute("data-state"),
		).toBe("loading");
	});
});

describe("ConnectionBanner", () => {
	test("stays hidden during initial connection before snapshot hydration", () => {
		usePlayStore.setState({
			connected: false,
			snapshotReady: false,
			sessionId: null,
			terminal: null,
			status: null,
		});
		const view = render(<ConnectionBanner />);
		expect(view.container.textContent).toBe("");
	});

	test("shows reconnecting notice when an already-hydrated session loses connection", () => {
		usePlayStore.setState({
			connected: false,
			snapshotReady: true,
			sessionId: "session-1",
			terminal: null,
			status: "active",
		});
		const view = render(<ConnectionBanner />);
		expect(view.getByText("连接中断，正在重连…")).toBeTruthy();
	});
});
