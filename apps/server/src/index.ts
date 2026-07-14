import { Elysia } from "elysia";

const app = new Elysia().get("/api/health", () => ({ ok: true })).listen(3000);

console.log(`CoGM server running at http://${app.server?.hostname}:${app.server?.port}`);
