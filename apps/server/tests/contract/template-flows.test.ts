import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	InstantiateTemplateResponse,
	ModuleDto,
	SessionDto,
	TemplateDetailDto,
	TemplateDto,
} from "@cogm/shared";
import {
	listenTestApp,
	loginToken,
	seedPlayers,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const PASSWORD = "template-flow-password";

describe("Module templates and quick start", () => {
	let ctx: TestContext;
	let server: TestServer;
	let otherGmToken = "";
	let otherGmUserId = "";
	let sourceModuleId = "";

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
		server = listenTestApp(ctx.app);

		const accounts = await seedPlayers(ctx.container.db, PASSWORD, ["tpl-gm"]);
		otherGmUserId = accounts.get("tpl-gm")!.userId;
		await ctx.container.dbContext.sqlite
			.query("update users set role = 'gm' where id = ?")
			.run(otherGmUserId);
		otherGmToken = await loginToken(ctx.app, "tpl-gm", PASSWORD);

		const moduleRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "源模组",
				description: "模板来源",
				ruleId: "coc7e",
			}),
		});
		expect(moduleRes.status).toBe(200);
		sourceModuleId = ModuleDto.parse(await moduleRes.json()).id;

		await api(`/api/v1/gm/modules/${sourceModuleId}/scenes`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ name: "图书馆", sortOrder: 1, bgAssetId: null }),
		});
		await api(`/api/v1/gm/modules/${sourceModuleId}/handouts`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ title: "线索 A", content: "内容 A" }),
		});
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	async function createTemplate(name: string, token = ctx.gmToken) {
		const res = await api("/api/v1/gm/templates", {
			method: "POST",
			token,
			body: JSON.stringify({
				name,
				description: "模板说明",
				ruleId: "coc7e",
				sourceModuleId,
			}),
		});
		expect(res.status).toBe(200);
		return TemplateDto.parse(await res.json());
	}

	test("从模组创建模板：快照场景与情报，并记录来源模组", async () => {
		const template = await createTemplate("快照模板");
		expect(template.ruleId).toBe("coc7e");
		expect(template.sourceModuleId).toBe(sourceModuleId);

		const detailRes = await api(`/api/v1/gm/templates/${template.id}`, {
			token: ctx.gmToken,
		});
		expect(detailRes.status).toBe(200);
		const detail = TemplateDetailDto.parse(await detailRes.json());
		expect(detail.scenes.map((scene) => scene.name)).toContain("图书馆");
		expect(detail.handouts.map((h) => h.title)).toContain("线索 A");
	});

	test("模板与源模组不自动同步：改源模组不影响已建模板", async () => {
		const template = await createTemplate("不同步模板");

		await api(`/api/v1/gm/modules/${sourceModuleId}/scenes`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "源模组新增场景",
				sortOrder: 9,
				bgAssetId: null,
			}),
		});

		const detailRes = await api(`/api/v1/gm/templates/${template.id}`, {
			token: ctx.gmToken,
		});
		const detail = TemplateDetailDto.parse(await detailRes.json());
		expect(detail.scenes.map((scene) => scene.name)).not.toContain(
			"源模组新增场景",
		);
	});

	test("版本：另存历史版本后实例化可选具体版本", async () => {
		const template = await createTemplate("版本模板");

		const saved = await api(`/api/v1/gm/templates/${template.id}/versions`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ note: "开团前定稿" }),
		});
		expect(saved.status).toBe(200);

		const versionsRes = await api(
			`/api/v1/gm/templates/${template.id}/versions`,
			{ token: ctx.gmToken },
		);
		expect(versionsRes.status).toBe(200);

		await api(`/api/v1/gm/templates/${template.id}`, {
			method: "PATCH",
			token: ctx.gmToken,
			body: JSON.stringify({ description: "改后的说明" }),
		});

		const fromCurrent = await api(
			`/api/v1/gm/templates/${template.id}/instantiate`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({ name: "当前版模组" }),
			},
		);
		expect(fromCurrent.status).toBe(200);
		const currentResult = InstantiateTemplateResponse.parse(
			await fromCurrent.json(),
		);
		expect(currentResult.moduleId).not.toBe(sourceModuleId);
		const currentModule = await api(
			`/api/v1/gm/modules/${currentResult.moduleId}`,
			{ token: ctx.gmToken },
		);
		expect(ModuleDto.parse(await currentModule.json()).ruleId).toBe("coc7e");
	});

	test("实例化产生独立资源：改新模组不影响模板与源模组", async () => {
		const template = await createTemplate("独立实例化模板");

		const created = await api(
			`/api/v1/gm/templates/${template.id}/instantiate`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({ name: "独立模组" }),
			},
		);
		const instance = InstantiateTemplateResponse.parse(await created.json());

		await api(`/api/v1/gm/modules/${instance.moduleId}/scenes`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "实例独有场景",
				sortOrder: 5,
				bgAssetId: null,
			}),
		});

		const detailRes = await api(`/api/v1/gm/templates/${template.id}`, {
			token: ctx.gmToken,
		});
		const detail = TemplateDetailDto.parse(await detailRes.json());
		expect(detail.scenes.map((scene) => scene.name)).not.toContain(
			"实例独有场景",
		);
	});

	test("快速开团：一次创建独立模组与等待开始的团", async () => {
		const template = await createTemplate("快速开团模板");

		const res = await api(`/api/v1/gm/templates/${template.id}/instantiate`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ quickStart: true, sessionName: "快速团" }),
		});
		expect(res.status).toBe(200);
		const result = InstantiateTemplateResponse.parse(await res.json());
		expect(result.sessionId).not.toBeNull();
		expect(result.moduleId).not.toBe(sourceModuleId);

		const moduleRes = await api(`/api/v1/gm/modules/${result.moduleId}`, {
			token: ctx.gmToken,
		});
		expect(ModuleDto.parse(await moduleRes.json()).sourceTemplateId).toBe(
			template.id,
		);

		const sessionId = result.sessionId!;
		const detailRes = await api(`/api/v1/gm/sessions/${sessionId}`, {
			token: ctx.gmToken,
		});
		expect(detailRes.status).toBe(200);
		const detail = (await detailRes.json()) as {
			session: { status: string; ruleId: string };
		};
		expect(detail.session.status).toBe("waiting");
		expect(detail.session.ruleId).toBe("coc7e");
	});

	test("跨 GM 隔离：他人模板不可读、不可实例化、不可删", async () => {
		const template = await createTemplate("隔离模板");

		const readByOther = await api(`/api/v1/gm/templates/${template.id}`, {
			token: otherGmToken,
		});
		expect(readByOther.status).toBe(404);

		const instantiateByOther = await api(
			`/api/v1/gm/templates/${template.id}/instantiate`,
			{
				method: "POST",
				token: otherGmToken,
				body: JSON.stringify({ name: "越权模组" }),
			},
		);
		expect(instantiateByOther.status).toBe(404);

		const deleteByOther = await api(`/api/v1/gm/templates/${template.id}`, {
			method: "DELETE",
			token: otherGmToken,
		});
		expect(deleteByOther.status).toBe(404);

		const listOther = await api("/api/v1/gm/templates?limit=100", {
			token: otherGmToken,
		});
		const otherBody = (await listOther.json()) as {
			items: Array<{ id: string }>;
		};
		expect(otherBody.items.some((item) => item.id === template.id)).toBe(false);
	});

	test("模板软删除：列表不可见、恢复后可用", async () => {
		const template = await createTemplate("软删除模板");

		const del = await api(`/api/v1/gm/templates/${template.id}`, {
			method: "DELETE",
			token: ctx.gmToken,
		});
		expect(del.status).toBe(200);

		const afterDelete = await api(`/api/v1/gm/templates/${template.id}`, {
			token: ctx.gmToken,
		});
		expect(afterDelete.status).toBe(404);

		const rows = await ctx.container.dbContext.sqlite
			.query<{ deleted_at: number | null }, [string]>(
				"select deleted_at from templates where id = ?",
			)
			.get(template.id);
		expect(rows?.deleted_at).not.toBeNull();

		const adminRestore = await api("/api/v1/trash/restore", {
			method: "POST",
			token: ctx.adminToken,
			body: JSON.stringify({ entityType: "template", id: template.id }),
		});
		expect(adminRestore.status).toBe(403);

		const restore = await api("/api/v1/trash/restore", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ entityType: "template", id: template.id }),
		});
		expect(restore.status).toBe(200);

		const afterRestore = await api(`/api/v1/gm/templates/${template.id}`, {
			token: ctx.gmToken,
		});
		expect(afterRestore.status).toBe(200);
	});

	test("未注册规则无法建模板", async () => {
		const res = await api("/api/v1/gm/templates", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "未知规则模板",
				description: "",
				ruleId: "unregistered-rule",
			}),
		});
		expect(res.status).toBe(400);
	});
});
