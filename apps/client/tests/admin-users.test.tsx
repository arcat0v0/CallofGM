import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { UserDto } from "@cogm/shared";
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
import { Route as AdminUsersRoute } from "../src/routes/admin/users";
import { useIdentityStore } from "../src/stores/identity-store";

type FetchCall = {
	url: string;
	method: string;
	body: unknown;
};

const sampleUsers: UserDto[] = [
	{
		id: "user-admin",
		username: "admin",
		role: "admin",
		disabledAt: null,
		deletedAt: null,
		createdAt: 1,
		updatedAt: 1,
	},
	{
		id: "user-enabled",
		username: "alice",
		role: "pl",
		disabledAt: null,
		deletedAt: null,
		createdAt: 2,
		updatedAt: 2,
	},
	{
		id: "user-disabled",
		username: "bob",
		role: "gm",
		disabledAt: 100,
		deletedAt: null,
		createdAt: 3,
		updatedAt: 3,
	},
];

function renderAdminUsersPage() {
	const rootRoute = createRootRoute();
	const usersRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/users",
		component: AdminUsersRoute.options.component,
	});
	const themesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/themes",
		component: () => null,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		component: () => null,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([usersRoute, themesRoute, loginRoute]),
		history: createMemoryHistory({ initialEntries: ["/admin/users"] }),
	});
	return render(<RouterProvider router={router} />);
}

function openActionsMenu(view: ReturnType<typeof render>, username: string) {
	const trigger = within(view.container).getByRole("button", {
		name: `账号操作 ${username}`,
	});
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

describe("AdminUsersPage", () => {
	let originalFetch: typeof fetch;
	let calls: FetchCall[];

	beforeEach(() => {
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
		useIdentityStore.setState({
			account: {
				userId: "user-admin",
				username: "admin",
				role: "admin",
			},
			accountResolved: true,
		});
		calls = [];
		originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? "GET";
				const body = init?.body ? JSON.parse(String(init.body)) : null;
				calls.push({ url, method, body });
				if (url.includes("/api/v1/admin/users?includeDeleted=true")) {
					return new Response(JSON.stringify({ items: sampleUsers }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				if (method === "PATCH" && url.includes("/api/v1/admin/users/")) {
					const userId = url.split("/").at(-1) ?? "";
					const found =
						sampleUsers.find((u) => u.id === userId) ?? sampleUsers[1];
					return new Response(
						JSON.stringify({
							user: found,
							sessionsRevoked: true,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}
				return new Response(JSON.stringify({}), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as typeof fetch,
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
	});

	test("shows visible password hints in create and reset password dialogs", async () => {
		const view = renderAdminUsersPage();
		await waitFor(() =>
			expect(within(view.container).getByText("alice")).toBeTruthy(),
		);

		fireEvent.click(
			within(view.container).getByRole("button", { name: "新建账号" }),
		);
		await waitFor(() =>
			expect(
				within(document.body).getByText("密码需为 8–128 个字符"),
			).toBeTruthy(),
		);
		fireEvent.keyDown(document.body, { key: "Escape" });

		openActionsMenu(view, "alice");
		const resetItem = await within(document.body).findByRole("menuitem", {
			name: "重置密码",
		});
		fireEvent.click(resetItem);
		await waitFor(() =>
			expect(
				within(document.body).getByText("密码需为 8–128 个字符"),
			).toBeTruthy(),
		);
	});

	test("disable opens ConfirmDialog, cancel sends no PATCH, confirm sends exactly one; re-enable remains immediate", async () => {
		const view = renderAdminUsersPage();
		await waitFor(() =>
			expect(within(view.container).getByText("alice")).toBeTruthy(),
		);

		openActionsMenu(view, "alice");
		const disableItem = await within(document.body).findByRole("menuitem", {
			name: "禁用",
		});
		fireEvent.click(disableItem);

		await waitFor(() =>
			expect(within(document.body).getByText("禁用账号 alice？")).toBeTruthy(),
		);
		expect(
			within(document.body).getByText(
				"禁用后该账号将立即退出登录且无法再次登录，之后仍可重新启用。",
			),
		).toBeTruthy();

		const patchesBeforeCancel = calls.filter((call) => call.method === "PATCH");
		expect(patchesBeforeCancel).toHaveLength(0);

		fireEvent.click(
			within(document.body).getByRole("button", { name: "取消" }),
		);
		await waitFor(() =>
			expect(within(document.body).queryByText("禁用账号 alice？")).toBeNull(),
		);
		expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(0);

		openActionsMenu(view, "alice");
		const disableItemAgain = await within(document.body).findByRole(
			"menuitem",
			{ name: "禁用" },
		);
		fireEvent.click(disableItemAgain);
		const confirmButton = await within(document.body).findByRole("button", {
			name: "禁用账号",
		});
		fireEvent.click(confirmButton);

		await waitFor(() =>
			expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1),
		);
		const disablePatch = calls.find((call) => call.method === "PATCH");
		expect(disablePatch?.url).toBe("/api/v1/admin/users/user-enabled");
		expect(disablePatch?.body).toEqual({ disabled: true });

		openActionsMenu(view, "bob");
		const enableItem = await within(document.body).findByRole("menuitem", {
			name: "启用",
		});
		fireEvent.click(enableItem);

		await waitFor(() =>
			expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(2),
		);
		const enablePatch = calls.filter((call) => call.method === "PATCH").at(-1);
		expect(enablePatch?.url).toBe("/api/v1/admin/users/user-disabled");
		expect(enablePatch?.body).toEqual({ disabled: false });
	});
});
