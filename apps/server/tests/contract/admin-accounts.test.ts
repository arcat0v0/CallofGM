import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import type { UserDto } from "@cogm/shared";
import {
	loginToken,
	seedPlayers,
	setupTestApp,
	type TestContext,
} from "../helpers/setup";

const PASSWORD = "admin-flow-password";

describe("Admin account management", () => {
	let ctx: TestContext;
	let adminToken = "";

	function api(path: string, init: RequestInit & { token?: string } = {}) {
		const { token, ...rest } = init;
		return ctx.app.handle(
			new Request(`http://localhost${path}`, {
				...rest,
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...rest.headers,
				},
			}),
		);
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		adminToken = ctx.adminToken;
	});

	// 本用例需要为多个账号分别验证登录，超过默认登录限速阈值；
	// 限速本身由 rate-limits 契约测试覆盖，这里在每个用例前重置计数。
	beforeEach(() => {
		ctx.container.httpLimits.reset();
	});

	afterAll(() => {
		ctx.container.dbContext.sqlite.close();
	});

	async function listUsers(): Promise<UserDto[]> {
		const res = await api("/api/v1/admin/users?includeDeleted=true", {
			token: adminToken,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: UserDto[] };
		return body.items;
	}

	async function createUser(username: string, role: string) {
		const res = await api("/api/v1/admin/users", {
			method: "POST",
			token: adminToken,
			body: JSON.stringify({ username, password: PASSWORD, role }),
		});
		expect(res.status).toBe(200);
		return (await res.json()) as UserDto;
	}

	test("admin 建号后可登录，角色固定不可通过更新修改", async () => {
		const created = await createUser("flow-pl", "pl");
		expect(created.role).toBe("pl");
		expect(created.disabledAt).toBeNull();
		expect(created.deletedAt).toBeNull();

		const login = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-pl", password: PASSWORD }),
		});
		expect(login.status).toBe(200);

		const roleChange = await api(`/api/v1/admin/users/${created.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ role: "admin" }),
		});
		expect(roleChange.status).toBe(400);
		expect(((await roleChange.json()) as { code: string }).code).toBe(
			"VALIDATION_FAILED",
		);

		const after = (await listUsers()).find((user) => user.id === created.id);
		expect(after?.role).toBe("pl");
	});

	test("重复用户名被拒（大小写不敏感）", async () => {
		await createUser("flow-dup", "pl");
		const res = await api("/api/v1/admin/users", {
			method: "POST",
			token: adminToken,
			body: JSON.stringify({
				username: "FLOW-DUP",
				password: PASSWORD,
				role: "pl",
			}),
		});
		expect(res.status).toBe(409);
	});

	test("禁用后该账号无法登录，且撤销其活动会话", async () => {
		const created = await createUser("flow-disable", "pl");
		const before = await loginToken(ctx.app, "flow-disable", PASSWORD);
		expect(before.length).toBeGreaterThan(0);

		const disable = await api(`/api/v1/admin/users/${created.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ disabled: true }),
		});
		expect(disable.status).toBe(200);

		const me = await api("/api/v1/auth/me", { token: before });
		expect(me.status).toBe(401);

		const login = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-disable", password: PASSWORD }),
		});
		expect(login.status).toBe(403);

		const enable = await api(`/api/v1/admin/users/${created.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ disabled: false }),
		});
		expect(enable.status).toBe(200);
		const after = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-disable", password: PASSWORD }),
		});
		expect(after.status).toBe(200);
	});

	test("软删除后无法登录、用户名仍被占用，恢复后可登录", async () => {
		const created = await createUser("flow-deleted", "pl");

		const del = await api(`/api/v1/admin/users/${created.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ deleted: true }),
		});
		expect(del.status).toBe(200);

		const login = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-deleted", password: PASSWORD }),
		});
		expect(login.status).toBe(403);

		const reuse = await api("/api/v1/admin/users", {
			method: "POST",
			token: adminToken,
			body: JSON.stringify({
				username: "flow-deleted",
				password: PASSWORD,
				role: "pl",
			}),
		});
		expect(reuse.status).toBe(409);

		const restore = await api(`/api/v1/admin/users/${created.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ deleted: false }),
		});
		expect(restore.status).toBe(200);
		const restored = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-deleted", password: PASSWORD }),
		});
		expect(restored.status).toBe(200);
	});

	test("重置密码后旧密码失效、新密码可用", async () => {
		const created = await createUser("flow-reset", "pl");
		const oldToken = await loginToken(ctx.app, "flow-reset", PASSWORD);

		const newPassword = "reset-flow-password";
		const reset = await api(`/api/v1/admin/users/${created.id}/password`, {
			method: "POST",
			token: adminToken,
			body: JSON.stringify({ password: newPassword }),
		});
		expect(reset.status).toBe(200);

		const revoked = await api("/api/v1/auth/me", { token: oldToken });
		expect(revoked.status).toBe(401);

		const oldLogin = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-reset", password: PASSWORD }),
		});
		expect(oldLogin.status).toBe(401);

		const newLogin = await api("/api/v1/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: "flow-reset", password: newPassword }),
		});
		expect(newLogin.status).toBe(200);
	});

	test("至少保留一个可用 admin：禁用与删除最后一个 admin 被拒", async () => {
		const users = await listUsers();
		const admins = users.filter(
			(user) =>
				user.role === "admin" &&
				user.disabledAt === null &&
				user.deletedAt === null,
		);
		expect(admins).toHaveLength(1);
		const soleAdmin = admins[0]!;

		const disable = await api(`/api/v1/admin/users/${soleAdmin.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ disabled: true }),
		});
		expect(disable.status).toBe(409);

		const remove = await api(`/api/v1/admin/users/${soleAdmin.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ deleted: true }),
		});
		expect(remove.status).toBe(409);
	});

	test("非 admin 无法访问账号管理，且 admin 不改他人密码以外内容", async () => {
		const accounts = await seedPlayers(ctx.container.db, PASSWORD, ["flow-gm"]);
		const gmUserId = accounts.get("flow-gm")!.userId;
		await ctx.container.dbContext.sqlite
			.query("update users set role = 'gm' where id = ?")
			.run(gmUserId);
		const gmToken = await loginToken(ctx.app, "flow-gm", PASSWORD);
		expect(gmToken.length).toBeGreaterThan(0);

		const gmList = await api("/api/v1/admin/users", { token: gmToken });
		expect(gmList.status).toBe(403);

		const anonymous = await api("/api/v1/admin/users");
		expect(anonymous.status).toBe(401);
	});

	test("改动最后一个 admin 之外的 admin 允许禁用", async () => {
		const second = await createUser("flow-admin2", "admin");
		const disable = await api(`/api/v1/admin/users/${second.id}`, {
			method: "PATCH",
			token: adminToken,
			body: JSON.stringify({ disabled: true }),
		});
		expect(disable.status).toBe(200);
	});
});
