import { Elysia } from "elysia";
import { type Container } from "./bootstrap/container";
import { createIdentityRoutes } from "./modules/identity";
import { createMediaRoutes } from "./modules/media";
import { createCatalogRoutes } from "./modules/catalog";
import { createCharactersRoutes } from "./modules/characters";
import { createSessionsRoutes } from "./modules/sessions";
import { createRealtimeRoutes } from "./modules/realtime";
import { AppError } from "./platform/errors/app-error";
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
  if (relativePath && await asset.exists()) return new Response(asset);
  if (relativePath && extname(relativePath)) return new Response("Not Found", { status: 404 });
  const index = Bun.file(resolve(clientDist, "index.html"));
  return await index.exists()
    ? new Response(index, { headers: { "Cache-Control": "no-cache" } })
    : new Response("Client build not found", { status: 503 });
}

export function createApp(container: Container) {
  const app = new Elysia()
    .derive(({ request }) => {
      const requestId = crypto.randomUUID();
      return { requestId };
    })
    .onBeforeHandle(({ request, requestId }) => {
      console.log(`[HTTP] ${request.method} ${request.url} - RequestId: ${requestId}`);
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
          message: error.message,
          requestId,
        };
      }
      console.error(`[Unhandled Error] RequestId: ${requestId}`, error);
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
    .get("/api/health/live", () => ({ status: "live" }))
    .get("/api/health/ready", ({ set }) => {
      if (!container.startupService.isReady()) {
        set.status = 503;
        return { status: "service not ready" };
      }
      return { status: "ready" };
    })
    .get("/*", ({ request }) => serveClient(new URL(request.url).pathname));

  return app;
}

export type App = ReturnType<typeof createApp>;
