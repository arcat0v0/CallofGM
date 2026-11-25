import { VersionResponseSchema } from "@cogm/shared";
import { Elysia, NotFoundError } from "elysia";
import { extname, resolve, sep } from "path";
import { ZodError } from "zod";
import type { Container } from "./bootstrap/container";
import { createAdminRoutes, createTrashRoutes } from "./modules/admin";
import { createCatalogRoutes } from "./modules/catalog";
import { createCharactersRoutes } from "./modules/characters";
import { createIdentityRoutes } from "./modules/identity";
import { createMediaRoutes } from "./modules/media";
import { createMusicRoutes } from "./modules/music";
import { createRealtimeRoutes } from "./modules/realtime";
import { createRulesRoutes } from "./modules/rules";
import { createSessionsRoutes } from "./modules/sessions";
import { createSiteSettingsRoutes } from "./modules/site-settings";
import { createTemplatesRoutes } from "./modules/templates";
import { createThemeRoutes } from "./modules/themes";
import { createUiSettingsRoutes } from "./modules/ui-settings";
import { getServerBuildInfo } from "./platform/build-info";
import { AppError } from "./platform/errors/app-error";
import { logger, redactSensitivePath } from "./platform/logging/logger";
import { isAllowedOrigin } from "./platform/security/origin";

const clientDist = resolve(import.meta.dir, "../../client/dist");

/**
 * 非文件上传请求（JSON / 文本等）的请求体上限（2 MiB）。
 * 文件上传路由走 multipart/form-data 并由各自业务上限校验；
 * 此上限防止攻击者借助全局 maxRequestBodySize（1 GiB）向 JSON 接口灌入超大载荷触发内存 DoS。
 */
const MAX_NON_UPLOAD_BODY_BYTES = 2 * 1024 * 1024;

const SECURITY_HEADERS = {
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"X-Frame-Options": "SAMEORIGIN",
} as const;

function applySecurityHeaders(set: {
	headers: Record<string, string | number>;
}): void {
	set.headers["X-Content-Type-Options"] =
		SECURITY_HEADERS["X-Content-Type-Options"];
	set.headers["Referrer-Policy"] = SECURITY_HEADERS["Referrer-Policy"];
	set.headers["X-Frame-Options"] = SECURITY_HEADERS["X-Frame-Options"];
}

function isBinaryUploadContentType(contentType: string): boolean {
	const normalized = contentType.toLowerCase();
	return (
		normalized.includes("multipart/form-data") ||
		normalized.includes("application/octet-stream")
	);
}

async function readBoundedText(
	request: Request,
	maxBytes: number,
): Promise<string> {
	const declaredLength = Number(request.headers.get("content-length"));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		throw new AppError("PAYLOAD_TOO_LARGE", "Request body too large", 413);
	}
	if (!request.body) {
		return "";
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (!value) {
				continue;
			}
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel();
				throw new AppError("PAYLOAD_TOO_LARGE", "Request body too large", 413);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (total === 0) {
		return "";
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(merged);
}

function isApiPath(pathname: string): boolean {
	return pathname === "/api" || pathname.startsWith("/api/");
}

async function serveClient(pathname: string): Promise<Response> {
	const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
	const requested = resolve(clientDist, relativePath || "index.html");
	if (
		requested !== clientDist &&
		!requested.startsWith(`${clientDist}${sep}`)
	) {
		return new Response("Not Found", {
			status: 404,
			headers: { ...SECURITY_HEADERS },
		});
	}
	const asset = Bun.file(requested);
	if (relativePath && (await asset.exists())) {
		const headers: Record<string, string> = {
			...SECURITY_HEADERS,
			"Content-Type": asset.type || "application/octet-stream",
		};
		// Vite content-hashes everything under assets/ (including the
		// DeepFilterNet3 voice model), so those files never change in place.
		if (relativePath.startsWith("assets/")) {
			headers["Cache-Control"] = "public, max-age=31536000, immutable";
		}
		return new Response(asset, { headers });
	}
	if (relativePath && extname(relativePath))
		return new Response("Not Found", {
			status: 404,
			headers: { ...SECURITY_HEADERS },
		});
	const index = Bun.file(resolve(clientDist, "index.html"));
	return (await index.exists())
		? new Response(index, {
				headers: { ...SECURITY_HEADERS, "Cache-Control": "no-cache" },
			})
		: new Response("Client build not found", {
				status: 503,
				headers: { ...SECURITY_HEADERS },
			});
}

function applyCors(
	request: Request,
	set: { headers: Record<string, string | number> },
	container: Container,
): void {
	const origin = request.headers.get("origin");
	if (!origin) {
		return;
	}
	const security = container.siteSettings.getSecurityConfig();
	const allowed = security.corsOrigins;
	if (isAllowedOrigin(origin, allowed, request.url)) {
		set.headers["Access-Control-Allow-Origin"] = origin;
		set.headers["Access-Control-Allow-Credentials"] = "true";
		set.headers["Access-Control-Allow-Headers"] =
			"content-type, authorization, x-fingerprint";
		set.headers["Access-Control-Allow-Methods"] =
			"GET,POST,PUT,PATCH,DELETE,OPTIONS";
		set.headers["Vary"] = "Origin";
	}
}

export function createApp(
	container: Container,
	options: { serverBuildInfo?: ReturnType<typeof getServerBuildInfo> } = {},
) {
	const serverBuildInfo = options.serverBuildInfo ?? getServerBuildInfo();
	const app = new Elysia({
		serve: {
			// 为动态可配上限（最高 1024 MiB）与 multipart 表单头预留余量，实际大小由业务路由按运行期配置拒绝。
			maxRequestBodySize: 1_024 * 1024 * 1024 + 28 * 1024 * 1024,
		},
	})
		.derive(({ request }) => {
			const requestId =
				request.headers.get("x-request-id") || crypto.randomUUID();
			return { requestId };
		})
		.onRequest(({ request, set }) => {
			applySecurityHeaders(set);
			applyCors(request, set, container);
			const method = request.method.toUpperCase();
			if (
				method === "POST" ||
				method === "PUT" ||
				method === "PATCH" ||
				method === "DELETE"
			) {
				const contentType = request.headers.get("content-type") ?? "";
				if (!isBinaryUploadContentType(contentType)) {
					const declaredLength = Number(request.headers.get("content-length"));
					if (
						Number.isFinite(declaredLength) &&
						declaredLength > MAX_NON_UPLOAD_BODY_BYTES
					) {
						const requestId =
							request.headers.get("x-request-id") || crypto.randomUUID();
						const headers: Record<string, string> = {
							"Content-Type": "application/json",
							...SECURITY_HEADERS,
						};
						for (const [key, value] of Object.entries(set.headers)) {
							headers[key] = String(value);
						}
						return new Response(
							JSON.stringify({
								code: "PAYLOAD_TOO_LARGE",
								message: "Request body too large",
								requestId,
								metadata: {},
							}),
							{ status: 413, headers },
						);
					}
				}
			}
		})
		.onParse({ as: "global" }, async ({ request }, contentType) => {
			const normalized = contentType.toLowerCase();
			if (
				normalized.startsWith("application/json") ||
				normalized.endsWith("+json")
			) {
				if (!request.body) {
					return undefined;
				}
				const raw = await readBoundedText(request, MAX_NON_UPLOAD_BODY_BYTES);
				if (raw.trim() === "") {
					return null;
				}
				try {
					return JSON.parse(raw) as unknown;
				} catch {
					throw new AppError("VALIDATION_FAILED", "Invalid JSON body", 400);
				}
			}
			if (normalized.startsWith("text/")) {
				if (!request.body) {
					return undefined;
				}
				return readBoundedText(request, MAX_NON_UPLOAD_BODY_BYTES);
			}
		})
		.onBeforeHandle(({ request, requestId }) => {
			logger.info("http.request", {
				requestId,
				method: request.method,
				path: redactSensitivePath(new URL(request.url).pathname),
			});
		})
		.options("/*", ({ request, set }) => {
			applyCors(request, set, container);
			set.status = 204;
			return "";
		})
		.onError(({ error, code, request, set, ...rest }) => {
			const context = rest as Record<string, unknown>;
			const requestId =
				typeof context.requestId === "string"
					? context.requestId
					: request.headers.get("x-request-id") || crypto.randomUUID();

			const appError =
				error instanceof AppError
					? error
					: error instanceof Error && error.cause instanceof AppError
						? error.cause
						: null;

			if (appError) {
				set.status = appError.statusCode;
				if (
					appError.statusCode === 429 &&
					typeof appError.metadata.retryAfterSeconds === "number"
				) {
					set.headers["Retry-After"] = String(
						appError.metadata.retryAfterSeconds,
					);
				}
				return {
					code: appError.code,
					message: appError.message,
					requestId,
					metadata: appError.metadata,
				};
			}
			if (
				code === "VALIDATION" ||
				code === "PARSE" ||
				error instanceof ZodError
			) {
				set.status = 400;
				return {
					code: "VALIDATION_FAILED",
					message: "Invalid request",
					requestId,
				};
			}
			if (code === "NOT_FOUND") {
				set.status = 404;
				return {
					code: "NOT_FOUND",
					message: "Not found",
					requestId,
				};
			}
			const rawMessage = error instanceof Error ? error.message : String(error);
			if (rawMessage.includes("FOREIGN KEY constraint failed")) {
				set.status = 409;
				return {
					code: "RESOURCE_IN_USE",
					message:
						"Resource is referenced by other records and cannot be deleted",
					requestId,
				};
			}
			logger.error("unhandled http error", { requestId, err: error });
			set.status = 500;
			return {
				code: "INTERNAL_SERVER_ERROR",
				message: "An unexpected error occurred",
				requestId,
			};
		})
		.use(createIdentityRoutes(container))
		.use(createMediaRoutes(container))
		.use(createMusicRoutes(container))
		.use(createCatalogRoutes(container))
		.use(createCharactersRoutes(container))
		.use(createSessionsRoutes(container))
		.use(createRealtimeRoutes(container))
		.use(createThemeRoutes(container))
		.use(createAdminRoutes(container))
		.use(createTrashRoutes(container))
		.use(createRulesRoutes(container))
		.use(createTemplatesRoutes(container))
		.use(createUiSettingsRoutes(container))
		.use(createSiteSettingsRoutes(container, { serverBuildInfo }))
		.get("/api/version", ({ set }) => {
			set.headers["Cache-Control"] = "no-store";
			return VersionResponseSchema.parse({ server: serverBuildInfo });
		})
		.get("/api/health/live", () => ({ status: "live" }))
		.get("/api/health/ready", ({ set }) => {
			if (
				!container.startupService.isReady() ||
				!container.startupService.pingDatabase()
			) {
				set.status = 503;
				return { status: "service not ready" };
			}
			return { status: "ready" };
		})
		.get("/*", ({ request }) => {
			const pathname = new URL(request.url).pathname;
			if (isApiPath(pathname)) {
				throw new NotFoundError();
			}
			return serveClient(pathname);
		});

	return app;
}

export type App = ReturnType<typeof createApp>;
