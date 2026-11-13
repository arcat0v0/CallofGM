import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { CharacterInviteDto } from "@cogm/shared";
import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import { InviteLinksDialog } from "../src/features/gm-admin/invite-links-dialog";
import { t } from "../src/i18n";
import { formatStamp } from "../src/lib/format";

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ORIGIN = location.origin;

type Call = { url: string; method: string; body: unknown };

type InviteApi = ReturnType<typeof createInviteApi>;

type View = ReturnType<typeof render>;

function inviteRow(
	overrides: Partial<CharacterInviteDto> = {},
): CharacterInviteDto {
	return {
		id: "invite-old",
		scope: "module",
		targetId: "module-1",
		targetName: "测试模组",
		token: null,
		expiresAt: NOW + 7 * DAY,
		revokedAt: null,
		createdAt: NOW - 1_000,
		...overrides,
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function flushAsync() {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function createInviteApi(initialRows: CharacterInviteDto[] = []) {
	const state = {
		rows: [...initialRows],
		calls: [] as Call[],
		getCalls: 0,
		postCount: 0,
		failNextGets: 0,
		postResponses: [] as CharacterInviteDto[],
		getQueue: [] as Array<() => Promise<Response>>,
		postQueue: [] as Array<() => Promise<Response>>,
		deleteQueue: [] as Array<() => Promise<Response>>,
	};
	const fetchStub = (async (url: string | URL, init?: RequestInit) => {
		const target = String(url);
		const method = init?.method ?? "GET";
		state.calls.push({ url: target, method, body: init?.body });
		if (target === "/api/v1/gm/invites" && method === "POST") {
			const queued = state.postQueue.shift();
			if (queued) {
				state.postCount += 1;
				return queued();
			}
			const body = JSON.parse(String(init?.body)) as {
				scope: "module" | "session";
				targetId: string;
				expiresInDays: number;
			};
			state.postCount += 1;
			const created = inviteRow({
				id: `invite-new-${state.postCount}`,
				scope: body.scope,
				targetId: body.targetId,
				targetName: null,
				token: `fresh-token-${state.postCount}`,
				createdAt: NOW + state.postCount,
			});
			state.postResponses.push(created);
			state.rows.unshift({ ...created, token: null });
			return jsonResponse(created);
		}
		if (target === "/api/v1/gm/invites" && method === "GET") {
			state.getCalls += 1;
			const queued = state.getQueue.shift();
			if (queued) {
				return queued();
			}
			if (state.failNextGets > 0) {
				state.failNextGets -= 1;
				return jsonResponse(
					{ code: "INTERNAL_SERVER_ERROR", message: "刷新失败" },
					500,
				);
			}
			return jsonResponse({
				items: state.rows.map((row) => ({ ...row, token: null })),
			});
		}
		if (target.startsWith("/api/v1/gm/invites/") && method === "DELETE") {
			const queued = state.deleteQueue.shift();
			if (queued) {
				return queued();
			}
			const id = target.slice("/api/v1/gm/invites/".length);
			state.rows = state.rows.map((row) =>
				row.id === id ? { ...row, revokedAt: NOW + 100 } : row,
			);
			return jsonResponse({ success: true });
		}
		return new Response(null, { status: 204 });
	}) as typeof fetch;
	return { state, fetchStub };
}

function Harness() {
	const [open, setOpen] = useState(true);
	const [scope, setScope] = useState<"module" | "session">("module");
	const [targetId, setTargetId] = useState("module-1");
	return (
		<div>
			<button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
				Reopen
			</button>
			<button
				type="button"
				data-testid="target-2"
				onClick={() => setTargetId("module-2")}
			>
				Target 2
			</button>
			<button
				type="button"
				data-testid="scope-session"
				onClick={() => {
					setScope("session");
					setTargetId("session-1");
				}}
			>
				Session scope
			</button>
			<InviteLinksDialog
				open={open}
				onOpenChange={setOpen}
				scope={scope}
				targetId={targetId}
				targetName="测试模组"
			/>
		</div>
	);
}

let originalFetch: typeof fetch;
let originalClipboard: PropertyDescriptor | undefined;
let clipboardWrites: string[];
let errorCalls: number;
let toastSpies: Array<{ mockRestore: () => void }>;

function installApi(api: InviteApi): void {
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		writable: true,
		value: api.fetchStub,
	});
}

async function waitForGetCount(api: InviteApi, count: number): Promise<void> {
	await waitFor(() => expect(api.state.getCalls).toBeGreaterThanOrEqual(count));
}

function createButton(): HTMLButtonElement {
	return within(document.body).getByRole("button", {
		name: "生成链接",
	}) as HTMLButtonElement;
}

function rowForUrl(url: string): HTMLElement {
	const input = within(document.body).getByDisplayValue(url);
	const row = input.closest("[data-invite-id]");
	expect(row).not.toBeNull();
	return row as HTMLElement;
}

function clickTestId(view: View, id: string): void {
	const button = view.container.querySelector(`[data-testid="${id}"]`);
	expect(button).not.toBeNull();
	fireEvent.click(button as Element);
}

async function createFirstLink(api: InviteApi): Promise<string> {
	await waitForGetCount(api, 1);
	fireEvent.click(createButton());
	await waitFor(() => expect(api.state.postCount).toBe(1));
	await waitForGetCount(api, 2);
	const url = `${ORIGIN}/submit/fresh-token-1`;
	await waitFor(() =>
		expect(within(document.body).getByDisplayValue(url)).toBeTruthy(),
	);
	return url;
}

describe("InviteLinksDialog fresh tokens", () => {
	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
		clipboardWrites = [];
		errorCalls = 0;
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					clipboardWrites.push(text);
				},
			},
		});
		toastSpies = [
			spyOn(toast, "success").mockImplementation(() => "toast-id"),
			spyOn(toast, "error").mockImplementation(() => {
				errorCalls += 1;
				return "toast-id";
			}),
		];
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
		document.body.innerHTML = "";
	});

	afterEach(() => {
		for (const spy of toastSpies) {
			spy.mockRestore();
		}
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
		if (originalClipboard) {
			Object.defineProperty(navigator, "clipboard", originalClipboard);
		} else {
			Reflect.deleteProperty(navigator, "clipboard");
		}
		cleanup();
		document.body.innerHTML = "";
	});

	test("historical rows show status and expiry metadata without a blank input or copy action", async () => {
		const valid = inviteRow({ id: "invite-valid" });
		const revoked = inviteRow({
			id: "invite-revoked",
			revokedAt: NOW - 500,
		});
		const expired = inviteRow({
			id: "invite-expired",
			expiresAt: NOW - 1_000,
		});
		const api = createInviteApi([valid, revoked, expired]);
		installApi(api);
		const view = render(<Harness />);

		await waitFor(() =>
			expect(within(document.body).getByText("有效")).toBeTruthy(),
		);
		expect(within(document.body).getByText("已撤销")).toBeTruthy();
		expect(within(document.body).getByText("已过期")).toBeTruthy();
		expect(
			within(document.body).getAllByText(
				t("gm.invites.expiry", { date: formatStamp(valid.expiresAt) }),
			),
		).toHaveLength(2);
		expect(
			within(document.body).getByText(
				t("gm.invites.expiry", { date: formatStamp(expired.expiresAt) }),
			),
		).toBeTruthy();
		expect(
			within(document.body).getAllByText(t("gm.invites.historicalHint")),
		).toHaveLength(3);
		expect(within(document.body).queryAllByRole("textbox")).toHaveLength(0);
		expect(
			within(document.body).queryAllByRole("button", { name: "复制链接" }),
		).toHaveLength(0);
		expect(
			within(document.body).getAllByRole("button", { name: "撤销链接" }),
		).toHaveLength(3);
		view.unmount();
	});

	test("keeps the issued token after the list reload returns token:null and copies the exact URL", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const url = await createFirstLink(api);

		expect(api.state.calls.map((call) => call.method)).toEqual([
			"GET",
			"POST",
			"GET",
		]);
		expect(api.state.rows[0]?.token).toBeNull();
		expect(
			within(document.body).getByText(t("gm.invites.createdHint")),
		).toBeTruthy();
		expect(
			within(document.body).getAllByRole("button", { name: "复制链接" }),
		).toHaveLength(1);
		fireEvent.click(
			within(rowForUrl(url)).getByRole("button", { name: "复制链接" }),
		);
		await waitFor(() => expect(clipboardWrites).toEqual([url]));
		view.unmount();
	});

	test("keeps both links created in one open dialog copyable after later list reloads", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const firstUrl = await createFirstLink(api);
		await waitFor(() => expect(createButton().disabled).toBe(false));
		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(2));
		await waitForGetCount(api, 3);
		const secondUrl = `${ORIGIN}/submit/fresh-token-2`;
		await waitFor(() =>
			expect(within(document.body).getByDisplayValue(secondUrl)).toBeTruthy(),
		);
		expect(within(document.body).getByDisplayValue(firstUrl)).toBeTruthy();
		expect(
			within(document.body).getAllByRole("button", { name: "复制链接" }),
		).toHaveLength(2);

		for (const url of [firstUrl, secondUrl]) {
			fireEvent.click(
				within(rowForUrl(url)).getByRole("button", { name: "复制链接" }),
			);
		}
		await waitFor(() =>
			expect(clipboardWrites.slice().sort()).toEqual(
				[firstUrl, secondUrl].sort(),
			),
		);
		view.unmount();
	});

	test("clears issued plaintext when the dialog closes and reopens", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const url = await createFirstLink(api);
		fireEvent.click(
			within(document.body).getByRole("button", { name: "关闭" }),
		);
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);
		clickTestId(view, "reopen");
		await waitForGetCount(api, 3);
		await waitFor(() =>
			expect(
				within(document.body).getByText(t("gm.invites.historicalHint")),
			).toBeTruthy(),
		);

		expect(within(document.body).queryByDisplayValue(url)).toBeNull();
		expect(
			within(document.body).queryAllByRole("button", { name: "复制链接" }),
		).toHaveLength(0);
		expect(
			within(document.body).queryByText(t("gm.invites.createdHint")),
		).toBeNull();
		view.unmount();
	});

	test("clears issued plaintext when the target changes", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const url = await createFirstLink(api);
		clickTestId(view, "target-2");
		await waitForGetCount(api, 3);
		await waitFor(() =>
			expect(within(document.body).getByText("还没有链接")).toBeTruthy(),
		);

		expect(within(document.body).queryByDisplayValue(url)).toBeNull();
		expect(
			within(document.body).queryAllByRole("button", { name: "复制链接" }),
		).toHaveLength(0);
		expect(
			within(document.body).queryByText(t("gm.invites.createdHint")),
		).toBeNull();
		view.unmount();
	});

	test("clears issued plaintext when the scope changes", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const url = await createFirstLink(api);
		clickTestId(view, "scope-session");
		await waitForGetCount(api, 3);
		await waitFor(() =>
			expect(within(document.body).getByText("还没有链接")).toBeTruthy(),
		);

		expect(within(document.body).queryByDisplayValue(url)).toBeNull();
		expect(
			within(document.body).queryAllByRole("button", { name: "复制链接" }),
		).toHaveLength(0);
		expect(
			within(document.body).queryByText(t("gm.invites.createdHint")),
		).toBeNull();
		view.unmount();
	});

	test("removes plaintext when a fresh invite is revoked", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);

		const url = await createFirstLink(api);
		const inviteId = api.state.postResponses[0]?.id;
		fireEvent.click(
			within(rowForUrl(url)).getByRole("button", { name: "撤销链接" }),
		);
		await waitFor(() =>
			expect(
				api.state.calls.some(
					(call) =>
						call.method === "DELETE" && call.url.endsWith(`/${inviteId}`),
				),
			).toBe(true),
		);
		await waitForGetCount(api, 3);
		await waitFor(() =>
			expect(within(document.body).getByText("已撤销")).toBeTruthy(),
		);

		expect(within(document.body).queryByDisplayValue(url)).toBeNull();
		expect(
			within(document.body).queryAllByRole("button", { name: "复制链接" }),
		).toHaveLength(0);
		expect(
			within(document.body).queryByText(t("gm.invites.createdHint")),
		).toBeNull();
		view.unmount();
	});

	test("keeps a successfully issued token visible and copyable when the following list load fails", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);
		await waitForGetCount(api, 1);
		api.state.failNextGets = 1;

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(1));
		await waitForGetCount(api, 2);
		await waitFor(() => expect(errorCalls).toBeGreaterThan(0));
		const url = `${ORIGIN}/submit/fresh-token-1`;
		await waitFor(() =>
			expect(within(document.body).getByDisplayValue(url)).toBeTruthy(),
		);
		expect(
			within(document.body).getByText(t("gm.invites.createdHint")),
		).toBeTruthy();

		fireEvent.click(
			within(rowForUrl(url)).getByRole("button", { name: "复制链接" }),
		);
		await waitFor(() => expect(clipboardWrites).toEqual([url]));
		view.unmount();
	});

	test("ignores stale create success and failure after close/reopen without restoring tokens or clearing newer pending", async () => {
		const api = createInviteApi();
		installApi(api);
		const view = render(<Harness />);
		await waitForGetCount(api, 1);

		const stalePostSuccess = deferred<Response>();
		const freshPostPending = deferred<Response>();
		api.state.postQueue.push(
			() => stalePostSuccess.promise,
			() => freshPostPending.promise,
		);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(1));

		fireEvent.click(
			within(document.body).getByRole("button", { name: "关闭" }),
		);
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);

		clickTestId(view, "reopen");
		await waitForGetCount(api, 2);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(2));
		expect(createButton().disabled).toBe(true);

		const staleCreated = inviteRow({
			id: "invite-stale-1",
			scope: "module",
			targetId: "module-1",
			targetName: null,
			token: "stale-secret-token",
			createdAt: NOW + 10,
		});
		stalePostSuccess.resolve(jsonResponse(staleCreated));
		await flushAsync();

		expect(api.state.getCalls).toBe(2);
		expect(createButton().disabled).toBe(true);
		expect(
			within(document.body).queryByDisplayValue(
				`${ORIGIN}/submit/stale-secret-token`,
			),
		).toBeNull();
		expect(
			within(document.body).queryByText(t("gm.invites.createdHint")),
		).toBeNull();

		const freshCreated = inviteRow({
			id: "invite-fresh-2",
			scope: "module",
			targetId: "module-1",
			targetName: null,
			token: "fresh-secret-token-2",
			createdAt: NOW + 20,
		});
		api.state.rows.unshift({ ...freshCreated, token: null });
		freshPostPending.resolve(jsonResponse(freshCreated));
		await waitForGetCount(api, 3);
		await waitFor(() => expect(createButton().disabled).toBe(false));
		expect(
			within(document.body).getByDisplayValue(
				`${ORIGIN}/submit/fresh-secret-token-2`,
			),
		).toBeTruthy();

		const stalePostFailure = deferred<Response>();
		const freshPostPending2 = deferred<Response>();
		api.state.postQueue.push(
			() => stalePostFailure.promise,
			() => freshPostPending2.promise,
		);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(3));
		fireEvent.click(
			within(document.body).getByRole("button", { name: "关闭" }),
		);
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);
		clickTestId(view, "reopen");
		await waitForGetCount(api, 4);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(4));
		expect(createButton().disabled).toBe(true);

		stalePostFailure.reject(new Error("stale create failure"));
		await flushAsync();

		expect(errorCalls).toBe(0);
		expect(createButton().disabled).toBe(true);

		freshPostPending2.resolve(
			jsonResponse(
				inviteRow({
					id: "invite-fresh-3",
					scope: "module",
					targetId: "module-1",
					targetName: null,
					token: "fresh-secret-token-3",
					createdAt: NOW + 30,
				}),
			),
		);
		await waitFor(() => expect(createButton().disabled).toBe(false));
		view.unmount();
	});

	test("ignores stale create and load completions after target switch", async () => {
		const m1Row = inviteRow({ id: "invite-m1", targetId: "module-1" });
		const m2Row = inviteRow({ id: "invite-m2", targetId: "module-2" });
		const api = createInviteApi([m1Row, m2Row]);
		installApi(api);

		const getM1 = deferred<Response>();
		const getM2 = deferred<Response>();
		api.state.getQueue.push(
			() => getM1.promise,
			() => getM2.promise,
		);

		const view = render(<Harness />);
		await waitForGetCount(api, 1);
		expect(within(document.body).getByText(t("common.loading"))).toBeTruthy();

		clickTestId(view, "target-2");
		await waitForGetCount(api, 2);

		getM1.resolve(jsonResponse({ items: [m1Row] }));
		await flushAsync();

		expect(within(document.body).getByText(t("common.loading"))).toBeTruthy();
		expect(
			document.body.querySelector('[data-invite-id="invite-m1"]'),
		).toBeNull();

		getM2.resolve(jsonResponse({ items: [m2Row] }));
		await waitFor(() =>
			expect(
				document.body.querySelector('[data-invite-id="invite-m2"]'),
			).not.toBeNull(),
		);
		expect(within(document.body).queryByText(t("common.loading"))).toBeNull();

		const postM2 = deferred<Response>();
		const postSession = deferred<Response>();
		api.state.postQueue.push(
			() => postM2.promise,
			() => postSession.promise,
		);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(1));

		clickTestId(view, "scope-session");
		await waitForGetCount(api, 3);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(2));
		expect(createButton().disabled).toBe(true);

		postM2.resolve(
			jsonResponse(
				inviteRow({
					id: "invite-m2-stale",
					scope: "module",
					targetId: "module-2",
					token: "stale-m2-token",
				}),
			),
		);
		await flushAsync();

		expect(api.state.getCalls).toBe(3);
		expect(createButton().disabled).toBe(true);
		expect(
			within(document.body).queryByDisplayValue(
				`${ORIGIN}/submit/stale-m2-token`,
			),
		).toBeNull();

		postSession.resolve(
			jsonResponse(
				inviteRow({
					id: "invite-s1",
					scope: "session",
					targetId: "session-1",
					token: "fresh-session-token",
				}),
			),
		);
		await waitFor(() => expect(createButton().disabled).toBe(false));
		view.unmount();
	});

	test("ignores stale load failures and stale revoke completions after close/reopen and target switch", async () => {
		const m1Row = inviteRow({ id: "invite-m1", targetId: "module-1" });
		const api = createInviteApi([m1Row]);
		installApi(api);

		const staleLoadReject = deferred<Response>();
		const m2LoadOk = deferred<Response>();
		api.state.getQueue.push(
			() => staleLoadReject.promise,
			() => m2LoadOk.promise,
		);

		const view = render(<Harness />);
		await waitForGetCount(api, 1);

		clickTestId(view, "target-2");
		await waitForGetCount(api, 2);
		m2LoadOk.resolve(jsonResponse({ items: [] }));
		await waitFor(() =>
			expect(
				within(document.body).getByText(t("gm.invites.empty")),
			).toBeTruthy(),
		);

		staleLoadReject.reject(new Error("stale network failure"));
		await flushAsync();

		expect(errorCalls).toBe(0);
		expect(within(document.body).getByText(t("gm.invites.empty"))).toBeTruthy();

		const staleDeleteSuccess = deferred<Response>();
		const staleDeleteFailure = deferred<Response>();
		api.state.deleteQueue.push(
			() => staleDeleteSuccess.promise,
			() => staleDeleteFailure.promise,
		);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(1));
		await waitForGetCount(api, 3);
		const m2FreshUrl = `${ORIGIN}/submit/fresh-token-1`;
		await waitFor(() =>
			expect(within(document.body).getByDisplayValue(m2FreshUrl)).toBeTruthy(),
		);

		fireEvent.click(
			within(rowForUrl(m2FreshUrl)).getByRole("button", { name: "撤销链接" }),
		);
		await waitFor(() =>
			expect(api.state.calls.some((call) => call.method === "DELETE")).toBe(
				true,
			),
		);

		clickTestId(view, "scope-session");
		await waitForGetCount(api, 4);
		const getsBeforeStaleDelete = api.state.getCalls;

		staleDeleteSuccess.resolve(jsonResponse({ success: true }));
		await flushAsync();

		expect(api.state.getCalls).toBe(getsBeforeStaleDelete);

		fireEvent.click(createButton());
		await waitFor(() => expect(api.state.postCount).toBe(2));
		await waitForGetCount(api, 5);
		const sessionUrl = `${ORIGIN}/submit/fresh-token-2`;
		await waitFor(() =>
			expect(within(document.body).getByDisplayValue(sessionUrl)).toBeTruthy(),
		);

		fireEvent.click(
			within(rowForUrl(sessionUrl)).getByRole("button", { name: "撤销链接" }),
		);
		fireEvent.click(
			within(document.body).getByRole("button", { name: "关闭" }),
		);
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);

		staleDeleteFailure.reject(new Error("stale revoke failure"));
		await flushAsync();

		expect(errorCalls).toBe(0);
		view.unmount();
	});
});
