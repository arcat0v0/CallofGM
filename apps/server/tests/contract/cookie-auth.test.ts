import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CreateUserUseCase,
	DrizzleIdentityRepository,
} from "@/modules/identity";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import {
	closeWs,
	listenTestApp,
	setupTestApp,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

function cookieOf(response: Response): string {
	const raw = response.headers.get("set-cookie") ?? "";
	return raw.split(";")[0] ?? "";
}

function connectWithCookie(url: string, cookie: string): Promise<WebSocket> {
	const { promise, resolve, reject } = Promise.withResolvers<WebSocket>();
	const ws = new WebSocket(url, { headers: cookie ? { Cookie: cookie } : {} });
	ws.onopen = () => resolve(ws);
	ws.onerror = (err) => reject(err);
	return promise;
}

describe("cookie-only player identity and WS handshake", () => {
	let ctx: TestContext;
	let server: TestServer;
	let cookie = "";

	beforeAll(async () => {
		ctx = await setupTestApp({
			players: [],
			characters: [{ id: "char-cookie", name: "曲奇调查员", kind: "pc" }],
		});
		server = listenTestApp(ctx.app);
	});

	afterAll(() => {
		server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	test("identity issues an httpOnly player cookie without exposing it in local storage", async () => {
		// PC 席位必须由 PL 账号持有：改用账号会话 cookie 验证 cookie-only 流程。
		const accountName = "cookie-player";
		const repo = new DrizzleIdentityRepository(ctx.container.db);
		if (!(await repo.findUserByUsernameNormalized(accountName))) {
			await new CreateUserUseCase(
				new UuidGenerator(),
				new SystemClock(),
				repo,
			).execute({
				username: accountName,
				password: "cookie-player-password",
				role: "pl",
			});
		}
		const identity = await ctx.app.handle(
			new Request("http://localhost/api/v1/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: accountName,
					password: "cookie-player-password",
				}),
			}),
		);
		expect(identity.status).toBe(200);
		const setCookie = identity.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("cogm_session=");
		expect(setCookie.toLowerCase()).toContain("httponly");
		cookie = cookieOf(identity);
	});

	test("claim and WS handshake succeed using only the cookie", async () => {
		const claim = await ctx.app.handle(
			new Request(`http://localhost/api/v1/sessions/${ctx.sessionId}/claim`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ role: "pc", characterId: "char-cookie" }),
			}),
		);
		expect(claim.status).toBe(200);

		const ws = await connectWithCookie(
			`ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
			cookie,
		);
		const { promise, resolve } = Promise.withResolvers<string>();
		ws.onmessage = (event) => resolve(JSON.parse(event.data as string).type);
		expect(await promise).toBe("snapshot");
		await closeWs(ws);
	});

	test("WS handshake without cookie or bearer is rejected", async () => {
		const accepted = await connectWithCookie(
			`ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
			"",
		).then(
			(ws) => {
				ws.close();
				return true;
			},
			() => false,
		);
		expect(accepted).toBe(false);
	});
});
