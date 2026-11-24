import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { uploadMediaAsset } from "../src/lib/media-upload";
import { useRuntimeConfigStore } from "../src/stores/runtime-config-store";

describe("uploadMediaAsset (local vs S3 direct upload)", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		useRuntimeConfigStore.setState({
			storageMode: "local",
			maxMediaUploadBytes: 100 * 1024 * 1024,
			maxThemeUploadBytes: 50 * 1024 * 1024,
			loaded: false,
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: originalFetch,
		});
	});

	test("uses presign -> direct PUT -> complete when storageMode is s3", async () => {
		useRuntimeConfigStore.setState({
			storageMode: "s3",
			maxMediaUploadBytes: 10 * 1024 * 1024,
			loaded: true,
		});

		const calls: Array<{
			url: string;
			method?: string;
			credentials?: RequestCredentials;
		}> = [];

		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				calls.push({
					url: target,
					method: init?.method,
					credentials: init?.credentials,
				});
				if (target === "/api/v1/media/presign") {
					return new Response(
						JSON.stringify({
							mode: "direct",
							maxUploadBytes: 10 * 1024 * 1024,
							uploadToken: "tok-123",
							uploadUrl: "https://bucket.oss.example.com/media/obj.png?sig=1",
							method: "PUT",
							headers: { "Content-Type": "image/png" },
							expiresAt: Date.now() + 60_000,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				if (target.startsWith("https://bucket.oss.example.com/")) {
					return new Response(null, { status: 200 });
				}
				if (target === "/api/v1/media/complete") {
					return new Response(JSON.stringify({ id: "oss-asset-1" }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				}
				return new Response("Not Found", { status: 404 });
			}) as typeof fetch,
		});

		const file = new File([new Uint8Array([1, 2, 3, 4])], "scene.png", {
			type: "image/png",
		});
		const id = await uploadMediaAsset(file, "scene");
		expect(id).toBe("oss-asset-1");
		expect(calls).toEqual([
			{ url: "/api/v1/media/presign", method: "POST", credentials: "include" },
			{
				url: "https://bucket.oss.example.com/media/obj.png?sig=1",
				method: "PUT",
				credentials: "omit",
			},
			{ url: "/api/v1/media/complete", method: "POST", credentials: "include" },
		]);
	});

	test("enforces dynamic maxMediaUploadBytes from runtime config", async () => {
		useRuntimeConfigStore.setState({
			storageMode: "local",
			maxMediaUploadBytes: 1024,
			loaded: true,
		});
		const big = new File([new Uint8Array(2048)], "too-big.png", {
			type: "image/png",
		});
		await expect(uploadMediaAsset(big, "scene")).rejects.toMatchObject({
			code: "FILE_SIZE_EXCEEDED",
		});
	});
});
