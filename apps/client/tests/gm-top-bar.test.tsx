import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { PhaseCard } from "../src/features/gm-console/gm-panel-stage";
import { GmTopBar } from "../src/features/gm-console/gm-top-bar";
import { usePlayStore } from "../src/stores/play-store";

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
