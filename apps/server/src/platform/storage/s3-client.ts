import { createHash, createHmac } from "node:crypto";

export interface S3ClientConfig {
	endpoint: string;
	publicUploadEndpoint?: string;
	region: string;
	bucket: string;
	forcePathStyle: boolean;
	keyPrefix: string;
	accessKeyId: string;
	secretAccessKey: string;
	downloadBaseUrl: string;
	accessMode: "public" | "private";
	signedUrlTtlSeconds: number;
}

export interface S3HeadResult {
	contentLength: number;
	contentType: string | null;
	etag: string | null;
}

export interface S3PresignedPutResult {
	url: string;
	headers: Record<string, string>;
	expiresAt: number;
}

export class S3RequestError extends Error {
	constructor(
		message: string,
		readonly statusCode: number,
		readonly s3Code?: string,
	) {
		super(message);
		this.name = "S3RequestError";
	}
}

const MIME_EXTENSIONS: Record<string, string> = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/gif": ".gif",
	"image/webp": ".webp",
	"image/svg+xml": ".svg",
	"audio/mpeg": ".mp3",
	"audio/wav": ".wav",
	"audio/ogg": ".ogg",
	"audio/flac": ".flac",
	"audio/mp4": ".m4a",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export function extensionForMimeType(
	mimeType: string,
	filename?: string,
): string {
	const mapped = MIME_EXTENSIONS[mimeType.toLowerCase()];
	if (mapped) {
		return mapped;
	}
	if (filename) {
		const match = filename.match(/(\.[a-zA-Z0-9]{1,8})$/);
		if (match?.[1]) {
			return match[1].toLowerCase();
		}
	}
	return "";
}

export function normalizeKeyPrefix(raw: string): string {
	const cleaned = raw
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
	return cleaned ? `${cleaned}/` : "";
}

export function joinObjectKey(prefix: string, ...parts: string[]): string {
	const normalizedPrefix = normalizeKeyPrefix(prefix);
	const tail = parts
		.map((part) => part.replace(/^\/+/, "").replace(/\/+$/, ""))
		.filter((part) => part.length > 0)
		.join("/");
	return `${normalizedPrefix}${tail}`;
}

export function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replace(
		/[!'()*]/g,
		(ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function encodeObjectPath(key: string): string {
	return key
		.replace(/^\/+/, "")
		.split("/")
		.map((segment) => encodeRfc3986(segment))
		.join("/");
}

function sha256Hex(data: Uint8Array | string): string {
	return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
	return createHmac("sha256", key).update(data, "utf8").digest();
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
	const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
	return {
		amzDate: iso,
		dateStamp: iso.slice(0, 8),
	};
}

function deriveSigningKey(
	secretAccessKey: string,
	dateStamp: string,
	region: string,
): Buffer {
	const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
	const kRegion = hmacSha256(kDate, region);
	const kService = hmacSha256(kRegion, "s3");
	return hmacSha256(kService, "aws4_request");
}

function extractS3ErrorCode(bodyText: string): string | undefined {
	const match = bodyText.match(/<Code>([^<]+)<\/Code>/i);
	return match?.[1]?.trim() || undefined;
}

function buildTargetUrl(
	endpointRaw: string,
	bucket: string,
	key: string,
	forcePathStyle: boolean,
): URL {
	const base = new URL(endpointRaw);
	const basePath = base.pathname.replace(/\/+$/, "");
	const encodedKey = encodeObjectPath(key);

	if (forcePathStyle) {
		const url = new URL(base.origin);
		url.pathname = `${basePath}/${encodeRfc3986(bucket)}/${encodedKey}`;
		return url;
	}

	const hostPrefix = `${bucket}.`;
	const host = base.host.toLowerCase().startsWith(hostPrefix.toLowerCase())
		? base.host
		: `${bucket}.${base.host}`;
	const url = new URL(`${base.protocol}//${host}`);
	url.pathname = `${basePath}/${encodedKey}`;
	return url;
}

function buildCustomDomainUrl(baseUrlRaw: string, key: string): URL {
	const base = new URL(baseUrlRaw);
	const basePath = base.pathname.replace(/\/+$/, "");
	const encodedKey = encodeObjectPath(key);
	const url = new URL(base.origin);
	url.pathname = `${basePath}/${encodedKey}`;
	return url;
}

export class S3CompatibleClient {
	private readonly region: string;
	private readonly fetchImpl: typeof fetch;

	constructor(
		readonly config: S3ClientConfig,
		fetchImpl: typeof fetch = fetch,
	) {
		this.region = config.region.trim() || "us-east-1";
		this.fetchImpl = fetchImpl;
	}

	buildPublicUrl(key: string): string {
		const base = this.config.downloadBaseUrl.trim();
		if (base) {
			return buildCustomDomainUrl(base, key).href;
		}
		return buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		).href;
	}

	buildPublicPrefixUrl(prefixPath: string): string {
		const cleaned = prefixPath.replace(/^\/+/, "").replace(/\/+$/, "");
		const base = this.config.downloadBaseUrl.trim();
		if (base) {
			const url = buildCustomDomainUrl(base, cleaned);
			return url.href.endsWith("/") ? url.href : `${url.href}/`;
		}
		const url = buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			cleaned,
			this.config.forcePathStyle,
		);
		return url.href.endsWith("/") ? url.href : `${url.href}/`;
	}

	presignPutUrl(
		key: string,
		options: {
			contentType: string;
			expiresInSeconds?: number;
			usePublicUploadEndpoint?: boolean;
			now?: Date;
		},
	): S3PresignedPutResult {
		const endpoint =
			options.usePublicUploadEndpoint && this.config.publicUploadEndpoint?.trim()
				? this.config.publicUploadEndpoint.trim()
				: this.config.endpoint;
		const target = buildTargetUrl(
			endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		);
		const expiresIn = Math.max(
			60,
			Math.min(86_400, Math.round(options.expiresInSeconds ?? 900)),
		);
		const now = options.now ?? new Date();
		const signed = this.presignUrl("PUT", target, {
			expiresInSeconds: expiresIn,
			now,
			extraSignedHeaders: {
				"content-type": options.contentType,
			},
		});
		return {
			url: signed,
			headers: {
				"Content-Type": options.contentType,
			},
			expiresAt: now.getTime() + expiresIn * 1000,
		};
	}

	presignGetUrl(
		key: string,
		options: {
			expiresInSeconds?: number;
			useCustomDownloadDomain?: boolean;
			now?: Date;
		} = {},
	): string {
		const useCustom = options.useCustomDownloadDomain ?? true;
		const customBase = this.config.downloadBaseUrl.trim();
		const target =
			useCustom && customBase
				? buildCustomDomainUrl(customBase, key)
				: buildTargetUrl(
						this.config.endpoint,
						this.config.bucket,
						key,
						this.config.forcePathStyle,
					);
		const expiresIn = Math.max(
			60,
			Math.min(
				86_400,
				Math.round(
					options.expiresInSeconds ?? this.config.signedUrlTtlSeconds,
				),
			),
		);
		return this.presignUrl("GET", target, {
			expiresInSeconds: expiresIn,
			now: options.now ?? new Date(),
		});
	}

	async putObject(
		key: string,
		data: Uint8Array,
		options: {
			contentType: string;
			cacheControl?: string;
			timeoutMs?: number;
		},
	): Promise<void> {
		const target = buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		);
		const extraHeaders: Record<string, string> = {
			"content-type": options.contentType,
		};
		if (options.cacheControl) {
			extraHeaders["cache-control"] = options.cacheControl;
		}
		const headers = this.signHeaders("PUT", target, data, extraHeaders);
		const response = await this.fetchImpl(target.href, {
			method: "PUT",
			headers,
			body: data,
			signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			const s3Code = extractS3ErrorCode(text);
			throw new S3RequestError(
				`S3 PutObject failed (${response.status}${s3Code ? `: ${s3Code}` : ""})`,
				response.status,
				s3Code,
			);
		}
	}

	async headObject(
		key: string,
		options: { timeoutMs?: number } = {},
	): Promise<S3HeadResult | null> {
		const target = buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		);
		const headers = this.signHeaders("HEAD", target, "");
		const response = await this.fetchImpl(target.href, {
			method: "HEAD",
			headers,
			signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
		});
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw new S3RequestError(
				`S3 HeadObject failed (${response.status})`,
				response.status,
			);
		}
		const rawLen = response.headers.get("content-length");
		const contentLength = rawLen ? Number(rawLen) : 0;
		return {
			contentLength: Number.isFinite(contentLength) ? contentLength : 0,
			contentType: response.headers.get("content-type"),
			etag: response.headers.get("etag"),
		};
	}

	async getObjectRange(
		key: string,
		start: number,
		end: number,
		options: { timeoutMs?: number } = {},
	): Promise<Uint8Array> {
		const target = buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		);
		const rangeHeader = `bytes=${Math.max(0, start)}-${Math.max(0, end)}`;
		const headers = this.signHeaders("GET", target, "", {
			range: rangeHeader,
		});
		const response = await this.fetchImpl(target.href, {
			method: "GET",
			headers,
			signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
		});
		if (response.status !== 200 && response.status !== 206) {
			const text = await response.text().catch(() => "");
			const s3Code = extractS3ErrorCode(text);
			throw new S3RequestError(
				`S3 GetObject Range failed (${response.status}${s3Code ? `: ${s3Code}` : ""})`,
				response.status,
				s3Code,
			);
		}
		return new Uint8Array(await response.arrayBuffer());
	}

	async deleteObject(
		key: string,
		options: { timeoutMs?: number } = {},
	): Promise<void> {
		const target = buildTargetUrl(
			this.config.endpoint,
			this.config.bucket,
			key,
			this.config.forcePathStyle,
		);
		const headers = this.signHeaders("DELETE", target, "");
		const response = await this.fetchImpl(target.href, {
			method: "DELETE",
			headers,
			signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
		});
		if (response.status === 404) {
			return;
		}
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			const s3Code = extractS3ErrorCode(text);
			throw new S3RequestError(
				`S3 DeleteObject failed (${response.status}${s3Code ? `: ${s3Code}` : ""})`,
				response.status,
				s3Code,
			);
		}
	}

	private signHeaders(
		method: string,
		url: URL,
		payload: Uint8Array | string,
		extraHeaders: Record<string, string> = {},
		now = new Date(),
	): Record<string, string> {
		const { amzDate, dateStamp } = formatAmzDate(now);
		const payloadHash = sha256Hex(payload);

		const normalizedHeaders: Record<string, string> = {
			host: url.host,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
		};
		for (const [k, v] of Object.entries(extraHeaders)) {
			normalizedHeaders[k.toLowerCase()] = v.trim();
		}

		const sortedKeys = Object.keys(normalizedHeaders).sort();
		const canonicalHeaders = sortedKeys
			.map((key) => `${key}:${normalizedHeaders[key]}\n`)
			.join("");
		const signedHeaders = sortedKeys.join(";");
		const canonicalQuery = this.canonicalQueryString(url.searchParams);
		const canonicalRequest = [
			method,
			url.pathname || "/",
			canonicalQuery,
			canonicalHeaders,
			signedHeaders,
			payloadHash,
		].join("\n");

		const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			credentialScope,
			sha256Hex(canonicalRequest),
		].join("\n");

		const signingKey = deriveSigningKey(
			this.config.secretAccessKey,
			dateStamp,
			this.region,
		);
		const signature = hmacSha256(signingKey, stringToSign).toString("hex");

		const out: Record<string, string> = {};
		for (const key of sortedKeys) {
			if (key !== "host") {
				out[key] = normalizedHeaders[key]!;
			}
		}
		out.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
		return out;
	}

	private presignUrl(
		method: string,
		target: URL,
		options: {
			expiresInSeconds: number;
			now: Date;
			extraSignedHeaders?: Record<string, string>;
		},
	): string {
		const url = new URL(target.href);
		const { amzDate, dateStamp } = formatAmzDate(options.now);
		const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

		const headerMap: Record<string, string> = {
			host: url.host,
		};
		for (const [k, v] of Object.entries(options.extraSignedHeaders ?? {})) {
			headerMap[k.toLowerCase()] = v.trim();
		}
		const sortedHeaderKeys = Object.keys(headerMap).sort();
		const canonicalHeaders = sortedHeaderKeys
			.map((key) => `${key}:${headerMap[key]}\n`)
			.join("");
		const signedHeaders = sortedHeaderKeys.join(";");

		url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
		url.searchParams.set(
			"X-Amz-Credential",
			`${this.config.accessKeyId}/${credentialScope}`,
		);
		url.searchParams.set("X-Amz-Date", amzDate);
		url.searchParams.set("X-Amz-Expires", String(options.expiresInSeconds));
		url.searchParams.set("X-Amz-SignedHeaders", signedHeaders);

		const canonicalQuery = this.canonicalQueryString(url.searchParams);
		const canonicalRequest = [
			method,
			url.pathname || "/",
			canonicalQuery,
			canonicalHeaders,
			signedHeaders,
			"UNSIGNED-PAYLOAD",
		].join("\n");

		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			credentialScope,
			sha256Hex(canonicalRequest),
		].join("\n");

		const signingKey = deriveSigningKey(
			this.config.secretAccessKey,
			dateStamp,
			this.region,
		);
		const signature = hmacSha256(signingKey, stringToSign).toString("hex");
		return `${url.origin}${url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
	}

	private canonicalQueryString(params: URLSearchParams): string {
		const entries: Array<[string, string]> = [];
		for (const [k, v] of params.entries()) {
			entries.push([encodeRfc3986(k), encodeRfc3986(v)]);
		}
		entries.sort(([k1, v1], [k2, v2]) =>
			k1 === k2 ? (v1 < v2 ? -1 : v1 > v2 ? 1 : 0) : k1 < k2 ? -1 : 1,
		);
		return entries.map(([k, v]) => `${k}=${v}`).join("&");
	}
}
