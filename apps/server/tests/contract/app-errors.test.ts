import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type App, createApp } from "@/app";
import { Container } from "@/bootstrap/container";

describe("Production createApp error mapping", () => {
	let container: Container;
	let app: App;

	beforeAll(async () => {
		process.env.DATABASE_URL = ":memory:";
		container = new Container();
		await container.startupService.startup();
		app = createApp(container);
	});

	afterAll(() => {
		container.dbContext.sqlite.close();
	});

	test("maps unmatched Elysia NOT_FOUND to stable 404 JSON with requestId before fallback", async () => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			const expectedRequestId = `req-${method.toLowerCase()}`;
			const response = await app.handle(
				new Request("http://localhost/api/v1/does-not-exist", {
					method,
					headers: { "x-request-id": expectedRequestId },
				}),
			);
			expect(response.status).toBe(404);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);
			const body = (await response.json()) as Record<string, unknown>;
			expect(body.code).toBe("NOT_FOUND");
			expect(body.message).toBe("Not found");
			expect(body.requestId).toBe(expectedRequestId);
		}

		const generatedRes = await app.handle(
			new Request("http://localhost/api/v1/does-not-exist", {
				method: "POST",
			}),
		);
		expect(generatedRes.status).toBe(404);
		const generatedBody = (await generatedRes.json()) as Record<
			string,
			unknown
		>;
		expect(generatedBody.code).toBe("NOT_FOUND");
		expect(typeof generatedBody.requestId).toBe("string");
		expect((generatedBody.requestId as string).length).toBeGreaterThan(0);
	});

	test("preserves AppError and validation mapping with requestId in createApp", async () => {
		const authRes = await app.handle(
			new Request("http://localhost/api/v1/auth/me", {
				headers: { "x-request-id": "req-auth-me" },
			}),
		);
		expect(authRes.status).toBe(401);
		const authBody = (await authRes.json()) as Record<string, unknown>;
		expect(authBody.code).toBe("AUTH_REQUIRED");
		expect(authBody.requestId).toBe("req-auth-me");

		const validationRes = await app.handle(
			new Request("http://localhost/api/v1/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-request-id": "req-login-val",
				},
				body: JSON.stringify({ username: "", password: "" }),
			}),
		);
		expect(validationRes.status).toBe(400);
		const validationBody = (await validationRes.json()) as Record<
			string,
			unknown
		>;
		expect(validationBody.code).toBe("VALIDATION_FAILED");
		expect(validationBody.requestId).toBe("req-login-val");
	});

	test("returns consistent 404 JSON for unknown GET, HEAD, and other methods under /api and /api/v1", async () => {
		for (const [method, path, requestId] of [
			["GET", "/api/v1/unknown", "req-get-v1-unknown"],
			["GET", "/api/unknown", "req-get-api-unknown"],
			["GET", "/api", "req-get-api-root"],
			["GET", "/api/v1", "req-get-api-v1-root"],
			["POST", "/api/v1/unknown", "req-post-v1-unknown"],
			["POST", "/api/unknown", "req-post-api-unknown"],
			["POST", "/api", "req-post-api-root"],
			["PUT", "/api/unknown", "req-put-api-unknown"],
			["PATCH", "/api/unknown", "req-patch-api-unknown"],
			["DELETE", "/api/unknown", "req-delete-api-unknown"],
		] as const) {
			const response = await app.handle(
				new Request(`http://localhost${path}`, {
					method,
					headers: { "x-request-id": requestId },
				}),
			);
			expect(response.status).toBe(404);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);
			const body = (await response.json()) as Record<string, unknown>;
			expect(body).toEqual({
				code: "NOT_FOUND",
				message: "Not found",
				requestId,
			});
		}

		const getBaseline = await app.handle(
			new Request("http://localhost/api/v1/unknown", {
				method: "GET",
				headers: { "x-request-id": "req-head-v1-unknown" },
			}),
		);
		const getBaselineBytes = new TextEncoder().encode(
			await getBaseline.text(),
		).byteLength;

		for (const [path, requestId] of [
			["/api/v1/unknown", "req-head-v1-unknown"],
			["/api/unknown", "req-head-api-unknown"],
			["/api", "req-head-api-root"],
		] as const) {
			const headRes = await app.handle(
				new Request(`http://localhost${path}`, {
					method: "HEAD",
					headers: { "x-request-id": requestId },
				}),
			);
			expect(headRes.status).toBe(404);
			expect(headRes.headers.get("content-type")).toContain("application/json");
			expect(Number(headRes.headers.get("content-length"))).toBeGreaterThan(0);
			if (path === "/api/v1/unknown") {
				expect(Number(headRes.headers.get("content-length"))).toBe(
					getBaselineBytes,
				);
			}
			expect(await headRes.text()).toBe("");
		}
	});

	test("does not consume valid API routes, static assets, or SPA routes outside /api", async () => {
		const versionRes = await app.handle(
			new Request("http://localhost/api/version"),
		);
		expect(versionRes.status).toBe(200);
		expect(versionRes.headers.get("content-type")).toContain(
			"application/json",
		);

		const clientDist = resolve(import.meta.dir, "../../../client/dist");
		const hasClientDist = existsSync(resolve(clientDist, "index.html"));

		for (const spaPath of ["/", "/gm/sessions", "/api-preview"]) {
			const spaRes = await app.handle(
				new Request(`http://localhost${spaPath}`),
			);
			if (hasClientDist) {
				expect(spaRes.status).toBe(200);
				expect(spaRes.headers.get("content-type")).toContain("text/html");
			} else {
				expect(spaRes.status).toBe(503);
			}
		}

		const assetsDir = resolve(clientDist, "assets");
		if (existsSync(assetsDir)) {
			const firstJs = readdirSync(assetsDir).find((name) =>
				name.endsWith(".js"),
			);
			if (firstJs) {
				const assetRes = await app.handle(
					new Request(`http://localhost/assets/${firstJs}`),
				);
				expect(assetRes.status).toBe(200);
				expect(assetRes.headers.get("content-type")).not.toContain(
					"application/json",
				);
			}
		}
	});

	test("preserves request logging path redaction for API requests", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		try {
			const res = await app.handle(
				new Request("http://localhost/api/v1/pl/invites/secret-token/unknown", {
					method: "GET",
					headers: { "x-request-id": "req-redact" },
				}),
			);
			expect(res.status).toBe(404);
			const logged = logSpy.mock.calls.map((args) => String(args[0]));
			expect(
				logged.some(
					(line) =>
						line.includes('"requestId":"req-redact"') &&
						line.includes('"path":"/api/v1/pl/invites/[redacted]/unknown"') &&
						!line.includes("secret-token"),
				),
			).toBe(true);
		} finally {
			logSpy.mockRestore();
		}
	});
});
