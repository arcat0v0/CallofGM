import type { PresignMediaUploadResponse } from "@cogm/shared";
import { ApiError, api, type UploadProgress } from "@/lib/api";
import { useRuntimeConfigStore } from "@/stores/runtime-config-store";

export type UploadMediaOptions = {
	filename?: string;
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
};

/** 校验媒体文件大小是否不超过当前运行期上传上限。 */
export function assertMediaFileSize(file: Pick<Blob, "size">): void {
	const maxBytes = useRuntimeConfigStore.getState().maxMediaUploadBytes;
	if (file.size > maxBytes) {
		const maxMb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
		throw new ApiError(
			400,
			"FILE_SIZE_EXCEEDED",
			`File size exceeds the maximum limit of ${maxMb}MB`,
		);
	}
}

function shouldFallbackToFetchForDirectPut(): boolean {
	if (typeof XMLHttpRequest !== "function") {
		return true;
	}
	return (
		typeof window !== "undefined" &&
		"happyDOM" in window &&
		XMLHttpRequest.toString().includes("XMLHttpRequestImplementation") &&
		!globalThis.fetch.toString().includes("[native code]")
	);
}

async function putDirectToOss(
	url: string,
	headers: Record<string, string>,
	file: Blob,
	options: {
		onProgress?: (progress: UploadProgress) => void;
		signal?: AbortSignal;
	},
): Promise<void> {
	if (options.signal?.aborted) {
		throw new DOMException("Aborted", "AbortError");
	}
	if (!options.onProgress || shouldFallbackToFetchForDirectPut()) {
		options.onProgress?.({
			loaded: 0,
			total: file.size,
			percent: file.size > 0 ? 0 : null,
			phase: "uploading",
		});
		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: file,
			credentials: "omit",
			signal: options.signal,
		});
		if (!response.ok) {
			throw new ApiError(
				response.status,
				"STORAGE_DIRECT_UPLOAD_FAILED",
				`Direct upload to object storage failed (${response.status})`,
			);
		}
		options.onProgress?.({
			loaded: file.size,
			total: file.size,
			percent: 100,
			phase: "processing",
		});
		return;
	}

	await new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const signal = options.signal;
		const cleanup = () => {
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
		};
		const onAbort = () => xhr.abort();
		if (signal) {
			signal.addEventListener("abort", onAbort, { once: true });
		}

		xhr.open("PUT", url, true);
		xhr.withCredentials = false;
		for (const [key, value] of Object.entries(headers)) {
			xhr.setRequestHeader(key, value);
		}

		let lastTotal = file.size;
		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && event.total > 0) {
				lastTotal = event.total;
				options.onProgress?.({
					loaded: event.loaded,
					total: event.total,
					percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
					phase: "uploading",
				});
				return;
			}
			options.onProgress?.({
				loaded: event.loaded,
				total: 0,
				percent: null,
				phase: "uploading",
			});
		});

		xhr.upload.addEventListener("load", () => {
			options.onProgress?.({
				loaded: lastTotal,
				total: lastTotal,
				percent: 100,
				phase: "processing",
			});
		});

		xhr.addEventListener("load", () => {
			cleanup();
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
				return;
			}
			reject(
				new ApiError(
					xhr.status,
					"STORAGE_DIRECT_UPLOAD_FAILED",
					`Direct upload to object storage failed (${xhr.status})`,
				),
			);
		});

		xhr.addEventListener("error", () => {
			cleanup();
			reject(
				new ApiError(
					0,
					"STORAGE_DIRECT_UPLOAD_CORS",
					"Network or CORS error while uploading directly to object storage",
				),
			);
		});

		xhr.addEventListener("abort", () => {
			cleanup();
			reject(new DOMException("Aborted", "AbortError"));
		});

		options.onProgress?.({
			loaded: 0,
			total: file.size,
			percent: file.size > 0 ? 0 : null,
			phase: "uploading",
		});

		xhr.send(file);
	});
}

async function uploadMultipartToServer(
	file: Blob,
	purpose: string,
	filename: string,
	options: UploadMediaOptions,
): Promise<string> {
	const body = new FormData();
	if (file instanceof File && !options.filename) {
		body.append("file", file);
	} else {
		body.append("file", file, filename);
	}
	body.append("purpose", purpose);
	body.append("filename", filename);
	const asset = await api<{ id: string; storageProvider?: "local" | "s3" }>(
		"/media/upload",
		{
			method: "POST",
			body,
			signal: options.signal,
			onUploadProgress: options.onProgress,
		},
	);
	if (asset.storageProvider === "s3") {
		useRuntimeConfigStore.getState().apply({ storageMode: "s3" });
	}
	return asset.id;
}

/** 上传一个文件到媒体库，返回资源 id。OSS 模式下自动走客户端预签名直传。 */
export async function uploadMediaAsset(
	file: Blob,
	purpose: string,
	options: UploadMediaOptions = {},
): Promise<string> {
	assertMediaFileSize(file);
	const filename =
		options.filename ?? (file instanceof File ? file.name : "file");

	const storageMode = useRuntimeConfigStore.getState().storageMode;
	if (storageMode !== "s3") {
		return uploadMultipartToServer(file, purpose, filename, options);
	}

	const contentType = file.type?.trim() || "application/octet-stream";
	const presign = await api<PresignMediaUploadResponse>("/media/presign", {
		method: "POST",
		body: JSON.stringify({
			filename,
			size: file.size,
			contentType,
			purpose,
		}),
		signal: options.signal,
	});

	if (presign.mode === "local") {
		useRuntimeConfigStore.getState().apply({
			storageMode: "local",
			maxMediaUploadBytes: presign.maxUploadBytes,
		});
		return uploadMultipartToServer(file, purpose, filename, options);
	}

	await putDirectToOss(presign.uploadUrl, presign.headers, file, {
		onProgress: options.onProgress,
		signal: options.signal,
	});

	options.onProgress?.({
		loaded: file.size,
		total: file.size,
		percent: 100,
		phase: "processing",
	});

	const asset = await api<{ id: string }>("/media/complete", {
		method: "POST",
		body: JSON.stringify({
			uploadToken: presign.uploadToken,
		}),
		signal: options.signal,
	});
	return asset.id;
}
