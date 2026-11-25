import { errorCopy } from "./error-copy";
import { getFingerprint } from "./fingerprint";

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly serverMessage: string,
	) {
		super(errorCopy({ code, status }));
		this.name = "ApiError";
	}
}

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

export function mediaUrl(assetId: string | null | undefined): string | null {
	if (!assetId) {
		return null;
	}
	return `/api/v1/media/${encodeURIComponent(assetId)}`;
}

export function unwrapItems<T>(value: unknown): T[] {
	if (Array.isArray(value)) {
		return value as T[];
	}
	if (
		value &&
		typeof value === "object" &&
		Array.isArray((value as { items?: unknown }).items)
	) {
		return (value as { items: T[] }).items;
	}
	return [];
}

export type CursorPage<T> = {
	items: T[];
	nextCursor: string | null;
};

async function parseError(response: Response): Promise<ApiError> {
	try {
		const body = (await response.json()) as { code?: string; message?: string };
		return new ApiError(
			response.status,
			body.code ?? "ERROR",
			body.message ?? response.statusText,
		);
	} catch {
		return new ApiError(response.status, "ERROR", response.statusText);
	}
}

function normalizePath(path: string): string {
	if (path.startsWith("/api/")) {
		return path;
	}
	return `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

export type UploadProgress = {
	loaded: number;
	total: number;
	/** 0–100 when total bytes is computable, null otherwise */
	percent: number | null;
	/** "uploading": transferring bytes; "processing": all bytes sent, awaiting server response */
	phase: "uploading" | "processing";
};

export type ApiRequestInit = RequestInit & {
	fingerprint?: boolean;
	onUploadProgress?: (progress: UploadProgress) => void;
};

function estimateBodyBytes(body: RequestInit["body"]): number {
	if (!body) {
		return 0;
	}
	if (body instanceof Blob) {
		return body.size;
	}
	if (typeof body === "string") {
		return new TextEncoder().encode(body).byteLength;
	}
	if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
		return body.byteLength;
	}
	if (body instanceof FormData) {
		let total = 0;
		for (const [, entry] of body.entries()) {
			const value: unknown = entry;
			if (value instanceof Blob) {
				total += value.size;
			} else {
				total += new TextEncoder().encode(String(value)).byteLength;
			}
		}
		return total;
	}
	return 0;
}

function parseXhrError(xhr: XMLHttpRequest): ApiError {
	try {
		const body = JSON.parse(xhr.responseText) as {
			code?: string;
			message?: string;
		};
		return new ApiError(
			xhr.status,
			body.code ?? "ERROR",
			body.message ?? xhr.statusText,
		);
	} catch {
		return new ApiError(xhr.status, "ERROR", xhr.statusText);
	}
}

function shouldFallbackToFetchForUpload(): boolean {
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

function uploadWithXhr<T>(
	url: string,
	requestInit: RequestInit,
	headers: Headers,
	onUploadProgress: (progress: UploadProgress) => void,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const signal = requestInit.signal;
		if (signal?.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}
		const xhr = new XMLHttpRequest();
		const method = (requestInit.method ?? "GET").toUpperCase();
		const bodySizeHint = estimateBodyBytes(requestInit.body);
		let lastTotal = bodySizeHint;

		const cleanup = () => {
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
		};
		const onAbort = () => {
			xhr.abort();
		};
		if (signal) {
			signal.addEventListener("abort", onAbort, { once: true });
		}

		xhr.open(method, url, true);
		xhr.withCredentials = true;
		headers.forEach((value, key) => {
			xhr.setRequestHeader(key, value);
		});

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && event.total > 0) {
				lastTotal = event.total;
				onUploadProgress({
					loaded: event.loaded,
					total: event.total,
					percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
					phase: "uploading",
				});
				return;
			}
			onUploadProgress({
				loaded: event.loaded,
				total: 0,
				percent: null,
				phase: "uploading",
			});
		});

		xhr.upload.addEventListener("load", () => {
			onUploadProgress({
				loaded: lastTotal,
				total: lastTotal,
				percent: 100,
				phase: "processing",
			});
		});

		xhr.addEventListener("load", () => {
			cleanup();
			if (xhr.status < 200 || xhr.status >= 300) {
				reject(parseXhrError(xhr));
				return;
			}
			if (xhr.status === 204) {
				resolve(undefined as T);
				return;
			}
			const contentType = xhr.getResponseHeader("content-type") ?? "";
			if (!contentType.includes("application/json")) {
				resolve(undefined as T);
				return;
			}
			try {
				resolve(JSON.parse(xhr.responseText) as T);
			} catch {
				resolve(undefined as T);
			}
		});

		xhr.addEventListener("error", () => {
			cleanup();
			reject(new TypeError("Network error"));
		});

		xhr.addEventListener("abort", () => {
			cleanup();
			reject(new DOMException("Aborted", "AbortError"));
		});

		onUploadProgress({
			loaded: 0,
			total: bodySizeHint,
			percent: bodySizeHint > 0 ? 0 : null,
			phase: "uploading",
		});

		xhr.send((requestInit.body ?? null) as XMLHttpRequestBodyInit | null);
	});
}

export async function api<T>(
	path: string,
	init: ApiRequestInit = {},
): Promise<T> {
	const {
		fingerprint: withFingerprint = false,
		onUploadProgress,
		...requestInit
	} = init;
	const headers = new Headers(requestInit.headers);
	if (withFingerprint) {
		headers.set("X-Fingerprint", await getFingerprint());
	}
	if (
		requestInit.body &&
		!(requestInit.body instanceof FormData) &&
		!headers.has("Content-Type")
	) {
		headers.set("Content-Type", "application/json");
	}

	if (onUploadProgress) {
		if (!shouldFallbackToFetchForUpload()) {
			return await uploadWithXhr<T>(
				normalizePath(path),
				requestInit,
				headers,
				onUploadProgress,
			);
		}
		onUploadProgress({
			loaded: 0,
			total: estimateBodyBytes(requestInit.body),
			percent: null,
			phase: "uploading",
		});
	}

	const response = await fetch(normalizePath(path), {
		credentials: "include",
		...requestInit,
		headers,
	});
	if (!response.ok) {
		throw await parseError(response);
	}
	if (response.status === 204) {
		return undefined as T;
	}
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return undefined as T;
	}
	return (await response.json()) as T;
}

export async function fetchAllPages<T>(
	path: string,
	init?: RequestInit,
): Promise<T[]> {
	const queryIndex = path.indexOf("?");
	const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
	const params = new URLSearchParams(
		queryIndex >= 0 ? path.slice(queryIndex + 1) : "",
	);
	params.set("limit", "100");
	params.delete("cursor");

	const collected: T[] = [];
	for (;;) {
		const page = await api<CursorPage<T> | T[]>(
			`${pathname}?${params.toString()}`,
			init,
		);
		if (Array.isArray(page)) {
			collected.push(...page);
			break;
		}
		if (!page || !Array.isArray(page.items)) {
			break;
		}
		collected.push(...page.items);
		if (!page.nextCursor || page.nextCursor === params.get("cursor")) {
			break;
		}
		params.set("cursor", page.nextCursor);
	}
	return collected;
}
