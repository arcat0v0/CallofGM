import { Elysia } from "elysia";
import { type Container } from "./bootstrap/container";
import { createIdentityRoutes } from "./modules/identity";
import { createMediaRoutes } from "./modules/media";
import { createCatalogRoutes } from "./modules/catalog";
import { createCharactersRoutes } from "./modules/characters";
import { createSessionsRoutes } from "./modules/sessions";
import { createRealtimeRoutes } from "./modules/realtime";
import { createThemeRoutes } from "./modules/themes";
import { createUiSettingsRoutes } from "./modules/ui-settings";
import { AppError } from "./platform/errors/app-error";
import { logger } from "./platform/logging/logger";
import { corsOriginsFor } from "./config/env";
import { isAllowedOrigin } from "./platform/security/origin";
import { extname, resolve, sep } from "path";

const clientDist = resolve(import.meta.dir, "../../client/dist");

async function serveClient(pathname: string): Promise<Response> {
  if (pathname.startsWith("/api/")) return new Response("Not Found", { status: 404 });
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const requested = resolve(clientDist, relativePath || "index.html");
  if (requested !== clientDist && !requested.startsWith(`${clientDist}${sep}`)) {
    return new Response("Not Found", { status: 404 });
  }
  const asset = Bun.file(requested);
  if (relativePath && await asset.exists()) {
    return new Response(asset, {
      headers: { "Content-Type": asset.type || "application/octet-stream" },
    });
  }
  if (relativePath && extname(relativePath)) return new Response("Not Found", { status: 404 });
  const index = Bun.file(resolve(clientDist, "index.html"));
  return await index.exists()
    ? new Response(index, { headers: { "Cache-Control": "no-cache" } })
    : new Response("Client build not found", { status: 503 });
}

function applyCors(request: Request, set: { headers: Record<string, string | number> }, container: Container): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }
  const allowed = corsOriginsFor(container.env);
  if (isAllowedOrigin(origin, allowed, request.url)) {
    set.headers["Access-Control-Allow-Origin"] = origin;
    set.headers["Access-Control-Allow-Credentials"] = "true";
    set.headers["Access-Control-Allow-Headers"] = "content-type, authorization, x-fingerprint";
    set.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
    set.headers["Vary"] = "Origin";
  }
}

export function createApp(container: Container) {
  const app = new Elysia()
    .derive(({ request }) => {
      const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
      return { requestId };
    })
    .onRequest(({ request, set }) => {
      applyCors(request, set, container);
    })
    .onBeforeHandle(({ request, requestId }) => {
      logger.info("http.request", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
      });
    })
    .options("/*", ({ request, set }) => {
      applyCors(request, set, container);
      set.status = 204;
      return "";
    })
    .onError(({ error, code, set, ...rest }) => {
      const context = rest as Record<string, unknown>;
      const requestId = typeof context.requestId === "string" ? context.requestId : crypto.randomUUID();

      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          code: error.code,
          message: error.message,
          requestId,
          metadata: error.metadata,
        };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          code: "VALIDATION_FAILED",
          message: "Invalid request",
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
    .use(createCatalogRoutes(container))
    .use(createCharactersRoutes(container))
    .use(createSessionsRoutes(container))
    .use(createRealtimeRoutes(container))
    .use(createThemeRoutes(container))
    .use(createUiSettingsRoutes(container))
    .get("/api/health/live", () => ({ status: "live" }))
    .get("/api/health/ready", ({ set }) => {
      if (!container.startupService.isReady() || !container.startupService.pingDatabase()) {
        set.status = 503;
        return { status: "service not ready" };
      }
      return { status: "ready" };
    })
    .get("/*", ({ request }) => serveClient(new URL(request.url).pathname));

  return app;
}

export type App = ReturnType<typeof createApp>;
