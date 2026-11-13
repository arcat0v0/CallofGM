import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import { ImportCharacterSheetDialog } from "../src/features/gm-admin/dialogs/import-character-sheet-dialog";
import { t } from "../src/i18n";

type PreviewResponse = {
	importToken: string;
	preview: {
		characterName: string;
		sheetData: Record<string, unknown>;
		errors: Array<{ cell: string; message: string }>;
		warnings: Array<{ cell: string; message: string }>;
		providedFields: string[];
	};
};

type FetchCall = { path: string; method: string; body: unknown };

const ATTRIBUTES = {
	str: 60,
	con: 60,
	siz: 60,
	dex: 60,
	app: 60,
	int: 60,
	pow: 60,
	edu: 60,
	luck: 60,
};

function previewResponse(
	overrides: Partial<PreviewResponse["preview"]> = {},
): PreviewResponse {
	return {
		importToken: "token-1",
		preview: {
			characterName: "调查员",
			sheetData: { attributes: ATTRIBUTES, skills: { 侦查: 50 } },
			errors: [],
			warnings: [],
			providedFields: [],
			...overrides,
		},
	};
}

function file(name: string): File {
	return new File([name], name, {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function uploadedForm(body: FormData): File {
	return body.get("file") as File;
}

function ImportDialogHarness({
	onImported,
	clearTargetOnClose = false,
}: {
	onImported?: () => void;
	clearTargetOnClose?: boolean;
}) {
	const [open, setOpen] = useState(true);
	const [scope, setScope] = useState<"gm" | "pl">("gm");
	const [ruleId, setRuleId] = useState("coc7e");
	const [targetId, setTargetId] = useState<string | null>("char-a");
	return (
		<div>
			<button
				type="button"
				data-testid="open-b"
				onClick={() => {
					setTargetId("char-b");
					setOpen(true);
				}}
			>
				Open B
			</button>
			<button
				type="button"
				data-testid="switch-target"
				onClick={() => setTargetId("char-b")}
			>
				Target
			</button>
			<button
				type="button"
				data-testid="switch-scope"
				onClick={() => {
					setScope("pl");
					setTargetId(null);
				}}
			>
				Scope
			</button>
			<button
				type="button"
				data-testid="switch-rule"
				onClick={() => setRuleId("coc7e-alt")}
			>
				Rule
			</button>
			<ImportCharacterSheetDialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next && clearTargetOnClose) {
						setTargetId(null);
					}
				}}
				onImported={onImported}
				scope={scope}
				ruleId={ruleId}
				updateCharacterId={targetId}
			/>
		</div>
	);
}

describe("ImportCharacterSheetDialog", () => {
	let originalFetch: typeof fetch;
	let calls: FetchCall[];
	let previews: Array<() => Promise<Response>>;
	let confirms: Array<() => Promise<Response>>;
	let confirmStatus: number;
	let toastSpies: Array<{ mockRestore: () => void }>;
	let successCalls: number;
	let errorCalls: number;

	beforeEach(() => {
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
		calls = [];
		previews = [];
		confirms = [];
		confirmStatus = 200;
		successCalls = 0;
		errorCalls = 0;
		toastSpies = [
			spyOn(toast, "success").mockImplementation(() => {
				successCalls += 1;
				return "toast-id";
			}),
			spyOn(toast, "error").mockImplementation(() => {
				errorCalls += 1;
				return "toast-id";
			}),
		];
		originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (input: RequestInfo | URL, init?: RequestInit) => {
				const path = String(input);
				const method = init?.method ?? "GET";
				const body =
					init?.body instanceof FormData
						? ({
								file: uploadedForm(init.body).name,
								ruleId: init.body.get("ruleId"),
							} as unknown)
						: init?.body
							? JSON.parse(String(init.body))
							: null;
				calls.push({ path, method, body });
				if (path.includes("/import/preview")) {
					const next = previews.shift();
					if (next) return next();
					return jsonResponse(previewResponse());
				}
				if (path.includes("/import/confirm")) {
					const next = confirms.shift();
					if (next) return next();
					return jsonResponse({}, confirmStatus);
				}
				return jsonResponse({});
			}) as typeof fetch,
		});
	});

	afterEach(() => {
		for (const spy of toastSpies) {
			spy.mockRestore();
		}
		cleanup();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
	});

	function renderDialog(scope: "gm" | "pl" = "gm") {
		return render(
			<ImportCharacterSheetDialog
				open
				onOpenChange={() => undefined}
				scope={scope}
			/>,
		);
	}

	function body() {
		return within(document.body);
	}

	function fileInput(view: ReturnType<typeof render>): HTMLInputElement {
		return view.getByLabelText(
			t("gm.importSheet.chooseFile"),
		) as HTMLInputElement;
	}

	function confirmButton(view: ReturnType<typeof render>): HTMLButtonElement {
		return view.getByRole("button", {
			name: t("gm.importSheet.confirm"),
		}) as HTMLButtonElement;
	}

	function select(view: ReturnType<typeof render>, next: File) {
		fireEvent.change(fileInput(view), { target: { files: [next] } });
	}

	test("uses shared FilePicker, advertises only XLSX and shows the visible format hint", () => {
		const view = renderDialog();
		const input = fileInput(view);
		expect(input.closest("label")?.querySelector("svg")).toBeTruthy();
		expect(input.className).toContain("sr-only");
		expect(input.getAttribute("accept")).toBe(".xlsx");
		expect(body().getByText(t("gm.importSheet.formatHint"))).toBeTruthy();
		expect(view.queryByText(".xls")).toBeNull();
	});

	test("clears the stale preview immediately when a new file is selected", async () => {
		const view = renderDialog();
		select(view, file("first.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		const pending = deferred<Response>();
		previews.push(() => pending.promise);
		select(view, file("second.xlsx"));
		expect(body().queryByText("调查员")).toBeNull();
		expect(confirmButton(view).disabled).toBe(true);
		expect(body().getByText("second.xlsx")).toBeTruthy();

		pending.resolve(jsonResponse(previewResponse()));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());
	});

	test("a failed replacement leaves no stale preview and confirm stays disabled", async () => {
		const view = renderDialog();
		select(view, file("first.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());
		previews.push(async () =>
			jsonResponse({ code: "INVALID_FILE_CONTENT" }, 400),
		);
		select(view, file("bad.xlsx"));
		await waitFor(() =>
			expect(
				calls.filter((call) => call.path.includes("preview")),
			).toHaveLength(2),
		);
		await waitFor(() => expect(body().queryByText("调查员")).toBeNull());
		expect(confirmButton(view).disabled).toBe(true);
		expect(body().getByText("bad.xlsx")).toBeTruthy();
	});

	test("an out-of-order response cannot restore an older preview", async () => {
		const view = renderDialog();
		const first = deferred<Response>();
		const second = deferred<Response>();
		previews.push(
			() => first.promise,
			() => second.promise,
		);
		select(view, file("first.xlsx"));
		select(view, file("second.xlsx"));
		expect(calls.filter((call) => call.path.includes("preview"))).toHaveLength(
			2,
		);

		second.resolve(
			jsonResponse(
				previewResponse({
					characterName: "新调查员",
				}),
			),
		);
		await waitFor(() => expect(body().getByText("新调查员")).toBeTruthy());
		first.resolve(jsonResponse(previewResponse({ characterName: "旧调查员" })));
		await Promise.resolve();
		await waitFor(() => expect(body().queryByText("旧调查员")).toBeNull());
		expect(body().getByText("新调查员")).toBeTruthy();
		expect(body().getByText("second.xlsx")).toBeTruthy();
	});

	test("errors disable Confirm, warnings remain confirmable, and both gates remain on the client and server", async () => {
		const view = renderDialog();
		previews.push(async () =>
			jsonResponse(
				previewResponse({
					errors: [{ cell: "A1", message: "缺少姓名" }],
				}),
			),
		);
		select(view, file("errors.xlsx"));
		await waitFor(() => expect(body().getByText("缺少姓名")).toBeTruthy());
		expect(confirmButton(view).disabled).toBe(true);
		expect(calls.some((call) => call.path.includes("/import/confirm"))).toBe(
			false,
		);
	});

	test("warnings do not disable Confirm and the confirm request reaches the server", async () => {
		const view = renderDialog("pl");
		previews.push(async () =>
			jsonResponse(
				previewResponse({
					warnings: [{ cell: "A1", message: "字段使用模糊匹配" }],
				}),
			),
		);
		select(view, file("warnings.xlsx"));
		await waitFor(() =>
			expect(body().getByText("字段使用模糊匹配")).toBeTruthy(),
		);
		const button = confirmButton(view);
		expect(button.disabled).toBe(false);
		fireEvent.click(button);
		await waitFor(() =>
			expect(
				calls.some(
					(call) =>
						call.path === "/api/v1/pl/characters/import/confirm" &&
						call.method === "POST",
				),
			).toBe(true),
		);
		expect(
			calls.find((call) => call.path.includes("/import/confirm"))?.body,
		).toEqual({ importToken: "token-1", kind: "pc" });
	});

	test("PL preview posts only the selected file and ruleId", async () => {
		const view = renderDialog("pl");
		select(view, file("pl.xlsx"));
		await waitFor(() =>
			expect(
				calls.some((call) =>
					call.path.includes("/api/v1/pl/characters/import/preview"),
				),
			).toBe(true),
		);
		expect(
			calls.find((call) => call.path.includes("/import/preview"))?.body,
		).toEqual({ file: "pl.xlsx", ruleId: "coc7e" });
	});

	test("previews A, closes, reopens for B, and cannot confirm until B selects a file", async () => {
		let importedCount = 0;
		const previewA = deferred<Response>();
		const previewB = deferred<Response>();
		previews.push(
			() => previewA.promise,
			() => previewB.promise,
		);

		const view = render(
			<ImportDialogHarness
				clearTargetOnClose
				onImported={() => {
					importedCount += 1;
				}}
			/>,
		);
		select(view, file("a.xlsx"));
		previewA.resolve(
			jsonResponse({
				importToken: "token-a",
				preview: previewResponse({ characterName: "角色甲" }).preview,
			}),
		);
		await waitFor(() => expect(body().getByText("角色甲")).toBeTruthy());

		const updateButton = () =>
			body().getByRole("button", {
				name: t("gm.importSheet.confirmUpdate"),
			}) as HTMLButtonElement;
		expect(updateButton().disabled).toBe(false);

		fireEvent.click(
			body().getByRole("button", { name: t("gm.importSheet.close") }),
		);
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());

		fireEvent.click(view.getByTestId("open-b"));
		await waitFor(() => expect(body().getByRole("dialog")).toBeTruthy());

		expect(body().queryByText("角色甲")).toBeNull();
		expect(body().queryByText("a.xlsx")).toBeNull();
		expect(updateButton().disabled).toBe(true);
		fireEvent.click(updateButton());
		expect(calls.some((call) => call.path.includes("/import/confirm"))).toBe(
			false,
		);

		select(view, file("b.xlsx"));
		expect(updateButton().disabled).toBe(true);
		previewB.resolve(
			jsonResponse({
				importToken: "token-b",
				preview: previewResponse({ characterName: "角色乙" }).preview,
			}),
		);
		await waitFor(() => expect(body().getByText("角色乙")).toBeTruthy());
		expect(updateButton().disabled).toBe(false);

		fireEvent.click(updateButton());
		await waitFor(() =>
			expect(calls.some((call) => call.path.includes("/import/confirm"))).toBe(
				true,
			),
		);
		expect(
			calls.find((call) => call.path.includes("/import/confirm"))?.body,
		).toEqual({
			importToken: "token-b",
			kind: "pc",
			characterId: "char-b",
		});
		expect(importedCount).toBe(1);
	});

	test("clears file and preview whenever scope, ruleId, or updateCharacterId changes", async () => {
		const view = render(<ImportDialogHarness />);
		select(view, file("first.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		fireEvent.click(view.getByTestId("switch-target"));
		await waitFor(() => expect(body().queryByText("调查员")).toBeNull());
		expect(body().queryByText("first.xlsx")).toBeNull();
		expect(
			(
				body().getByRole("button", {
					name: t("gm.importSheet.confirmUpdate"),
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);

		select(view, file("second.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		fireEvent.click(view.getByTestId("switch-scope"));
		await waitFor(() => expect(body().queryByText("调查员")).toBeNull());
		expect(body().queryByText("second.xlsx")).toBeNull();
		expect(confirmButton(view).disabled).toBe(true);

		select(view, file("third.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		fireEvent.click(view.getByTestId("switch-rule"));
		await waitFor(() => expect(body().queryByText("调查员")).toBeNull());
		expect(body().queryByText("third.xlsx")).toBeNull();
		expect(confirmButton(view).disabled).toBe(true);
	});

	test("ignores late preview success and failure completions from a previous open lifecycle or target switch", async () => {
		const staleSuccess = deferred<Response>();
		const staleFailure = deferred<Response>();
		const pendingC = deferred<Response>();
		previews.push(
			() => staleSuccess.promise,
			() => staleFailure.promise,
			() => pendingC.promise,
		);

		const view = render(<ImportDialogHarness />);
		select(view, file("a.xlsx"));
		fireEvent.click(view.getByTestId("switch-target"));

		staleSuccess.resolve(
			jsonResponse({
				importToken: "token-stale",
				preview: previewResponse({ characterName: "幽灵角色" }).preview,
			}),
		);
		await flushAsync();

		const updateButton = () =>
			body().getByRole("button", {
				name: t("gm.importSheet.confirmUpdate"),
			}) as HTMLButtonElement;
		expect(body().queryByText("幽灵角色")).toBeNull();
		expect(updateButton().disabled).toBe(true);

		select(view, file("b.xlsx"));
		expect(updateButton().disabled).toBe(true);

		fireEvent.click(
			body().getByRole("button", { name: t("gm.importSheet.close") }),
		);
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		fireEvent.click(view.getByTestId("open-b"));
		await waitFor(() => expect(body().getByRole("dialog")).toBeTruthy());

		select(view, file("b2.xlsx"));
		staleFailure.reject(new Error("stale error"));
		await flushAsync();

		expect(errorCalls).toBe(0);
		expect(updateButton().disabled).toBe(true);

		pendingC.resolve(
			jsonResponse({
				importToken: "token-c",
				preview: previewResponse({ characterName: "角色丙" }).preview,
			}),
		);
		await waitFor(() => expect(body().getByText("角色丙")).toBeTruthy());
		expect(updateButton().disabled).toBe(false);
	});

	test("ignores late confirm completion and failure after close and reopen for another target", async () => {
		let importedCount = 0;
		const confirmA = deferred<Response>();
		const confirmBFail = deferred<Response>();
		const confirmC = deferred<Response>();
		confirms.push(
			() => confirmA.promise,
			() => confirmBFail.promise,
			() => confirmC.promise,
		);

		const view = render(
			<ImportDialogHarness
				onImported={() => {
					importedCount += 1;
				}}
			/>,
		);
		select(view, file("a.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		const updateButton = () =>
			body().getByRole("button", {
				name: t("gm.importSheet.confirmUpdate"),
			}) as HTMLButtonElement;
		fireEvent.click(updateButton());
		await waitFor(() => expect(updateButton().disabled).toBe(true));

		fireEvent.click(
			body().getByRole("button", { name: t("gm.importSheet.close") }),
		);
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());

		fireEvent.click(view.getByTestId("open-b"));
		await waitFor(() => expect(body().getByRole("dialog")).toBeTruthy());

		select(view, file("b.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());
		expect(updateButton().disabled).toBe(false);

		confirmA.resolve(jsonResponse({}));
		await flushAsync();

		expect(body().getByRole("dialog")).toBeTruthy();
		expect(body().getByText("b.xlsx")).toBeTruthy();
		expect(body().getByText("调查员")).toBeTruthy();
		expect(successCalls).toBe(0);
		expect(importedCount).toBe(0);

		fireEvent.click(updateButton());
		await waitFor(() => expect(updateButton().disabled).toBe(true));

		fireEvent.click(
			body().getByRole("button", { name: t("gm.importSheet.close") }),
		);
		await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
		fireEvent.click(view.getByTestId("open-b"));
		await waitFor(() => expect(body().getByRole("dialog")).toBeTruthy());
		select(view, file("c.xlsx"));
		await waitFor(() => expect(body().getByText("调查员")).toBeTruthy());

		fireEvent.click(updateButton());
		await waitFor(() => expect(updateButton().disabled).toBe(true));

		confirmBFail.reject(new Error("stale confirm failure"));
		await flushAsync();

		expect(errorCalls).toBe(0);
		expect(updateButton().disabled).toBe(true);

		confirmC.resolve(jsonResponse({}));
		await waitFor(() => expect(importedCount).toBe(1));
		expect(successCalls).toBe(1);
	});
});
