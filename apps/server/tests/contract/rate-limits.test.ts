import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "@/app";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { modules, sessions } from "@/platform/db/schema";
import { AppError } from "@/platform/errors/app-error";
import { HttpLimits } from "@/platform/security/http-limits";
import { RateLimiter } from "@/platform/security/rate-limiter";
import { seedAccounts } from "../helpers/setup";

function buildApp(container: Container) {
	return new Elysia()
		.onError(({ error, set }) => {
			if (error instanceof AppError) {
				set.status = error.statusCode;
				return { code: error.code, message: error.message };
			}
		})
		.use(createIdentityRoutes(container));
}

function login(
	app: { handle(request: Request): Promise<Response> },
	password: string,
) {
	return app.handle(
		new Request("http://localhost/api/v1/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: "gm", password }),
		}),
	);
}

describe("HTTP rate limits", () => {
	let limitedContainer: Container;
	let isolatedContainer: Container;
	const gmPassword = "rate-limit-password";

	beforeAll(async () => {
		process.env.DATABASE_URL = ":memory:";
		limitedContainer = new Container();
		isolatedContainer = new Container();
		await limitedContainer.startupService.startup();
		await isolatedContainer.startupService.startup();
		await seedAccounts(limitedContainer.db, gmPassword);
		await seedAccounts(isolatedContainer.db, gmPassword);
	});

	afterAll(() => {
		limitedContainer.dbContext.sqlite.close();
		isolatedContainer.dbContext.sqlite.close();
	});

	test("login limiter rejects the 11th request with 429 RATE_LIMITED", async () => {
		const app = buildApp(limitedContainer);
		for (let i = 0; i < 10; i++) {
			const response = await login(app, gmPassword);
			expect(response.status).toBe(200);
		}
		const blocked = await login(app, gmPassword);
		expect(blocked.status).toBe(429);
		const body = (await blocked.json()) as { code: string };
		expect(body.code).toBe("RATE_LIMITED");
	});

	test("a separate container keeps its own limiter budget", async () => {
		const app = buildApp(isolatedContainer);
		const response = await login(app, gmPassword);
		expect(response.status).toBe(200);
	});

	test("identity 429 responses carry Retry-After and stay Chinese-copy friendly", async () => {
		process.env.DATABASE_URL = ":memory:";
		const bounded = new Container([], {
			httpLimits: new HttpLimits({ identity: new RateLimiter(1, 60_000) }),
		});
		await bounded.startupService.startup();
		try {
			const app = createApp(bounded);
			const identify = () =>
				app.handle(
					new Request("http://localhost/api/v1/player/identity", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ fingerprint: "retry-after-fp" }),
					}),
				);
			expect((await identify()).status).toBe(200);
			const blocked = await identify();
			expect(blocked.status).toBe(429);
			const retryAfter = Number(blocked.headers.get("Retry-After"));
			expect(Number.isInteger(retryAfter)).toBe(true);
			expect(retryAfter).toBeGreaterThanOrEqual(1);
			expect(retryAfter).toBeLessThanOrEqual(60);
			const body = (await blocked.json()) as {
				code: string;
				metadata: { retryAfterSeconds: number };
			};
			expect(body.code).toBe("RATE_LIMITED");
			expect(body.metadata.retryAfterSeconds).toBe(retryAfter);
		} finally {
			bounded.dbContext.sqlite.close();
		}
	});

	test("the default identity budget is 60 requests per minute per IP", () => {
		const limiter = new HttpLimits().identityRateLimiter;
		for (let i = 0; i < 60; i++) {
			expect(limiter.check("198.51.100.7")).toBe(true);
		}
		expect(limiter.check("198.51.100.7")).toBe(false);
		expect(limiter.check("198.51.100.8")).toBe(true);
	});

	test("session reference resolver has a separate 30/min limiter with reset and does not consume claim budget", async () => {
		const limits = new HttpLimits();
		const defaultLimiter = limits.sessionReferenceRateLimiter;
		for (let i = 0; i < 30; i++) {
			expect(defaultLimiter.check("198.51.100.9")).toBe(true);
		}
		expect(defaultLimiter.check("198.51.100.9")).toBe(false);
		expect(defaultLimiter.check("198.51.100.10")).toBe(true);
		limits.reset();
		expect(defaultLimiter.check("198.51.100.9")).toBe(true);

		process.env.DATABASE_URL = ":memory:";
		const bounded = new Container([], {
			httpLimits: new HttpLimits({
				sessionReference: new RateLimiter(2, 60_000),
				join: new RateLimiter(1, 60_000),
			}),
		});
		await bounded.startupService.startup();
		try {
			const seeded = await seedAccounts(bounded.db, gmPassword);
			const sessionUuid = "a1b2c3d4-0000-4000-8000-000000000001";
			await bounded.db.insert(modules).values({
				id: "module-rl",
				ownerId: seeded.gmUserId,
				name: "Rate Limit Module",
				description: "",
				ruleId: "coc7e",
				themeId: null,
				sourceTemplateId: null,
				sourceTemplateVersion: null,
				deletedAt: null,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			await bounded.db.insert(sessions).values({
				id: sessionUuid,
				ownerId: seeded.gmUserId,
				name: "Rate Limit Session",
				moduleId: "module-rl",
				ruleId: "coc7e",
				status: "waiting",
				phase: "free_discussion",
				currentSceneId: null,
				lastEventId: 0,
				sharePcSheets: 1,
				obSeePcState: 1,
				portraitLayout: "auto",
				portraitScale: "md",
				growthConfirmedAt: null,
				deletedAt: null,
				createdAt: Date.now(),
			});

			const app = createApp(bounded);
			const resolve = () =>
				app.handle(
					new Request(
						"http://localhost/api/v1/public/session-references/a1b2c3",
					),
				);

			expect((await resolve()).status).toBe(200);
			expect((await resolve()).status).toBe(200);
			const blockedResolve = await resolve();
			expect(blockedResolve.status).toBe(429);
			expect(((await blockedResolve.json()) as { code: string }).code).toBe(
				"RATE_LIMITED",
			);

			const identityRes = await app.handle(
				new Request("http://localhost/api/v1/player/identity", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ fingerprint: "fp-rl-ob" }),
				}),
			);
			const { token } = (await identityRes.json()) as { token: string };

			const claimOk = await app.handle(
				new Request(`http://localhost/api/v1/sessions/${sessionUuid}/claim`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ role: "ob" }),
				}),
			);
			expect(claimOk.status).toBe(200);

			const claimBlocked = await app.handle(
				new Request(`http://localhost/api/v1/sessions/${sessionUuid}/claim`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ role: "ob" }),
				}),
			);
			expect(claimBlocked.status).toBe(429);

			bounded.httpLimits.reset();
			expect((await resolve()).status).toBe(200);
		} finally {
			bounded.dbContext.sqlite.close();
		}
	});
});
