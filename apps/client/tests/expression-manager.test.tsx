import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ExpressionManager } from "../src/features/characters/expression-manager";

type CreatedUrl = { url: string; file: File };

type FetchCall = { url: string; method: string | undefined; body: unknown };

function makeFile(name: string) {
	return new File([`content-${name}`], name, { type: "image/png" });
}

function addFiles(view: ReturnType<typeof render>, files: File[]) {
	const input = view.container.querySelector(
		'input[type="file"]',
	) as HTMLInputElement;
	fireEvent.change(input, { target: { files } });
}

function pendingImage(view: ReturnType<typeof render>, url: string) {
	return view.container.querySelector(
		`img[src="${url}"]`,
	) as HTMLImageElement | null;
}

describe("ExpressionManager pending previews", () => {
	let created: CreatedUrl[];
	let revoked: string[];
	let calls: FetchCall[];
	let originalFetch: typeof fetch;
	let originalCreate: typeof URL.createObjectURL;
	let originalRevoke: typeof URL.revokeObjectURL;
	let uploadResponses: Array<() => Promise<Response>>;

	beforeEach(() => {
		created = [];
		revoked = [];
		calls = [];
		uploadResponses = [];
		originalFetch = globalThis.fetch;
		originalCreate = URL.createObjectURL;
		originalRevoke = URL.revokeObjectURL;
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			writable: true,
			value: (file: Blob) => {
				const url = `blob:cogm/pending-${created.length + 1}`;
				created.push({ url, file: file as File });
				return url;
			},
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			writable: true,
			value: (url: string) => {
				revoked.push(url);
			},
		});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				calls.push({
					url: String(url),
					method: init?.method,
					body: init?.body,
				});
				if (String(url).includes("/media/upload")) {
					const respond = uploadResponses.shift();
					if (respond) {
						return respond();
					}
					return new Response(JSON.stringify({ id: "asset-1" }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				return new Response(null, { status: 204 });
			}) as typeof fetch,
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			writable: true,
			value: originalCreate,
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			writable: true,
			value: originalRevoke,
		});
	});

	function renderManager() {
		return render(
			<ExpressionManager
				characterId="char-1"
				portraits={[]}
				basePath="/pl/characters"
				onChange={() => undefined}
			/>,
		);
	}

	test("prefills the name from the filename and renders a blob thumbnail", () => {
		const view = renderManager();
		const file = makeFile("angry.png");
		addFiles(view, [file]);
		const input = view.getByRole("textbox", {
			name: "待上传 · 表情名称",
		}) as HTMLInputElement;
		expect(input.value).toBe("angry");
		expect(created).toEqual([{ url: "blob:cogm/pending-1", file }]);
		const preview = pendingImage(view, "blob:cogm/pending-1");
		expect(preview).not.toBeNull();
		expect(preview?.alt).toBe("angry");
		expect(preview?.className).toContain("object-cover");
		view.unmount();
		expect(revoked).toEqual(["blob:cogm/pending-1"]);
	});

	test("renders one distinct blob thumbnail per pending file", () => {
		const view = renderManager();
		const files = [makeFile("smile.png"), makeFile("hurt.webp")];
		addFiles(view, files);
		expect(created.map((entry) => entry.file)).toEqual(files);
		expect(created[0]?.url).not.toBe(created[1]?.url);
		expect(pendingImage(view, "blob:cogm/pending-1")?.alt).toBe("smile");
		expect(pendingImage(view, "blob:cogm/pending-2")?.alt).toBe("hurt");
		expect(view.container.querySelectorAll("img")).toHaveLength(2);
		view.unmount();
		expect(revoked).toEqual(["blob:cogm/pending-1", "blob:cogm/pending-2"]);
	});

	test("revokes the URL when a pending row is deleted", () => {
		const view = renderManager();
		addFiles(view, [makeFile("first.png"), makeFile("second.png")]);
		expect(created).toHaveLength(2);
		const [deleteFirst] = view.getAllByRole("button", { name: "删除" });
		expect(deleteFirst).toBeDefined();
		fireEvent.click(deleteFirst as Element);
		expect(revoked).toEqual(["blob:cogm/pending-1"]);
		expect(pendingImage(view, "blob:cogm/pending-1")).toBeNull();
		expect(pendingImage(view, "blob:cogm/pending-2")).not.toBeNull();
		view.unmount();
		expect(revoked).toEqual(["blob:cogm/pending-1", "blob:cogm/pending-2"]);
	});

	test("revokes the URL after a successful upload and removes the row", async () => {
		const view = renderManager();
		addFiles(view, [makeFile("first.png")]);
		fireEvent.click(view.getByRole("button", { name: "上传" }));
		await waitFor(() => expect(revoked).toEqual(["blob:cogm/pending-1"]));
		expect(pendingImage(view, "blob:cogm/pending-1")).toBeNull();
		expect(calls.map((call) => call.url)).toEqual([
			"/api/v1/media/upload",
			"/api/v1/pl/characters/char-1/portraits",
		]);
		const upload = calls[0]?.body as FormData;
		expect(upload.get("file")).toBeInstanceOf(File);
		expect((upload.get("file") as File).name).toBe("first.png");
		expect(JSON.parse(String(calls[1]?.body))).toEqual({
			label: "first",
			portraitAssetId: "asset-1",
		});
		view.unmount();
		expect(revoked).toEqual(["blob:cogm/pending-1"]);
	});

	test("uploads pending files sequentially, keeps failed previews for retry, and revokes each active URL once", async () => {
		const uploadEvents: string[] = [];
		let firstUploadResolve: (() => void) | undefined;
		uploadResponses.push(
			() =>
				new Promise<Response>((resolve) => {
					firstUploadResolve = () =>
						resolve(
							new Response(JSON.stringify({ code: "UPLOAD_FAILED" }), {
								status: 500,
								headers: { "content-type": "application/json" },
							}),
						);
				}),
		);
		const view = renderManager();
		const files = [makeFile("retry.png"), makeFile("next.png")];
		addFiles(view, files);
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				calls.push({ url: target, method: init?.method, body: init?.body });
				uploadEvents.push(target);
				if (target.includes("/media/upload")) {
					const respond = uploadResponses.shift();
					if (respond) {
						return respond();
					}
					return new Response(JSON.stringify({ id: "asset-1" }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				return new Response(null, { status: 204 });
			}) as typeof fetch,
		});
		fireEvent.click(view.getByRole("button", { name: "上传" }));
		await waitFor(() => expect(uploadEvents).toHaveLength(1));
		expect(uploadEvents[0]).toBe("/api/v1/media/upload");
		expect(revoked).toEqual([]);
		firstUploadResolve?.();
		await waitFor(() =>
			expect(uploadEvents).toEqual([
				"/api/v1/media/upload",
				"/api/v1/media/upload",
				"/api/v1/pl/characters/char-1/portraits",
			]),
		);
		expect(calls[0]?.body).toBeInstanceOf(FormData);
		expect(calls[1]?.body).toBeInstanceOf(FormData);
		expect((calls[0]?.body as FormData | undefined)?.get("file")).toBe(
			files[0],
		);
		expect((calls[1]?.body as FormData | undefined)?.get("file")).toBe(
			files[1],
		);
		expect(JSON.parse(String(calls[2]?.body))).toEqual({
			label: "next",
			portraitAssetId: "asset-1",
		});
		expect(revoked).toEqual(["blob:cogm/pending-2"]);
		expect(pendingImage(view, "blob:cogm/pending-1")).not.toBeNull();
		expect(pendingImage(view, "blob:cogm/pending-2")).toBeNull();
		await waitFor(() =>
			expect(view.getByRole("button", { name: "上传" })).toBeTruthy(),
		);
		fireEvent.click(view.getByRole("button", { name: "上传" }));
		await waitFor(() =>
			expect(revoked).toEqual(["blob:cogm/pending-2", "blob:cogm/pending-1"]),
		);
		expect(
			calls.filter((call) => call.url.includes("/media/upload")),
		).toHaveLength(3);
		expect(pendingImage(view, "blob:cogm/pending-1")).toBeNull();
		view.unmount();
		expect(revoked).toEqual(["blob:cogm/pending-2", "blob:cogm/pending-1"]);
	});

	test("disables pending-row name inputs and delete buttons while uploading", async () => {
		const deferredUpload = Promise.withResolvers<Response>();
		let uploadCount = 0;
		uploadResponses.push(() => {
			uploadCount += 1;
			return deferredUpload.promise;
		});

		const view = renderManager();
		addFiles(view, [makeFile("first.png"), makeFile("second.png")]);

		fireEvent.click(view.getByRole("button", { name: "上传" }));

		await waitFor(() => {
			const inputs = view.getAllByRole("textbox", {
				name: "待上传 · 表情名称",
			}) as HTMLInputElement[];
			const deleteButtons = view.getAllByRole("button", {
				name: "删除",
			}) as HTMLButtonElement[];
			expect(inputs).toHaveLength(2);
			expect(deleteButtons).toHaveLength(2);
			for (const input of inputs) {
				expect(input.disabled).toBe(true);
			}
			for (const button of deleteButtons) {
				expect(button.disabled).toBe(true);
			}
		});
		expect(uploadCount).toBe(1);

		const inputsDuringUpload = view.getAllByRole("textbox", {
			name: "待上传 · 表情名称",
		}) as HTMLInputElement[];
		const deleteButtonsDuringUpload = view.getAllByRole("button", {
			name: "删除",
		}) as HTMLButtonElement[];
		fireEvent.change(inputsDuringUpload[1] as HTMLInputElement, {
			target: { value: "edited-during-upload" },
		});
		fireEvent.click(deleteButtonsDuringUpload[1] as HTMLButtonElement);
		expect(revoked).toEqual([]);
		expect(pendingImage(view, "blob:cogm/pending-2")).not.toBeNull();

		deferredUpload.resolve(
			new Response(JSON.stringify({ id: "asset-1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await waitFor(() =>
			expect(revoked).toEqual(["blob:cogm/pending-1", "blob:cogm/pending-2"]),
		);
		const createCalls = calls.filter(
			(call) => call.url === "/api/v1/pl/characters/char-1/portraits",
		);
		expect(
			createCalls.map((call) => JSON.parse(String(call.body)).label),
		).toEqual(["first", "second"]);
	});

	test("revokes each active URL exactly once on unmount", () => {
		const view = renderManager();
		addFiles(view, [makeFile("a.png"), makeFile("b.png"), makeFile("c.png")]);
		expect(created).toHaveLength(3);
		expect(revoked).toEqual([]);
		view.unmount();
		expect(revoked).toEqual([
			"blob:cogm/pending-1",
			"blob:cogm/pending-2",
			"blob:cogm/pending-3",
		]);
	});
});
