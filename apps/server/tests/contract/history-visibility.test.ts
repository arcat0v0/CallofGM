import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type ClientCommandType,
	type CommandReply,
	type HistoryPage,
	HistoryPageReply,
} from "@cogm/shared";
import type { ActorContext } from "@/modules/identity";
import { handouts, scenes } from "@/platform/db/schema";
import {
	listenTestApp,
	setSessionPhase,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

async function execute(
	ctx: TestContext,
	type: ClientCommandType,
	payload: unknown,
	actor: ActorContext = {
		type: "user",
		userId: "test-gm",
		role: "gm",
		loginSessionId: "s",
		username: "gm",
	},
): Promise<CommandReply> {
	return ctx.container.sessionCommandExecutor.execute(
		ctx.sessionId,
		actor,
		{
			protocolVersion: 1,
			commandId: `cmd-${crypto.randomUUID()}`,
			type,
			payload,
		},
		"visibility-test",
	);
}

async function historyOf(
	ctx: TestContext,
	actor: ActorContext,
): Promise<HistoryPage> {
	const reply = await execute(ctx, "history:page", { limit: 100 }, actor);
	if (reply.type !== "command:accepted") {
		throw new Error(JSON.stringify(reply.payload));
	}
	return HistoryPageReply.parse(reply.payload).history;
}

function activityTypes(page: HistoryPage): string[] {
	return page.items
		.filter((item) => item.kind === "activity")
		.map((item) => (item.kind === "activity" ? item.type : ""));
}

describe("History visibility contract", () => {
	let ctx: TestContext;
	let server: TestServer;

	beforeAll(async () => {
		ctx = await setupTestApp({
			players: ["pc1", "ob1"],
			characters: [
				{ id: "char-pc1", name: "调查员", kind: "pc", portraits: ["default"] },
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
				{ player: "ob1", role: "ob" },
			],
		});
		server = listenTestApp(ctx.app);
		await setSessionPhase(ctx, "free_discussion");

		await ctx.container.db.insert(scenes).values({
			id: "scene-1",
			moduleId: "module-test",
			name: "码头",
			sortOrder: 0,
			bgAssetId: null,
			createdAt: Date.now(),
			deletedAt: null,
		});
		await ctx.container.db.insert(handouts).values({
			id: "handout-1",
			moduleId: "module-test",
			title: "潮汐日志",
			content: "潮水正在上涨。",
			imageAssetId: null,
			createdAt: Date.now(),
			deletedAt: null,
		});

		await execute(ctx, "chat:send", { channel: "ooc", content: "开场" });
		await execute(ctx, "dice:roll", { expression: "1d100" });
		await execute(ctx, "state:edit", { characterId: "char-pc1", hp: 5 });
		await execute(ctx, "scene:switch", { sceneId: "scene-1" });
		await execute(ctx, "expression:set", {
			characterId: "char-pc1",
			expressionKey: "default",
		});
		await execute(ctx, "handout:grant", {
			handoutId: "handout-1",
			recipientCharacterIds: [],
		});
		await execute(ctx, "check:request", {
			characterId: "char-pc1",
			skillKey: "侦查",
		});

		const phaseRes = await ctx.app.handle(
			new Request(
				`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/phase`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ctx.gmToken}`,
					},
					body: JSON.stringify({ phase: "performance_time" }),
				},
			),
		);
		expect(phaseRes.status).toBe(200);
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	test("GM 历史包含全部时间线活动，包括仅 GM 可见的状态变更", async () => {
		const page = await historyOf(ctx, {
			type: "user",
			userId: ctx.gmUserId,
			role: "gm",
			loginSessionId: "s",
			username: "gm",
		});
		const types = activityTypes(page);
		expect(types).toEqual(
			expect.arrayContaining([
				"dice:rolled",
				"state:changed",
				"scene:changed",
				"expression:changed",
				"handout:granted",
				"session:phase-changed",
			]),
		);
		expect(types).not.toContain("check:requested");
	});

	test("玩家历史排除状态变更与未完成鉴定请求，保留可见的公开活动", async () => {
		const page = await historyOf(ctx, {
			type: "user",
			userId: ctx.plIds.get("pc1")!,
			role: "pl",
			loginSessionId: "s",
			username: "pl-pc1",
		});
		const types = activityTypes(page);
		expect(types).toEqual(
			expect.arrayContaining([
				"dice:rolled",
				"scene:changed",
				"expression:changed",
				"handout:granted",
				"session:phase-changed",
			]),
		);
		expect(types).not.toContain("state:changed");
		expect(types).not.toContain("check:requested");
		expect(page.items.some((item) => item.kind === "chat")).toBe(true);
	});
});
