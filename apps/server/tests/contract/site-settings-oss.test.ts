import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	AdminSiteSettingsResponse,
	PresignMediaUploadResponse,
	StorageMigrationStatusDto,
	TestStorageConnectionResponse,
	ThemeManifest,
} from "@cogm/shared";
import { zipSync } from "fflate";
import { Container } from "@/bootstrap/container";
import { createApp } from "@/app";
import { siteSettings } from "@/platform/db/schema";
import { setupTestApp, type TestContext, testAppConfig } from "../helpers/setup";

interface MockS3Object {
	data: Uint8Array;
	contentType: string;
	cacheControl: string | null;
}

function startMockS3Server() {
	const store = new Map<string, MockS3Object>();
	const requests: Array<{ method: string; path: string; auth: string | null }> =
		[];

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const url = new URL(request.url);
			const pathname = decodeURIComponent(url.pathname);
			requests.push({
				method: request.method,
				path: pathname,
				auth: request.headers.get("authorization"),
			});

			// Path-style endpoint: /<bucket>/<key>
			// Custom CDN download path: /cdn/<key>
			const isCdn = pathname.startsWith("/cdn/");
			let key = "";
			if (isCdn) {
				key = pathname.slice("/cdn/".length);
			} else {
				const parts = pathname.replace(/^\/+/, "").split("/");
				if (parts.length < 2) {
					return new Response("Bad Request", { status: 400 });
				}
				key = parts.slice(1).join("/");
			}

			// Require SigV4 Authorization header or X-Amz-Signature on non-CDN S3 calls
			if (!isCdn) {
				const hasAuth =
					Boolean(request.headers.get("authorization")) ||
					Boolean(url.searchParams.get("X-Amz-Signature"));
				if (!hasAuth) {
					return new Response("<Error><Code>AccessDenied</Code></Error>", {
						status: 403,
					});
				}
			}

			if (request.method === "PUT") {
				const bytes = new Uint8Array(await request.arrayBuffer());
				store.set(key, {
					data: bytes,
					contentType:
						request.headers.get("content-type") ?? "application/octet-stream",
					cacheControl: request.headers.get("cache-control"),
				});
				return new Response(null, {
					status: 200,
					headers: { ETag: `"mock-etag-${bytes.byteLength}"` },
				});
			}

			if (request.method === "HEAD") {
				const obj = store.get(key);
				if (!obj) {
					return new Response(null, { status: 404 });
				}
				return new Response(null, {
					status: 200,
					headers: {
						"Content-Length": String(obj.data.byteLength),
						"Content-Type": obj.contentType,
						ETag: `"mock-etag-${obj.data.byteLength}"`,
					},
				});
			}

			if (request.method === "GET") {
				const obj = store.get(key);
				if (!obj) {
					return new Response("<Error><Code>NoSuchKey</Code></Error>", {
						status: 404,
					});
				}
				const range = request.headers.get("range");
				if (range) {
					const m = range.match(/^bytes=(\d+)-(\d+)$/);
					if (m) {
						const start = Number(m[1]);
						const end = Math.min(Number(m[2]), obj.data.byteLength - 1);
						const chunk = obj.data.subarray(start, end + 1);
						return new Response(chunk, {
							status: 206,
							headers: {
								"Content-Type": obj.contentType,
								"Content-Length": String(chunk.byteLength),
								"Content-Range": `bytes ${start}-${end}/${obj.data.byteLength}`,
							},
						});
					}
				}
				return new Response(obj.data, {
					status: 200,
					headers: {
						"Content-Type": obj.contentType,
						"Content-Length": String(obj.data.byteLength),
					},
				});
			}

			if (request.method === "DELETE") {
				store.delete(key);
				return new Response(null, { status: 204 });
			}

			return new Response("Method Not Allowed", { status: 405 });
		},
	});

	return {
		server,
		store,
		requests,
		endpoint: `http://127.0.0.1:${server.port}`,
		downloadBaseUrl: `http://127.0.0.1:${server.port}/cdn`,
	};
}

function buildThemeArchive(id: string, version: string, withPreview = true) {
	const bundle = new TextEncoder().encode(
		`export default { slots: {} }; // ${id}@${version}`,
	);
	const manifest: ThemeManifest = {
		formatVersion: 1,
		id,
		name: `Theme ${id}`,
		version,
		apiVersion: 1,
		entry: "bundle.js",
		styles: ["bundle.css"],
		defaultLocale: "zh-CN",
		locales: [],
		bundleHash: `sha256:${createHash("sha256").update(bundle).digest("hex")}`,
		signature: null,
	};
	const files: Record<string, Uint8Array> = {
		"theme.json": new TextEncoder().encode(JSON.stringify(manifest)),
		"bundle.js": bundle,
		"bundle.css": new TextEncoder().encode("body { color: inherit; }"),
	};
	if (withPreview) {
		files["preview.png"] = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
		]);
	}
	return zipSync(files);
}

describe("Site Settings & OSS S3 integration contract tests", () => {
	let ctx: TestContext;
	let mockS3: ReturnType<typeof startMockS3Server>;
	let tempRoot: string;
	let mediaDir: string;
	let themesDir: string;

	const pngBytes = new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1, 2, 3, 4, 5,
	]);

	function adminHeaders(extra: Record<string, string> = {}) {
		return {
			Authorization: `Bearer ${ctx.adminToken}`,
			"Content-Type": "application/json",
			...extra,
		};
	}

	function gmHeaders(extra: Record<string, string> = {}) {
		return {
			Authorization: `Bearer ${ctx.gmToken}`,
			...extra,
		};
	}

	beforeAll(async () => {
		tempRoot = await mkdtemp(join(tmpdir(), "cogm-oss-contract-"));
		mediaDir = join(tempRoot, "media");
		themesDir = join(tempRoot, "themes");
		mockS3 = startMockS3Server();
		ctx = await setupTestApp({
			gmPassword: "oss-test-password",
			mediaDir,
			themesDir,
			players: ["outsider"],
		});
	});

	afterAll(async () => {
		mockS3.server.stop(true);
		ctx.container.startupService.stop();
		ctx.container.dbContext.sqlite.close();
		await rm(tempRoot, { recursive: true, force: true });
	});

	test("enforces admin auth on /api/v1/admin/settings and exposes public runtime config", async () => {
		const anon = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings"),
		);
		expect(anon.status).toBe(401);

		const gmRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				headers: gmHeaders(),
			}),
		);
		expect(gmRes.status).toBe(403);

		const pubRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/public/runtime-config"),
		);
		expect(pubRes.status).toBe(200);
		const pubBody = (await pubRes.json()) as {
			storageMode: string;
			maxMediaUploadBytes: number;
		};
		expect(pubBody.storageMode).toBe("local");
		expect(pubBody.maxMediaUploadBytes).toBe(100 * 1024 * 1024);

		const adminRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				headers: adminHeaders(),
			}),
		);
		expect(adminRes.status).toBe(200);
		const settings = (await adminRes.json()) as AdminSiteSettingsResponse;
		expect(settings.storage.mode).toBe("local");
		expect(settings.system.mediaDir).toBe(mediaDir);
		expect(settings.system.themesDir).toBe(themesDir);
		expect(settings.overriddenSections).toEqual([]);
	});

	test("encrypts voice TURN secret at rest, masks on read, preserves on empty update, and rejects TURN without secret", async () => {
		const invalid = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders(),
				body: JSON.stringify({
					voice: {
						maxParticipants: 12,
						stunUrls: ["stun:stun.example.org:3478"],
						turnUrls: ["turns:turn.example.org:5349"],
						turnTtlSeconds: 900,
					},
				}),
			}),
		);
		expect(invalid.status).toBe(400);
		expect(((await invalid.json()) as { code: string }).code).toBe(
			"VOICE_CONFIG_INVALID",
		);

		const savedRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders(),
				body: JSON.stringify({
					voice: {
						maxParticipants: 12,
						stunUrls: ["stun:stun.example.org:3478"],
						turnUrls: ["turns:turn.example.org:5349"],
						turnRestSecret: "super-secret-turn-key-9999",
						turnTtlSeconds: 900,
					},
				}),
			}),
		);
		expect(savedRes.status).toBe(200);
		const saved = (await savedRes.json()) as AdminSiteSettingsResponse;
		expect(saved.voice.maxParticipants).toBe(12);
		expect(saved.voice.hasTurnRestSecret).toBe(true);
		expect(saved.voice.turnRestSecretMask).toBe("****9999");
		expect(JSON.stringify(saved)).not.toContain("super-secret-turn-key-9999");

		// Confirm DB stores ciphertext, not plaintext
		const rawRows = await ctx.container.db.select().from(siteSettings);
		const voiceRow = rawRows.find((r) => r.section === "voice");
		expect(voiceRow).toBeDefined();
		expect(voiceRow!.valueJson).not.toContain("super-secret-turn-key-9999");
		expect(ctx.container.siteSettings.getVoiceConfig().turnRestSecret).toBe(
			"super-secret-turn-key-9999",
		);

		// Empty secret preserves existing secret
		const preserveRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders(),
				body: JSON.stringify({
					voice: {
						maxParticipants: 16,
						stunUrls: ["stun:stun.example.org:3478"],
						turnUrls: ["turns:turn.example.org:5349"],
						turnTtlSeconds: 900,
					},
				}),
			}),
		);
		expect(preserveRes.status).toBe(200);
		expect(ctx.container.siteSettings.getVoiceConfig().maxParticipants).toBe(
			16,
		);
		expect(ctx.container.siteSettings.getVoiceConfig().turnRestSecret).toBe(
			"super-secret-turn-key-9999",
		);
	});

	test("prevents origin lockout when saving security settings and hot-reloads rate limits", async () => {
		const lockoutRes = await ctx.app.handle(
			new Request("http://localhost:15633/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders({ Origin: "http://localhost:15633" }),
				body: JSON.stringify({
					security: {
						trustProxy: false,
						corsOrigins: ["https://other-host.example.com"],
						rateLimits: {
							login: { limit: 10, windowSeconds: 60 },
							identity: { limit: 60, windowSeconds: 60 },
							join: { limit: 30, windowSeconds: 60 },
							sessionReference: { limit: 30, windowSeconds: 60 },
							upload: { limit: 20, windowSeconds: 60 },
						},
					},
				}),
			}),
		);
		expect(lockoutRes.status).toBe(400);
		expect(((await lockoutRes.json()) as { code: string }).code).toBe(
			"ORIGIN_LOCKOUT",
		);

		const okRes = await ctx.app.handle(
			new Request("http://localhost:15633/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders({ Origin: "http://localhost:15633" }),
				body: JSON.stringify({
					security: {
						trustProxy: false,
						corsOrigins: [
							"http://localhost:15633",
							"https://trpg.example.com",
						],
						rateLimits: {
							login: { limit: 15, windowSeconds: 60 },
							identity: { limit: 60, windowSeconds: 60 },
							join: { limit: 30, windowSeconds: 60 },
							sessionReference: { limit: 30, windowSeconds: 60 },
							upload: { limit: 25, windowSeconds: 60 },
						},
					},
				}),
			}),
		);
		expect(okRes.status).toBe(200);
		expect(ctx.container.httpLimits.loginRateLimiter.getConfig().limit).toBe(
			15,
		);
		expect(ctx.container.httpLimits.uploadRateLimiter.getConfig().limit).toBe(
			25,
		);
	});

	test("tests S3 connectivity and browser probe cleanup before saving", async () => {
		const testRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings/storage/test", {
				method: "POST",
				headers: adminHeaders(),
				body: JSON.stringify({
					s3: {
						endpoint: mockS3.endpoint,
						publicUploadEndpoint: "",
						region: "us-east-1",
						bucket: "cogm-test",
						forcePathStyle: true,
						keyPrefix: "trpg",
						accessKeyId: "test-ak",
						secretAccessKey: "test-sk-9876",
						downloadBaseUrl: mockS3.downloadBaseUrl,
						accessMode: "public",
						signedUrlTtlSeconds: 600,
					},
				}),
			}),
		);
		expect(testRes.status).toBe(200);
		const body = (await testRes.json()) as TestStorageConnectionResponse;
		expect(body.ok).toBe(true);
		expect(body.checks.putObject.ok).toBe(true);
		expect(body.checks.headObject.ok).toBe(true);
		expect(body.checks.rangeRead.ok).toBe(true);
		expect(body.checks.downloadDomain.ok).toBe(true);
		expect(body.checks.deleteObject.ok).toBe(true);
		expect(body.browserProbe).not.toBeNull();

		// Simulate browser direct PUT & GET + cleanup
		const putRes = await fetch(body.browserProbe!.uploadUrl, {
			method: "PUT",
			headers: body.browserProbe!.headers,
			body: body.browserProbe!.probeContent,
		});
		expect(putRes.status).toBe(200);

		const getRes = await fetch(body.browserProbe!.downloadUrl);
		expect(getRes.status).toBe(200);
		expect(await getRes.text()).toBe(body.browserProbe!.probeContent);

		const cleanupRes = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/admin/settings/storage/test-cleanup",
				{
					method: "POST",
					headers: adminHeaders(),
					body: JSON.stringify({ probeToken: body.browserProbe!.probeToken }),
				},
			),
		);
		expect(cleanupRes.status).toBe(200);
	});

	test("supports mixed local/OSS coexistence, client direct upload, magic-byte rejection, 302 public/private download, themes on OSS, and one-click migration", async () => {
		// 1. Seed one local media asset and one local theme BEFORE enabling OSS
		const localFd = new FormData();
		localFd.append("file", new Blob([pngBytes], { type: "image/png" }), "old.png");
		localFd.append("purpose", "scene");
		localFd.append("filename", "old.png");
		const localUploadRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/upload", {
				method: "POST",
				headers: gmHeaders(),
				body: localFd,
			}),
		);
		expect(localUploadRes.status).toBe(200);
		const localAsset = (await localUploadRes.json()) as {
			id: string;
			storageKey: string;
			storageProvider: string;
		};
		expect(localAsset.storageProvider).toBe("local");

		const localThemeArchive = buildThemeArchive("arcat.local-theme", "1.0.0");
		const localThemeForm = new FormData();
		localThemeForm.set(
			"file",
			new File([localThemeArchive], "local.cogmtheme", {
				type: "application/zip",
			}),
		);
		const localThemeRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/themes", {
				method: "POST",
				headers: { Authorization: `Bearer ${ctx.adminToken}` },
				body: localThemeForm,
			}),
		);
		expect(localThemeRes.status).toBe(200);

		// 2. Enable OSS via Admin Settings (public CDN mode)
		const enableOssRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders(),
				body: JSON.stringify({
					storage: {
						mode: "s3",
						maxMediaUploadMb: 20,
						maxThemeUploadMb: 30,
						s3: {
							endpoint: mockS3.endpoint,
							publicUploadEndpoint: mockS3.endpoint,
							region: "us-east-1",
							bucket: "cogm-test",
							forcePathStyle: true,
							keyPrefix: "site-a",
							accessKeyId: "test-ak",
							secretAccessKey: "test-sk-9876",
							downloadBaseUrl: mockS3.downloadBaseUrl,
							accessMode: "public",
							signedUrlTtlSeconds: 300,
						},
					},
				}),
			}),
		);
		expect(enableOssRes.status).toBe(200);

		// Public runtime config reflects s3 immediately
		const pubRuntime = await (
			await ctx.app.handle(
				new Request("http://localhost/api/v1/public/runtime-config"),
			)
		).json();
		expect(pubRuntime).toEqual({
			storageMode: "s3",
			maxMediaUploadBytes: 20 * 1024 * 1024,
			maxThemeUploadBytes: 30 * 1024 * 1024,
		});

		// Old local media still serves 200 directly from local disk
		const oldLocalGet = await ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${localAsset.id}`, {
				headers: gmHeaders(),
			}),
		);
		expect(oldLocalGet.status).toBe(200);
		expect((await oldLocalGet.arrayBuffer()).byteLength).toBe(pngBytes.byteLength);

		// 3. Client direct upload happy path (presign -> PUT to S3 -> complete)
		const presignRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/presign", {
				method: "POST",
				headers: gmHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					filename: "scene-oss.png",
					size: pngBytes.byteLength,
					contentType: "image/png",
					purpose: "scene",
				}),
			}),
		);
		expect(presignRes.status).toBe(200);
		const presign = (await presignRes.json()) as PresignMediaUploadResponse;
		expect(presign.mode).toBe("direct");
		if (presign.mode !== "direct") throw new Error("expected direct mode");

		const directPut = await fetch(presign.uploadUrl, {
			method: "PUT",
			headers: presign.headers,
			body: pngBytes,
		});
		expect(directPut.status).toBe(200);

		const completeRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/complete", {
				method: "POST",
				headers: gmHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ uploadToken: presign.uploadToken }),
			}),
		);
		expect(completeRes.status).toBe(200);
		const ossAsset = (await completeRes.json()) as {
			id: string;
			storageProvider: string;
			storageKey: string;
			mimeType: string;
		};
		expect(ossAsset.storageProvider).toBe("s3");
		expect(ossAsset.storageKey).toStartWith("site-a/media/");
		expect(ossAsset.storageKey).toEndWith(".png");
		expect(ossAsset.mimeType).toBe("image/png");

		// 4. Direct upload with disguised HTML is rejected AND deleted from S3
		const badBytes = new TextEncoder().encode("<html><script>alert(1)</script></html>");
		const badPresignRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/presign", {
				method: "POST",
				headers: gmHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					filename: "evil.png",
					size: badBytes.byteLength,
					contentType: "image/png",
					purpose: "handout",
				}),
			}),
		);
		const badPresign = (await badPresignRes.json()) as Extract<
			PresignMediaUploadResponse,
			{ mode: "direct" }
		>;
		await fetch(badPresign.uploadUrl, {
			method: "PUT",
			headers: badPresign.headers,
			body: badBytes,
		});
		const storeSizeBeforeReject = mockS3.store.size;
		const badComplete = await ctx.app.handle(
			new Request("http://localhost/api/v1/media/complete", {
				method: "POST",
				headers: gmHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ uploadToken: badPresign.uploadToken }),
			}),
		);
		expect(badComplete.status).toBe(400);
		expect(((await badComplete.json()) as { code: string }).code).toBe(
			"UNSUPPORTED_MIME_TYPE",
		);
		expect(mockS3.store.size).toBe(storeSizeBeforeReject - 1);

		// 5. Download permission enforcement + 302 redirect to custom domain (public mode)
		const outsiderToken = ctx.playerTokens.get("outsider")!;
		const forbiddenRes = await ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${ossAsset.id}`, {
				headers: { Authorization: `Bearer ${outsiderToken}` },
			}),
		);
		expect(forbiddenRes.status).toBe(403);

		const redirectRes = await ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${ossAsset.id}`, {
				headers: gmHeaders(),
			}),
		);
		expect(redirectRes.status).toBe(302);
		expect(redirectRes.headers.get("cache-control")).toBe("private, no-store");
		const publicLocation = redirectRes.headers.get("location")!;
		expect(publicLocation).toBe(
			`${mockS3.downloadBaseUrl}/${ossAsset.storageKey}`,
		);
		const fetchedFromCdn = await fetch(publicLocation);
		expect(fetchedFromCdn.status).toBe(200);
		expect(new Uint8Array(await fetchedFromCdn.arrayBuffer())).toEqual(pngBytes);

		// 6. Install a theme while OSS is active -> hosted on S3 & custom domain manifest
		const ossThemeArchive = buildThemeArchive("arcat.oss-theme", "1.0.0");
		const ossThemeForm = new FormData();
		ossThemeForm.set(
			"file",
			new File([ossThemeArchive], "oss.cogmtheme", { type: "application/zip" }),
		);
		const ossThemeInstall = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/themes", {
				method: "POST",
				headers: { Authorization: `Bearer ${ctx.adminToken}` },
				body: ossThemeForm,
			}),
		);
		expect(ossThemeInstall.status).toBe(200);
		const ossThemeSummary = (await ossThemeInstall.json()) as {
			storageProvider: string;
			previewUrl: string;
		};
		expect(ossThemeSummary.storageProvider).toBe("s3");
		expect(ossThemeSummary.previewUrl).toBe(
			`${mockS3.downloadBaseUrl}/site-a/themes/arcat.oss-theme/1.0.0/preview.png`,
		);

		const manifestRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/themes/arcat.oss-theme/manifest"),
		);
		expect(manifestRes.status).toBe(200);
		const manifest = (await manifestRes.json()) as ThemeManifest;
		expect(manifest.assetBaseUrl).toBe(
			`${mockS3.downloadBaseUrl}/site-a/themes/arcat.oss-theme/1.0.0/`,
		);

		const themeAssetRedirect = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/themes/arcat.oss-theme/versions/1.0.0/bundle.js",
			),
		);
		expect(themeAssetRedirect.status).toBe(302);
		expect(themeAssetRedirect.headers.get("location")).toBe(
			`${mockS3.downloadBaseUrl}/site-a/themes/arcat.oss-theme/1.0.0/bundle.js`,
		);

		// 7. Switch to private bucket mode -> 302 returns SigV4 presigned URLs and theme manifest omits assetBaseUrl
		await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings", {
				method: "PUT",
				headers: adminHeaders(),
				body: JSON.stringify({
					storage: {
						mode: "s3",
						maxMediaUploadMb: 20,
						maxThemeUploadMb: 30,
						s3: {
							endpoint: mockS3.endpoint,
							publicUploadEndpoint: mockS3.endpoint,
							region: "us-east-1",
							bucket: "cogm-test",
							forcePathStyle: true,
							keyPrefix: "site-a",
							accessKeyId: "test-ak",
							downloadBaseUrl: mockS3.downloadBaseUrl,
							accessMode: "private",
							signedUrlTtlSeconds: 180,
						},
					},
				}),
			}),
		);

		const privateMediaRedirect = await ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${ossAsset.id}`, {
				headers: gmHeaders(),
			}),
		);
		expect(privateMediaRedirect.status).toBe(302);
		const signedMediaUrl = new URL(privateMediaRedirect.headers.get("location")!);
		expect(signedMediaUrl.href).toStartWith(mockS3.downloadBaseUrl);
		expect(signedMediaUrl.searchParams.get("X-Amz-Expires")).toBe("180");
		expect(signedMediaUrl.searchParams.get("X-Amz-Signature")).toMatch(
			/^[0-9a-f]{64}$/,
		);

		const privateManifest = (await (
			await ctx.app.handle(
				new Request("http://localhost/api/v1/themes/arcat.oss-theme/manifest"),
			)
		).json()) as ThemeManifest;
		expect(privateManifest.assetBaseUrl).toBeUndefined();

		const privateThemeRedirect = await ctx.app.handle(
			new Request(
				"http://localhost/api/v1/themes/arcat.oss-theme/versions/1.0.0/bundle.js",
			),
		);
		expect(privateThemeRedirect.status).toBe(302);
		expect(privateThemeRedirect.headers.get("location")).toContain(
			"X-Amz-Signature=",
		);

		// 8. One-click migrate existing local media & local theme -> OSS (non-destructive)
		const migrateStartRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/settings/storage/migrate", {
				method: "POST",
				headers: adminHeaders(),
			}),
		);
		expect(migrateStartRes.status).toBe(200);
		const finalStatus =
			await ctx.container.storageMigration.waitForCompletion();
		expect(finalStatus.status).toBe("completed");
		expect(finalStatus.media.migrated).toBe(1);
		expect(finalStatus.media.failed).toBe(0);
		expect(finalStatus.themes.migrated).toBe(1);
		expect(finalStatus.themes.failed).toBe(0);

		const polledStatus = (await (
			await ctx.app.handle(
				new Request("http://localhost/api/v1/admin/settings/storage/migrate", {
					headers: adminHeaders(),
				}),
			)
		).json()) as StorageMigrationStatusDto;
		expect(polledStatus.status).toBe("completed");

		// Original local files remain untouched on disk
		expect(existsSync(join(mediaDir, localAsset.storageKey))).toBe(true);
		expect(
			existsSync(join(themesDir, "arcat.local-theme", "1.0.0", "bundle.js")),
		).toBe(true);

		// Migrated local media now redirects 302 to OSS
		const migratedMediaGet = await ctx.app.handle(
			new Request(`http://localhost/api/v1/media/${localAsset.id}`, {
				headers: gmHeaders(),
			}),
		);
		expect(migratedMediaGet.status).toBe(302);
		expect(migratedMediaGet.headers.get("location")).toContain(
			`site-a/media/${localAsset.id}.png`,
		);

		// Deleting OSS theme removes its objects from mock S3
		const deleteThemeRes = await ctx.app.handle(
			new Request("http://localhost/api/v1/admin/themes/arcat.oss-theme", {
				method: "DELETE",
				headers: { Authorization: `Bearer ${ctx.adminToken}` },
			}),
		);
		expect(deleteThemeRes.status).toBe(200);
		expect(
			mockS3.store.has("site-a/themes/arcat.oss-theme/1.0.0/bundle.js"),
		).toBe(false);
	});

	test("persists encrypted settings and S3 themes across server restarts", async () => {
		const restartDir = await mkdtemp(join(tmpdir(), "cogm-restart-"));
		const dbUrl = join(restartDir, "db.sqlite");
		const cfg = testAppConfig({
			databaseUrl: dbUrl,
			mediaDir: join(restartDir, "media"),
			themesDir: join(restartDir, "themes"),
		});
		const c1 = new Container([], { config: cfg });
		try {
			await c1.startupService.startup();
			await c1.siteSettings.updateSettings(
				{
					storage: {
						mode: "s3",
						maxMediaUploadMb: 42,
						maxThemeUploadMb: 25,
						s3: {
							endpoint: mockS3.endpoint,
							publicUploadEndpoint: "",
							region: "us-east-1",
							bucket: "cogm-restart",
							forcePathStyle: true,
							keyPrefix: "r1",
							accessKeyId: "restart-ak",
							secretAccessKey: "restart-sk-7777",
							downloadBaseUrl: mockS3.downloadBaseUrl,
							accessMode: "public",
							signedUrlTtlSeconds: 600,
						},
					},
				},
				new Request("http://localhost/api/v1/admin/settings", {
					method: "PUT",
				}),
				{ version: "test", commit: null, buildTime: null },
			);
			await c1.themeRegistry.install(
				buildThemeArchive("arcat.persisted", "1.0.0"),
			);
		} finally {
			c1.startupService.stop();
			c1.dbContext.sqlite.close();
		}

		// Re-open with a brand-new Container against the same SQLite + auto-generated keyfile
		const c2 = new Container([], { config: cfg });
		try {
			await c2.startupService.startup();
			expect(c2.siteSettings.getStorageConfig().mode).toBe("s3");
			expect(c2.siteSettings.getStorageConfig().maxMediaUploadMb).toBe(42);
			expect(c2.siteSettings.getStorageConfig().s3.secretAccessKey).toBe(
				"restart-sk-7777",
			);
			await c2.themeRegistry.ready();
			expect(c2.themeRegistry.has("arcat.persisted")).toBe(true);
			expect(c2.themeRegistry.resolveManifest("arcat.persisted")?.assetBaseUrl).toBe(
				`${mockS3.downloadBaseUrl}/r1/themes/arcat.persisted/1.0.0/`,
			);
			const app2 = createApp(c2);
			const res = await app2.handle(
				new Request("http://localhost/api/v1/public/runtime-config"),
			);
			expect(res.status).toBe(200);
			expect(((await res.json()) as { storageMode: string }).storageMode).toBe(
				"s3",
			);
		} finally {
			c2.startupService.stop();
			c2.dbContext.sqlite.close();
			await rm(restartDir, { recursive: true, force: true });
		}
	});
});
