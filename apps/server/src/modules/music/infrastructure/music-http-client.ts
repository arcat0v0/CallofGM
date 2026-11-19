import { AppError } from "@/platform/errors/app-error";
import {
	MusicNotFoundError,
	MusicProviderError,
	MusicProviderResponseInvalidError,
	MusicProviderTimeoutError,
	MusicRangeInvalidError,
	MusicStreamTooLargeError,
	MusicUnavailableError,
} from "../domain/music-errors";
import type { MusicFetch } from "./official-music-service";
import type { MusicProviderAdapter } from "./provider-adapter";

export class MusicHttpClient {
	private readonly timeoutMs: number;
	private readonly maxBytes: number;

	constructor(
		private readonly fetchImpl: MusicFetch = fetch,
		options: { timeoutMs?: number; maxBytes?: number } = {},
	) {
		this.timeoutMs = options.timeoutMs ?? 10_000;
		this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
	}

	async fetchAudio(
		policy: Pick<
			MusicProviderAdapter,
			"referer" | "isAllowedAudioHost" | "isUnavailableRedirect"
		>,
		initialUrl: URL,
		range?: string,
	): Promise<Response> {
		if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
			throw new MusicRangeInvalidError();
		}
		let current = new URL(initialUrl);
		for (let redirect = 0; redirect < 5; redirect += 1) {
			if (!policy.isAllowedAudioHost(current.hostname)) {
				throw new MusicProviderResponseInvalidError();
			}
			if (current.protocol === "http:") {
				current.protocol = "https:";
			}
			if (
				current.protocol !== "https:" ||
				current.username ||
				current.password ||
				current.port
			) {
				throw new MusicProviderResponseInvalidError();
			}
			const response = await this.fetchWithTimeout(current, {
				redirect: "manual",
				headers: {
					...this.headers(policy.referer),
					accept: "audio/*",
					...(range ? { range } : {}),
				},
			});
			const contentRange = response.headers.get("content-range");
			const contentLength = response.headers.get("content-length");
			const acceptRanges = response.headers.get("accept-ranges");
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				await response.body?.cancel();
				const location = response.headers.get("location");
				if (!location) {
					throw new MusicProviderResponseInvalidError();
				}
				const next = new URL(location, current);
				if (policy.isUnavailableRedirect?.(next)) {
					throw new MusicUnavailableError();
				}
				current = next;
				continue;
			}
			if ([401, 403, 404, 451].includes(response.status)) {
				await response.body?.cancel();
				throw new MusicUnavailableError();
			}
			if (response.status === 416) {
				await response.body?.cancel();
				return new Response(null, {
					status: 416,
					headers: {
						...(contentRange ? { "content-range": contentRange } : {}),
						"cache-control": "no-store",
					},
				});
			}
			if (response.status !== 200 && response.status !== 206) {
				await response.body?.cancel();
				throw new MusicProviderError();
			}
			const contentType =
				response.headers.get("content-type")?.toLowerCase() ?? "";
			if (!contentType.startsWith("audio/")) {
				await response.body?.cancel();
				if (contentType.startsWith("text/html")) {
					throw new MusicUnavailableError();
				}
				throw new MusicProviderResponseInvalidError();
			}
			const length = Number(contentLength ?? 0);
			const rangeTotal = Number(contentRange?.match(/\/(\d+)$/)?.[1] ?? 0);
			if (length > this.maxBytes || rangeTotal > this.maxBytes) {
				await response.body?.cancel();
				throw new MusicStreamTooLargeError();
			}
			if (!response.body) {
				throw new MusicProviderResponseInvalidError();
			}
			return new Response(this.limitedBody(response.body), {
				status: response.status,
				headers: {
					"content-type": contentType,
					...(contentLength ? { "content-length": contentLength } : {}),
					...(contentRange ? { "content-range": contentRange } : {}),
					...(acceptRanges ? { "accept-ranges": acceptRanges } : {}),
					"cache-control": "no-store",
					"x-content-type-options": "nosniff",
				},
			});
		}
		throw new MusicProviderResponseInvalidError();
	}

	private limitedBody(
		body: ReadableStream<Uint8Array>,
	): ReadableStream<Uint8Array> {
		const reader = body.getReader();
		let bytes = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		return new ReadableStream<Uint8Array>({
			pull: async (controller) => {
				const timeout = Promise.withResolvers<never>();
				timer = setTimeout(
					() => timeout.reject(new MusicProviderTimeoutError()),
					this.timeoutMs,
				);
				try {
					const result = await Promise.race([reader.read(), timeout.promise]);
					bytes += result.value?.byteLength ?? 0;
					if (bytes > this.maxBytes) {
						throw new MusicStreamTooLargeError();
					}
					if (result.done) {
						controller.close();
					} else if (result.value) {
						controller.enqueue(result.value);
					}
				} catch (error) {
					await reader.cancel().catch(() => undefined);
					controller.error(error);
				} finally {
					clearTimeout(timer);
				}
			},
			cancel: async (reason) => {
				clearTimeout(timer);
				await reader.cancel(reason);
			},
		});
	}

	async requestJson(
		url: string | URL,
		init: RequestInit,
		notFoundError?: AppError,
	): Promise<unknown> {
		const response = await this.fetchWithTimeout(url, init);
		if (!response.ok) {
			await response.body?.cancel();
			if (response.status === 404) {
				throw notFoundError ?? new MusicNotFoundError();
			}
			throw new MusicProviderError();
		}
		try {
			return await response.json();
		} catch {
			throw new MusicProviderResponseInvalidError();
		}
	}

	private async fetchWithTimeout(
		url: string | URL,
		init: RequestInit,
	): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			return await this.fetchImpl(url, { ...init, signal: controller.signal });
		} catch (error) {
			if (controller.signal.aborted) {
				throw new MusicProviderTimeoutError();
			}
			if (error instanceof AppError) {
				throw error;
			}
			throw new MusicProviderError();
		} finally {
			clearTimeout(timer);
		}
	}

	headers(referer: string): Record<string, string> {
		return {
			"user-agent": "Mozilla/5.0",
			referer,
		};
	}
}
