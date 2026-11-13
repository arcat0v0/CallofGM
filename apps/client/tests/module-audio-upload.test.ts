import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
import { t } from "../src/i18n";
import { Route as ModuleRoute } from "../src/routes/gm/module.$moduleId";
import { useIdentityStore } from "../src/stores/identity-store";

const root = new URL("../src/", import.meta.url);

async function source(path: string): Promise<string> {
	return Bun.file(new URL(path, root)).text();
}

function renderModulePage() {
	const Page = ModuleRoute.options.component;
	const rootRoute = createRootRoute();
	const moduleRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/gm/module/$moduleId",
		...(Page ? { component: Page } : {}),
	});
	const modulesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/gm/modules",
		component: () => null,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		component: () => null,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([moduleRoute, modulesRoute, loginRoute]),
		history: createMemoryHistory({ initialEntries: ["/gm/module/mod-1"] }),
	});
	return render(createElement(RouterProvider, { router }));
}

describe("GM module audio upload", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		cleanup();
		useIdentityStore.setState({
			account: {
				userId: "gm-1",
				username: "gm",
				role: "gm",
			},
			accountResolved: true,
		});
		originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/api/v1/gm/modules/mod-1")) {
					return new Response(
						JSON.stringify({
							id: "mod-1",
							name: "测试模组",
							description: "",
							ruleId: "coc7e",
							themeId: null,
							createdAt: 1,
							updatedAt: 1,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				return new Response(JSON.stringify({ items: [], nextCursor: null }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
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

	test("advertises the exact supported formats and displays the prepared 10 MB hint", async () => {
		const page = await source("routes/gm/module.$moduleId.tsx");
		expect(page).toContain(
			'accept=".mp3,audio/mpeg,.wav,audio/wav,.ogg,audio/ogg,.flac,audio/flac,.m4a,audio/mp4"',
		);
		expect(page).toContain('t("gm.module.audioFormatHint")');
		expect(t("gm.module.audioFormatHint")).toBe(
			"支持 MP3、WAV、OGG、FLAC、M4A，单个文件不超过 10 MB。",
		);
		expect(page).toContain('name="audio"');
		expect(page).toContain("<FilePicker");
	});

	test("keeps the shared audio FilePicker and its existing accessible label", async () => {
		const page = await source("routes/gm/module.$moduleId.tsx");
		expect(page).toContain('label={t("gm.module.chooseAudio")}');
		expect(page).toContain("<FilePicker");
	});

	test("renders the music upload tab with exact accept list and format/10MB hint", async () => {
		const view = renderModulePage();
		await waitFor(() =>
			expect(
				within(view.container).getAllByText("测试模组").length,
			).toBeGreaterThan(0),
		);
		const musicTab = within(view.container).getByRole("tab", {
			name: /音乐/,
		});
		fireEvent.mouseDown(musicTab, { button: 0, ctrlKey: false });
		fireEvent.click(musicTab);

		await waitFor(() =>
			expect(
				within(view.container).getByText(t("gm.module.audioFormatHint")),
			).toBeTruthy(),
		);
		const audioInput = view.container.querySelector(
			'input[name="audio"]',
		) as HTMLInputElement;
		expect(audioInput).toBeTruthy();
		expect(audioInput.getAttribute("accept")).toBe(
			".mp3,audio/mpeg,.wav,audio/wav,.ogg,audio/ogg,.flac,audio/flac,.m4a,audio/mp4",
		);
		expect(audioInput.getAttribute("aria-label")).toBe(
			t("gm.module.chooseAudio"),
		);
	});
});
