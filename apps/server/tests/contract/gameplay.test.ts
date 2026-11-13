import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { checkRequests, sessionCharacters } from "@/platform/db/schema";
import {
	closeWs,
	connectWs,
	listenTestApp,
	ScriptedRandomSource,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	type TestContext,
	type TestWebSocket,
} from "../helpers/setup";

describe("Gameplay contract tests", () => {
	let ctx: TestContext;
	let server: ReturnType<TestContext["app"]["listen"]>;
	const random = new ScriptedRandomSource([]);
	const wsUrl = () =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

	beforeAll(async () => {
		ctx = await setupTestApp({
			randomSource: random,
			players: ["pc1", "pc2", "pc3"],
			characters: [
				{
					id: "char-pc1",
					name: "调查员一号",
					kind: "pc",
					sheet: {
						attributes: {
							str: 50,
							con: 60,
							siz: 70,
							dex: 50,
							app: 50,
							int: 60,
							pow: 60,
							edu: 50,
							luck: 50,
						},
						skills: { 侦查: 60, 图书馆: 45 },
					},
				},
				{
					id: "char-pc2",
					name: "调查员二号",
					kind: "pc",
				},
				{
					id: "char-pc3",
					name: "新人调查员",
					kind: "pc",
					sheet: {
						attributes: {
							str: 50,
							con: 50,
							siz: 50,
							dex: 50,
							app: 50,
							int: 50,
							pow: 50,
							edu: 50,
							luck: 50,
						},
						skills: {},
					},
				},
				{ id: "char-npc1", name: "神秘学者", kind: "npc" },
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
				{ player: "pc2", role: "pc", characterId: "char-pc2" },
				{ player: "pc3", role: "pc", characterId: "char-pc3" },
			],
		});
		server = listenTestApp(ctx.app);
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	async function openAll() {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc1.waitFor((m) => m.type === "snapshot"),
			pc2.waitFor((m) => m.type === "snapshot"),
		]);
		return { gm, pc1, pc2 };
	}

	async function closeAll(...sockets: TestWebSocket[]) {
		for (const ws of sockets) {
			await closeWs(ws);
		}
	}

	test("自主骰点：阶段矩阵与暗骰权限", async () => {
		await setSessionPhase(ctx, "free_discussion");
		const { gm, pc1, pc2 } = await openAll();

		// 玩家在自由讨论可骰
		random.push(3, 4, 5);
		sendCommand(
			pc1,
			"dice:roll",
			{ expression: "3d6", comment: "试试看" },
			"d-1",
		);
		const diceEvent = await gm.waitFor((m) => m.type === "dice:rolled");
		expect(diceEvent.payload.result.total).toBe(12);
		expect(diceEvent.payload.result.expression).toBe("3d6");
		expect(diceEvent.payload.hidden).toBe(false);

		// 玩家标记暗骰被拒
		sendCommand(pc1, "dice:roll", { expression: "1d100", hidden: true }, "d-2");
		const hiddenReply = await pc1.waitFor((m) => m.commandId === "d-2");
		expect(hiddenReply.type).toBe("command:rejected");

		// GM 暗骰：玩家收不到
		random.push(50);
		sendCommand(gm, "dice:roll", { expression: "1d100", hidden: true }, "d-3");
		const gmHidden = await gm.waitFor(
			(m) => m.type === "dice:rolled" && m.payload.hidden === true,
		);
		expect(gmHidden.payload.result.total).toBe(50);
		await new Promise((r) => setTimeout(r, 200));
		// pc2 收到了 pc1 的公开骰点，但绝不应收到 GM 的暗骰
		expect(
			pc2.messages.filter(
				(m) => m.type === "dice:rolled" && m.payload.hidden === true,
			).length,
		).toBe(0);
		expect(pc2.messages.filter((m) => m.type === "dice:rolled").length).toBe(1);

		await closeAll(gm, pc1, pc2);

		// 演绎时间玩家禁止自主骰
		await setSessionPhase(ctx, "performance_time");
		const sockets = await openAll();
		sendCommand(sockets.pc1, "dice:roll", { expression: "1d100" }, "d-4");
		const phaseReply = await sockets.pc1.waitFor((m) => m.commandId === "d-4");
		expect(phaseReply.type).toBe("command:rejected");
		expect(phaseReply.payload.code).toBe("SESSION_PHASE_FORBIDS_ACTION");

		// GM 在演绎时间仍可骰
		random.push(10);
		sendCommand(sockets.gm, "dice:roll", { expression: "1d100" }, "d-5");
		await sockets.gm.waitFor(
			(m) => m.commandId === "d-5" && m.type === "command:accepted",
		);

		await closeAll(sockets.gm, sockets.pc1, sockets.pc2);
	});

	test("技能鉴定：目标值由服务端读取，伪造目标值无入口，他人 PC 不可代骰", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		// roll 21 vs 侦查 60 → 困难成功（≤ 60/2），仍属成功，产生成长标记
		random.push(1, 2);
		sendCommand(
			pc1,
			"check:perform",
			{ characterId: "char-pc1", skillKey: "侦查" },
			"c-1",
		);
		const resolved = await gm.waitFor((m) => m.type === "check:resolved");
		expect(resolved.payload.characterId).toBe("char-pc1");
		expect(resolved.payload.result.targetValue).toBe(60);
		expect(resolved.payload.result.roll).toBe(21);
		expect(resolved.payload.result.outcome).toBe("hard_success");
		expect(resolved.payload.result.success).toBe(true);
		// 公开鉴定结果全员可见
		await pc2.waitFor(
			(m) =>
				m.type === "check:resolved" && m.payload.characterId === "char-pc1",
		);

		// 成功后成长标记通过 state:changed 广播
		const stateChanged = await gm.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(stateChanged.payload.state.growthMarks).toContain("侦查");

		// 玩家不能代他人 PC 鉴定
		sendCommand(
			pc1,
			"check:perform",
			{ characterId: "char-pc2", skillKey: "侦查" },
			"c-2",
		);
		const reply2 = await pc1.waitFor((m) => m.commandId === "c-2");
		expect(reply2.type).toBe("command:rejected");

		// 不存在的技能
		sendCommand(
			pc1,
			"check:perform",
			{ characterId: "char-pc1", skillKey: "不存在的技能" },
			"c-3",
		);
		const reply3 = await pc1.waitFor((m) => m.commandId === "c-3");
		expect(reply3.type).toBe("command:rejected");
		expect(reply3.payload.code).toBe("SKILL_NOT_FOUND");

		await closeAll(gm, pc1, pc2);
	});

	test("空卡人物：技能目录基础值兜底，GM 鉴定与请求可写入", async () => {
		await setSessionPhase(ctx, "free_performance");
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc3 = await connectWs(wsUrl(), ctx.playerTokens.get("pc3")!);
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc3.waitFor((m) => m.type === "snapshot"),
		]);

		random.push(1, 1);
		sendCommand(
			gm,
			"check:perform",
			{ characterId: "char-pc3", skillKey: "侦查" },
			"c-empty-1",
		);
		const resolved = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" && m.payload.characterId === "char-pc3",
		);
		expect(resolved.payload.result.targetValue).toBe(25);

		sendCommand(
			gm,
			"check:request",
			{ characterId: "char-pc3", skillKey: "聆听" },
			"c-empty-2",
		);
		const reply = await gm.waitFor((m) => m.commandId === "c-empty-2");
		expect(reply.type).toBe("command:accepted");
		await pc3.waitFor((m) => m.type === "check:requested");

		random.push(5, 0);
		sendCommand(
			pc3,
			"check:respond",
			{ requestId: reply.payload.requestId },
			"c-empty-3",
		);
		const selfResolved = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" &&
				m.payload.characterId === "char-pc3" &&
				m.payload.requestId === reply.payload.requestId,
		);
		expect(selfResolved.payload.result.targetValue).toBe(20);

		await closeAll(gm, pc3);
	});

	test("GM 对 NPC 的鉴定结果仅 GM 可见", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		random.push(1, 3);
		sendCommand(
			gm,
			"check:perform",
			{ characterId: "char-npc1", skillKey: "侦查" },
			"c-npc-1",
		);
		const resolved = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" && m.payload.characterId === "char-npc1",
		);
		expect(resolved.payload.result.roll).toBe(31);

		await new Promise((r) => setTimeout(r, 200));
		expect(
			pc1.messages.some(
				(m) =>
					m.type === "check:resolved" && m.payload.characterId === "char-npc1",
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) =>
					m.type === "check:resolved" && m.payload.characterId === "char-npc1",
			),
		).toBe(false);

		await closeAll(gm, pc1, pc2);
	});

	test("鉴定请求：定向送达、响应一次、不受阶段限制", async () => {
		await setSessionPhase(ctx, "forced_cg");
		const { gm, pc1, pc2 } = await openAll();

		sendCommand(
			gm,
			"check:request",
			{ characterId: "char-pc1", skillKey: "图书馆", difficulty: "regular" },
			"r-1",
		);
		const requested = await pc1.waitFor((m) => m.type === "check:requested");
		const requestId = requested.payload.request.id;
		expect(requested.payload.request.characterId).toBe("char-pc1");

		// 非目标玩家收不到请求
		await new Promise((r) => setTimeout(r, 200));
		expect(pc2.messages.some((m) => m.type === "check:requested")).toBe(false);

		// 强制 CG 阶段响应请求不受限制；roll 30 vs 图书馆 45 → 常规成功
		random.push(0, 3);
		sendCommand(pc1, "check:respond", { requestId }, "r-2");
		const resolved = await gm.waitFor(
			(m) => m.type === "check:resolved" && m.payload.requestId === requestId,
		);
		expect(resolved.payload.result.roll).toBe(30);
		expect(resolved.payload.result.success).toBe(true);

		// 重复响应被拒
		sendCommand(pc1, "check:respond", { requestId }, "r-3");
		const again = await pc1.waitFor((m) => m.commandId === "r-3");
		expect(again.type).toBe("command:rejected");
		expect(again.payload.code).toBe("CHECK_REQUEST_ALREADY_RESOLVED");

		const rows = await ctx.container.db
			.select()
			.from(checkRequests)
			.where(eq(checkRequests.id, requestId));
		expect(rows[0]?.status).toBe("resolved");
		expect(rows[0]?.resolvedCheckResultJson).toBeTruthy();

		await closeAll(gm, pc1, pc2);
	});

	test("暗骰请求：玩家仅收到已掷出回执，结果仅 GM 可见", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		sendCommand(
			gm,
			"check:request",
			{ characterId: "char-pc1", skillKey: "侦查", hidden: true },
			"h-1",
		);
		const requested = await pc1.waitFor(
			(m) => m.type === "check:requested" && m.payload.request.hidden === true,
		);
		const requestId = requested.payload.request.id;

		random.push(1, 2);
		sendCommand(pc1, "check:respond", { requestId }, "h-2");
		const ack = await pc1.waitFor((m) => m.commandId === "h-2");
		expect(ack.type).toBe("command:accepted");
		expect(ack.payload.rolled).toBe(true);
		expect(ack.payload.hidden).toBe(true);

		// GM 收到完整结果
		const gmResult = await gm.waitFor(
			(m) => m.type === "check:resolved" && m.payload.requestId === requestId,
		);
		expect(gmResult.payload.result.roll).toBe(21);

		// 玩家（含发起者与其他玩家）都收不到结果事件
		await new Promise((r) => setTimeout(r, 200));
		expect(
			pc1.messages.some(
				(m) => m.type === "check:resolved" && m.payload.requestId === requestId,
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) => m.type === "check:resolved" && m.payload.requestId === requestId,
			),
		).toBe(false);

		await closeAll(gm, pc1, pc2);
	});

	test("理智检定：GM 立即判定、自动扣减 SAN、事件顺序与大额损失 GM 提示", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		random.push(80, 6);
		sendCommand(
			gm,
			"check:san",
			{ characterId: "char-pc1", sanLossExpression: "1d3/1d6" },
			"s-1",
		);
		const resolved = await gm.waitFor(
			(m) => m.type === "check:resolved" && m.payload.skillKey === "san",
		);
		expect(resolved.payload.result.success).toBe(false);
		expect(resolved.payload.result.loss).toBe(6);
		expect(resolved.payload.result.sanAfter).toBe(54);

		const stateChanged = await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.san === 54,
		);
		expect(stateChanged.eventId).toBe(resolved.eventId + 1);
		await pc1.waitFor(
			(m) => m.type === "state:changed" && m.payload.state.san === 54,
		);
		await pc2.waitFor(
			(m) => m.type === "state:changed" && m.payload.state.san === 54,
		);

		const hint = await gm.waitFor((m) => m.type === "state:hint");
		expect(hint.payload.hints.some((h: string) => h.includes("临时疯狂"))).toBe(
			true,
		);
		await new Promise((r) => setTimeout(r, 200));
		expect(pc1.messages.some((m) => m.type === "state:hint")).toBe(false);
		expect(pc2.messages.some((m) => m.type === "state:hint")).toBe(false);

		await closeAll(gm, pc1, pc2);
	});

	test("暗骰成长：鉴定结果与成长标记仅 GM 可见，公开状态不含暗骰技能", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();
		const before = await ctx.container.db
			.select()
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, ctx.sessionId),
					eq(sessionCharacters.characterId, "char-pc1"),
				),
			);
		const publicGrowthBefore: string[] = JSON.parse(
			before[0]!.stateJson,
		).growthMarks;

		random.push(3, 2);
		sendCommand(
			gm,
			"check:perform",
			{ characterId: "char-pc1", skillKey: "图书馆", hidden: true },
			"hid-1",
		);
		await gm.waitFor(
			(m) => m.type === "check:resolved" && m.payload.hidden === true,
		);
		const gmState = await gm.waitFor(
			(m) => m.type === "state:changed" && m.payload.characterId === "char-pc1",
		);
		expect(gmState.payload.state.hiddenGrowthMarks).toContain("图书馆");
		expect(gmState.payload.state.growthMarks).toEqual(publicGrowthBefore);
		expect(
			pc1.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-pc1",
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-pc1",
			),
		).toBe(false);
		expect(
			pc1.messages.some(
				(m) => m.type === "check:resolved" && m.payload.hidden === true,
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) => m.type === "check:resolved" && m.payload.hidden === true,
			),
		).toBe(false);

		await closeAll(gm, pc1, pc2);
	});

	test("GM 状态编辑：PC 公开广播、NPC 仅 GM 可见、阈值提示", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		// PC：重伤线提示 + 全员可见
		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-pc1", hpDelta: -7 },
			"e-1",
		);
		const pcState = await pc2.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.hp === 6,
		);
		expect(pcState).toBeDefined();
		const hint = await gm.waitFor(
			(m) => m.type === "state:hint" && m.payload.characterId === "char-pc1",
		);
		expect(hint.payload.hints.some((h: string) => h.includes("重伤"))).toBe(
			true,
		);

		// NPC：玩家不可见
		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-npc1", hpDelta: -3 },
			"e-2",
		);
		await gm.waitFor(
			(m) =>
				m.type === "state:changed" && m.payload.characterId === "char-npc1",
		);
		await new Promise((r) => setTimeout(r, 200));
		expect(
			pc1.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-npc1",
			),
		).toBe(false);
		expect(
			pc2.messages.some(
				(m) =>
					m.type === "state:changed" && m.payload.characterId === "char-npc1",
			),
		).toBe(false);

		// 玩家没有编辑入口
		sendCommand(
			pc1,
			"state:edit",
			{ characterId: "char-pc1", hpDelta: 1 },
			"e-3",
		);
		const reply = await pc1.waitFor((m) => m.commandId === "e-3");
		expect(reply.type).toBe("command:rejected");

		await closeAll(gm, pc1, pc2);
	});

	test("快照：待响应鉴定请求按身份过滤，NPC 状态对玩家不可见", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		sendCommand(
			gm,
			"check:request",
			{ characterId: "char-pc1", skillKey: "侦查" },
			"snap-r-1",
		);
		await pc1.waitFor((m) => m.type === "check:requested");
		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-npc1", sanDelta: -5 },
			"snap-e-1",
		);
		await gm.waitFor(
			(m) => m.commandId === "snap-e-1" && m.type === "command:accepted",
		);
		await closeAll(gm, pc1, pc2);

		// GM 快照：全部 pending 请求 + NPC 状态可见
		const gm2 = await connectWs(wsUrl(), ctx.gmToken);
		const gmSnapshot = await gm2.waitFor((m) => m.type === "snapshot");
		expect(gmSnapshot.payload.pendingCheckRequests.length).toBeGreaterThan(0);
		const npcInGm = gmSnapshot.payload.characters.find(
			(c: any) => c.characterId === "char-npc1",
		);
		expect(npcInGm.state).not.toBeNull();

		// 目标玩家快照：可见自己的请求；NPC 状态为 null
		const pc1Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		const pc1Snapshot = await pc1Again.waitFor((m) => m.type === "snapshot");
		expect(
			pc1Snapshot.payload.pendingCheckRequests.some(
				(r: any) => r.characterId === "char-pc1",
			),
		).toBe(true);
		const npcInPc1 = pc1Snapshot.payload.characters.find(
			(c: any) => c.characterId === "char-npc1",
		);
		expect(npcInPc1.state).toBeNull();
		const pc1InSnapshot = pc1Snapshot.payload.characters.find(
			(c: any) => c.characterId === "char-pc1",
		);
		expect(pc1InSnapshot.state).not.toBeNull();

		// 非目标玩家快照：看不到给 pc1 的请求
		const pc2Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
		const pc2Snapshot = await pc2Again.waitFor((m) => m.type === "snapshot");
		expect(pc2Snapshot.payload.pendingCheckRequests.length).toBe(0);

		await closeAll(gm2, pc1Again, pc2Again);
	});

	test("骰点越界返回 DICE_EXPRESSION_OUT_OF_RANGE，语法错误与 SAN 损失映射保持不变", async () => {
		await setSessionPhase(ctx, "free_discussion");
		const { gm, pc1, pc2 } = await openAll();

		for (const expr of ["0d6", "51d6", "1d1001", "1d6+10001", "1".repeat(33)]) {
			const commandId = `oor-${expr.length}-${expr.slice(0, 6)}`;
			sendCommand(pc1, "dice:roll", { expression: expr }, commandId);
			const reply = await pc1.waitFor((m) => m.commandId === commandId);
			expect(reply.type).toBe("command:rejected");
			expect(reply.payload.code).toBe("DICE_EXPRESSION_OUT_OF_RANGE");
		}

		sendCommand(pc1, "dice:roll", { expression: "bad" }, "bad-syntax");
		const badReply = await pc1.waitFor((m) => m.commandId === "bad-syntax");
		expect(badReply.type).toBe("command:rejected");
		expect(badReply.payload.code).toBe("INVALID_DICE_EXPRESSION");

		sendCommand(
			gm,
			"check:san",
			{ characterId: "char-pc1", sanLossExpression: "1/51d6" },
			"san-oor",
		);
		const sanReply = await gm.waitFor((m) => m.commandId === "san-oor");
		expect(sanReply.type).toBe("command:rejected");
		expect(sanReply.payload.code).toBe("INVALID_SAN_LOSS_EXPRESSION");

		await closeAll(gm, pc1, pc2);
	});
});
