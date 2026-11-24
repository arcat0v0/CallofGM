import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AdminSiteSettingsResponse } from "@cogm/shared";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Route as AdminSettingsRoute } from "../src/routes/admin/settings";
import { useIdentityStore } from "../src/stores/identity-store";

interface FetchCall {
	url: string;
	method?: string;
	body?: string;
}

const SAMPLE_SETTINGS: AdminSiteSettingsResponse = {
	storage: {
		mode: "local",
		maxMediaUploadMb: 100,
		maxThemeUploadMb: 50,
		s3: {
			endpoint: "",
			publicUploadEndpoint: "",
			region: "us-east-1",
			bucket: "",
			forcePathStyle: false,
			keyPrefix: "",
			accessKeyId: "",
			hasSecretAccessKey: false,
			secretAccessKeyMask: null,
			downloadBaseUrl: "",
			accessMode: "public",
			signedUrlTtlSeconds: 600,
		},
	},
	voice: {
		maxParticipants: 8,
		stunUrls: [],
		turnUrls: [],
		hasTurnRestSecret: false,
		turnRestSecretMask: null,
		turnTtlSeconds: 600,
	},
	security: {
		trustProxy: false,
		corsOrigins: [],
		rateLimits: {
			login: { limit: 10, windowSeconds: 60 },
			identity: { limit: 60, windowSeconds: 60 },
			join: { limit: 30, windowSeconds: 60 },
			sessionReference: { limit: 30, windowSeconds: 60 },
			upload: { limit: 20, windowSeconds: 60 },
		},
	},
	ui: {
		gmThemeId: null,
	},
	system: {
		host: "0.0.0.0",
		port: 15632,
		environment: "production",
		databaseUrl: "/app/data/db.sqlite",
		backupDir: null,
		mediaDir: "/app/data/media",
		themesDir: "/app/data/themes",
		secretsEncryptionSource: "keyfile",
		version: "0.2.3",
		commit: "abc1234",
		buildTime: "2026-11-24T00:00:00Z",
	},
	overriddenSections: [],
	updatedAt: null,
};

function renderAdminSettingsPage() {
	const rootRoute = createRootRoute();
	const usersRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/users",
		component: () => null,
	});
	const themesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/themes",
		component: () => null,
	});
	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/settings",
		component: AdminSettingsRoute.options.component,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		component: () => null,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			usersRoute,
			themesRoute,
			settingsRoute,
			loginRoute,
		]),
		history: createMemoryHistory({ initialEntries: ["/admin/settings"] }),
	});
	return render(<RouterProvider router={router} />);
}

describe("AdminSettingsPage", () => {
	let originalFetch: typeof fetch;
	let calls: FetchCall[];

	beforeEach(() => {
		cleanup();
		document.body.innerHTML = "";
		originalFetch = globalThis.fetch;
		calls = [];
		useIdentityStore.setState({
			account: { userId: "admin-1", username: "admin", role: "admin" },
			accountResolved: true,
		});

		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				const method = init?.method ?? "GET";
				const body = typeof init?.body === "string" ? init.body : undefined;
				calls.push({ url: target, method, body });

				if (target.endsWith("/api/v1/admin/settings") && method === "GET") {
					return new Response(JSON.stringify(SAMPLE_SETTINGS), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				if (target.endsWith("/api/v1/admin/settings") && method === "PUT") {
					const patch = JSON.parse(body ?? "{}");
					return new Response(
						JSON.stringify({
							...SAMPLE_SETTINGS,
							storage: {
								...SAMPLE_SETTINGS.storage,
								...(patch.storage ?? {}),
								s3: {
									...SAMPLE_SETTINGS.storage.s3,
									...(patch.storage?.s3 ?? {}),
									hasSecretAccessKey: true,
									secretAccessKeyMask: "****5678",
								},
							},
							overriddenSections: ["storage"],
							updatedAt: Date.now(),
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				if (target.endsWith("/api/v1/admin/themes")) {
					return new Response(JSON.stringify({ items: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				if (target.endsWith("/api/v1/admin/settings/storage/migrate")) {
					return new Response(
						JSON.stringify({
							status: "idle",
							jobId: null,
							startedAt: null,
							finishedAt: null,
							media: { total: 0, migrated: 0, skipped: 0, failed: 0 },
							themes: { total: 0, migrated: 0, skipped: 0, failed: 0 },
							errors: [],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				return new Response(null, { status: 204 });
			}) as typeof fetch,
		});
	});

	afterEach(() => {
		cleanup();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
	});

	function typeValue(element: HTMLElement, value: string) {
		fireEvent.focusIn(element);
		const setter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		setter?.call(element, value);
		fireEvent.input(element, { target: { value } });
		fireEvent.keyUp(element);
	}

	test("renders storage settings form, shows unsaved state in sticky action bar, submits updated OSS config, and displays masked secret after save", async () => {
		const view = renderAdminSettingsPage();
		await waitFor(() =>
			expect(view.getByLabelText("服务端 Endpoint")).toBeTruthy(),
		);

		typeValue(
			view.getByLabelText("服务端 Endpoint"),
			"https://oss-cn-hangzhou.aliyuncs.com",
		);
		typeValue(view.getByLabelText("Bucket 名称"), "my-bucket");
		typeValue(view.getByLabelText("AccessKey ID"), "ak-123");
		typeValue(view.getByLabelText("SecretAccessKey"), "sk-12345678");
		typeValue(view.getByLabelText("指定下载域名"), "https://cdn.example.com");

		expect(view.getAllByText("有未保存更改").length).toBeGreaterThan(0);

		const form = view.getByLabelText("服务端 Endpoint").closest("form");
		if (!form) {
			throw new Error("Expected storage settings form");
		}
		const actionBar = form.querySelector('[data-slot="settings-action-bar"]');
		expect(actionBar).not.toBeNull();
		fireEvent.submit(form);
		await waitFor(() => {
			expect(
				calls.find(
					(c) => c.url === "/api/v1/admin/settings" && c.method === "PUT",
				)?.body,
			).toContain("https://cdn.example.com");
		});
		await waitFor(() => {
			expect(view.getByText(/已加密保存 \(\*\*\*\*5678\)/)).toBeTruthy();
		});
		await waitFor(() => {
			expect(view.queryByText("放弃更改")).toBeNull();
		});
	});

	test("discards unsaved storage edits and validates invalid URLs / incomplete S3 fields inline", async () => {
		const view = renderAdminSettingsPage();
		await waitFor(() =>
			expect(view.getByLabelText("服务端 Endpoint")).toBeTruthy(),
		);

		const endpointInput = view.getByLabelText(
			"服务端 Endpoint",
		) as HTMLInputElement;
		typeValue(endpointInput, "oss-cn-hangzhou.aliyuncs.com");

		const form = endpointInput.closest("form");
		if (!form) {
			throw new Error("Expected storage settings form");
		}
		fireEvent.submit(form);

		await waitFor(() => {
			expect(
				view.getByText("请输入以 http:// 或 https:// 开头的完整地址"),
			).toBeTruthy();
		});
		expect(
			calls.filter(
				(c) => c.url === "/api/v1/admin/settings" && c.method === "PUT",
			),
		).toHaveLength(0);

		// Testing connection with incomplete S3 fields shows required errors inline
		fireEvent.click(view.getByRole("button", { name: "测试连接与直传" }));
		await waitFor(() => {
			expect(
				view.getAllByText("启用 S3 模式或测试连接时必须填写此项").length,
			).toBeGreaterThanOrEqual(4);
		});
		expect(
			calls.filter((c) => c.url === "/api/v1/admin/settings/storage/test"),
		).toHaveLength(0);

		// Discard reverts draft edits and clears errors
		const discardBtn = form?.querySelector("button");
		expect(discardBtn).not.toBeNull();
		fireEvent.click(view.getByRole("button", { name: "放弃更改" }));
		await waitFor(() => {
			expect(endpointInput.value).toBe("");
			expect(
				view.queryByText("请输入以 http:// 或 https:// 开头的完整地址"),
			).toBeNull();
		});
	});

	test("preserves unsaved S3 inputs when switching tabs", async () => {
		const view = renderAdminSettingsPage();
		await waitFor(() =>
			expect(view.getByLabelText("服务端 Endpoint")).toBeTruthy(),
		);

		const endpointInput = view.getByLabelText(
			"服务端 Endpoint",
		) as HTMLInputElement;
		typeValue(endpointInput, "https://oss-cn-shanghai.aliyuncs.com");

		fireEvent.mouseDown(view.getByRole("tab", { name: /系统信息/ }));
		fireEvent.click(view.getByRole("tab", { name: /系统信息/ }));
		fireEvent.mouseDown(view.getByRole("tab", { name: /存储与 OSS/ }));
		fireEvent.click(view.getByRole("tab", { name: /存储与 OSS/ }));

		expect(
			(view.getByLabelText("服务端 Endpoint") as HTMLInputElement).value,
		).toBe("https://oss-cn-shanghai.aliyuncs.com");
	});
});
