import { afterEach, expect, mock, test } from "bun:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { SessionTerminalOverlay } from "../src/features/play/session-terminal-overlay";
import { usePlayStore } from "../src/stores/play-store";

afterEach(() => {
	usePlayStore.getState().reset();
});

test("login expiration offers login navigation without a connection retry", async () => {
	const onRetry = mock(() => {});
	const root = createRootRoute();
	const play = createRoute({
		getParentRoute: () => root,
		path: "/play/$sessionId",
		component: () => (
			<SessionTerminalOverlay sessionId="session-1" onRetry={onRetry} />
		),
	});
	const login = createRoute({
		getParentRoute: () => root,
		path: "/login",
		component: () => <h1>登录页</h1>,
	});
	const router = createRouter({
		routeTree: root.addChildren([play, login]),
		history: createMemoryHistory({ initialEntries: ["/play/session-1"] }),
	});
	usePlayStore.getState().setTerminal("loginExpired");
	const view = render(<RouterProvider router={router} />);

	const loginButton = await view.findByRole("button", { name: "去登录" });
	expect(view.getByRole("heading", { name: "登录已失效" })).toBeTruthy();
	expect(view.queryByRole("button", { name: "重试连接" })).toBeNull();
	fireEvent.click(loginButton);
	await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
	expect(view.getByRole("heading", { name: "登录页" })).toBeTruthy();
	expect(onRetry).not.toHaveBeenCalled();
});
