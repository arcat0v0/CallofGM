import type { DeepFilterAssets } from "./voice-deepfilter";
import modelUrl from "./vendor/deepfilternet3/deepfilternet3-model.bin?url";
import runtimeUrl from "./vendor/deepfilternet3/deepfilternet3-runtime.bin?url";

export type DeepFilterAssetLoader = () => Promise<DeepFilterAssets>;

/** Smallest module using a v128 instruction (from wasm-feature-detect). */
const SIMD_PROBE = new Uint8Array([
	0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8,
	0, 65, 0, 253, 15, 253, 98, 11,
]);

/** The DeepFilterNet3 runtime is built with SIMD128 and ships gzip-compressed. */
export function supportsDeepFilter(): boolean {
	try {
		return (
			typeof WebAssembly === "object" &&
			WebAssembly.validate(SIMD_PROBE) &&
			typeof DecompressionStream === "function"
		);
	} catch {
		return false;
	}
}

/** Returns uncompressed WebAssembly bytes, whether or not a host already decoded the gzip. */
export async function decodeDeepFilterRuntime(
	bytes: ArrayBuffer,
): Promise<ArrayBuffer> {
	const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
	if (
		head[0] === 0x00 &&
		head[1] === 0x61 &&
		head[2] === 0x73 &&
		head[3] === 0x6d
	) {
		return bytes;
	}
	if (head[0] !== 0x1f || head[1] !== 0x8b) {
		throw new Error("Unexpected DeepFilterNet runtime format");
	}
	const stream = new Blob([bytes])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	return new Response(stream).arrayBuffer();
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`DeepFilterNet asset request failed: ${response.status}`);
	}
	return response.arrayBuffer();
}

/**
 * Downloads the self-hosted runtime (~2.9 MB) and model (~8 MB). Both are
 * content-hashed by Vite, so later loads come from the HTTP cache.
 */
export async function loadDeepFilterAssets(): Promise<DeepFilterAssets> {
	if (!supportsDeepFilter()) {
		throw new Error("DeepFilterNet needs WebAssembly SIMD");
	}
	const [runtime, model] = await Promise.all([
		fetchBytes(runtimeUrl),
		fetchBytes(modelUrl),
	]);
	return { wasm: await decodeDeepFilterRuntime(runtime), model };
}
