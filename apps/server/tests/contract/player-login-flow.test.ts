import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ClaimDto, JoinInfoResponse, LoginResponse } from "@cogm/shared";
import { createApp } from "@/app";
import {
	CreateUserUseCase,
	DrizzleIdentityRepository,
	SESSION_COOKIE,
} from "@/modules/identity";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import { seedPlayers, setupTestApp, type TestContext } from "../helpers/setup";

const PASSWORD = "player-login-flow-password";

function cookieOf(response: Response, name: string): string {
	const cookies = response.headers.getSetCookie?.() ?? [];
	const raw =
		cookies.find((cookie) => cookie.startsWith(`${name}=`)) ??
		response.headers.get("set-cookie") ??
		"";
	return raw.split(";")[0] ?? "";
}

async function login(
	ctx: TestContext,
	username: string,
): Promise<{ response: Response; cookie: string }> {
	const response = await ctx.app.handle(
		new Request("http://localhost/api/v1/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password: PASSWORD }),
		}),
	);
	return { response, cookie: cookieOf(response, SESSION_COOKIE) };
}

async function createSession(ctx: TestContext): Promise<string> {
	const created = await ctx.app.handle(
		new Request("http://localhost/api/v1/gm/sessions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${ctx.gmToken}`,
			},
			body: JSON.stringify({
				moduleId: ctx.moduleId,
				characterIds: ["login-pc"],
			}),
		}),
	);
	expect(created.status).toBe(200);
	return ((await created.json()) as { session: { id: string } }).session.id;
}

async function joinInfo(
	ctx: TestContext,
	sessionId: string,
): Promise<Response> {
	return ctx.app.handle(
		new Request(
			`http://localhost/api/v1/public/sessions/${sessionId}/join-info`,
		),
	);
}

async function claim(
	ctx: TestContext,
	sessionId: string,
	cookieHeader: string,
): Promise<Response> {
	return ctx.app.handle(
		new Request(`http://localhost/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookieHeader,
			},
			body: JSON.stringify({ role: "pc", characterId: "login-pc" }),
		}),
	);
}

describe("PL account login and session join", () => {
	let ctx: TestContext;
	let fullApp: ReturnType<typeof createApp>;
	let sessionId = "";

	beforeAll(async () => {
		ctx = await setupTestApp({
			gmPassword: PASSWORD,
			players: ["observer"],
			characters: [{ id: "login-pc", name: "登录调查员", kind: "pc" }],
		});
		fullApp = createApp(ctx.container);
		const repo = new DrizzleIdentityRepository(ctx.container.db);
		await new CreateUserUseCase(
			new UuidGenerator(),
			new SystemClock(),
			repo,
		).execute({ username: "join-player", password: PASSWORD, role: "pl" });
		await seedPlayers(ctx.container.db, PASSWORD, ["join-player"]);
		sessionId = await createSession(ctx);
	});

	afterAll(() => {
		ctx.container.dbContext.sqlite.close();
	});

	test("the public join entry advertises that a player account is required", async () => {
		const response = await joinInfo(ctx, sessionId);
		expect(response.status).toBe(200);
		const body = JoinInfoResponse.parse(await response.json());
		expect(body.requiresLogin).toBe(true);
		expect(body.characters[0]?.claimable).toBe(true);
	});

	test("PL login issues a usable session, /auth/me resolves the role, and /pl is accessible", async () => {
		const { response, cookie } = await login(ctx, "join-player");
		expect(response.status).toBe(200);
		const account = LoginResponse.parse(await response.json());
		expect(account.role).toBe("pl");
		expect(cookie).toContain(`${SESSION_COOKIE}=`);

		const me = await fullApp.handle(
			new Request("http://localhost/api/v1/auth/me", {
				headers: { Cookie: cookie },
			}),
		);
		expect(me.status).toBe(200);
		expect(((await me.json()) as { role: string }).role).toBe("pl");

		const library = await fullApp.handle(
			new Request("http://localhost/api/v1/pl/characters", {
				headers: { Cookie: cookie },
			}),
		);
		expect(library.status).toBe(200);
	});

	test("a PL account takes priority over an anonymous OB cookie when claiming a PC seat", async () => {
		const identity = await ctx.app.handle(
			new Request("http://localhost/api/v1/player/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fingerprint: "fp-observer" }),
			}),
		);
		const observerCookie = cookieOf(identity, "player_token");
		expect(observerCookie).toContain("player_token=");

		const { cookie: accountCookie } = await login(ctx, "join-player");
		const bothCookies = `${accountCookie}; ${observerCookie}`;
		const response = await claim(ctx, sessionId, bothCookies);
		expect(response.status).toBe(200);
		const body = ClaimDto.parse(await response.json());
		expect(body.holderKind).toBe("user");
		expect(body.userId).not.toBeNull();
		expect(body.playerId).toBeNull();
		expect(body.role).toBe("pc");

		const after = await joinInfo(ctx, sessionId);
		expect(
			JoinInfoResponse.parse(await after.json()).characters[0]?.claimed,
		).toBe(true);
	});

	test("an anonymous OB claiming a PC seat receives a stable login-required error", async () => {
		const fresh = await ctx.app.handle(
			new Request("http://localhost/api/v1/player/identity", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fingerprint: "fp-anonymous-join" }),
			}),
		);
		const response = await claim(
			ctx,
			sessionId,
			cookieOf(fresh, "player_token"),
		);
		expect(response.status).toBe(401);
		expect(((await response.json()) as { code: string }).code).toBe(
			"PLAYER_LOGIN_REQUIRED",
		);
	});
});
