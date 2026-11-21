import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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

describe("Gameplay luck contract tests", () => {
	let ctx: TestContext;
	let server: ReturnType<TestContext["app"]["listen"]>;
	const random = new ScriptedRandomSource([]);
	const wsUrl = () =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

	beforeAll(async () => {
		ctx = await setupTestApp({
			randomSource: random,
			players: ["pc1", "pc2"],
			characters: [
				{
					id: "char-pc1",
					name: "幸运调查员",
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
							luck: 99,
						},
						skills: { 侦查: 60, 图书馆: 45 },
					},
				},
				{
					id: "char-pc2",
					name: "旁观调查员",
					kind: "pc",
				},
			],
			claims: [
				{ player: "pc1", role: "pc", characterId: "char-pc1" },
				{ player: "pc2", role: "pc", characterId: "char-pc2" },
			],
		});
		server = listenTestApp(ctx.app);
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	function maxEventId(ws: TestWebSocket): number {
		return Math.max(
			0,
			...ws.messages.map((message) =>
				typeof message.eventId === "number" ? message.eventId : 0,
			),
		);
	}

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

	test("花费幸运、禁用手表、恢复与历史回放", async () => {
		await setSessionPhase(ctx, "free_performance");
		const { gm, pc1, pc2 } = await openAll();

		async function perform(
			skillKey: string,
			values: number[],
			commandId: string,
		) {
			const since = maxEventId(gm);
			random.push(...values);
			sendCommand(
				pc1,
				"check:perform",
				{ characterId: "char-pc1", skillKey },
				commandId,
			);
			return gm.waitFor(
				(m) =>
					m.type === "check:resolved" &&
					m.eventId > since &&
					m.payload.characterId === "char-pc1" &&
					m.payload.skillKey === skillKey,
			);
		}

		// A. 普通成功 → 花 20 点升到困难成功，并收回已有的成长标记
		const successCheck = await perform("侦查", [0, 5], "luck-check-success");
		expect(successCheck.payload.result.roll).toBe(50);
		expect(successCheck.payload.result.outcome).toBe("regular_success");
		const growthState = await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.growthMarks.includes("侦查"),
		);
		expect(growthState.payload.state.luck).toBe(99);

		const spendSuccessId = "luck-spend-success";
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: successCheck.eventId,
				points: 20,
			},
			spendSuccessId,
		);
		const amendedSuccess = await gm.waitFor(
			(m) =>
				m.type === "check:amended" &&
				m.payload.amendsEventId === successCheck.eventId,
		);
		expect(amendedSuccess.payload.result).toMatchObject({
			roll: 30,
			outcome: "hard_success",
			success: true,
			luckSpent: 20,
			originalRoll: 50,
			luckBefore: 99,
			luckAfter: 79,
			growthEligible: false,
		});
		const state79 = await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.luck === 79,
		);
		expect(state79.payload.state.growthMarks).not.toContain("侦查");

		// B. 失败 63 → 花 33 点升到困难成功
		const failedCheck = await perform("侦查", [3, 6], "luck-check-failed");
		expect(failedCheck.payload.result).toMatchObject({
			roll: 63,
			outcome: "failure",
			success: false,
		});
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: failedCheck.eventId,
				points: 33,
			},
			"luck-spend-failed",
		);
		const amendedFailed = await gm.waitFor(
			(m) =>
				m.type === "check:amended" &&
				m.payload.amendsEventId === failedCheck.eventId,
		);
		expect(amendedFailed.payload.result).toMatchObject({
			roll: 30,
			outcome: "hard_success",
			success: true,
			luckSpent: 33,
			originalRoll: 63,
			luckBefore: 79,
			luckAfter: 46,
		});
		await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.luck === 46,
		);

		// 同一检定不能二次花费
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: failedCheck.eventId,
				points: 3,
			},
			"luck-spend-twice",
		);
		const twice = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-twice",
		);
		expect(twice.type).toBe("command:rejected");
		expect(twice.payload.code).toBe("LUCK_SPEND_ALREADY_USED");

		// 不是自己的检定 / GM 不能替玩家花费
		sendCommand(
			pc2,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: failedCheck.eventId,
				points: 3,
			},
			"luck-spend-other",
		);
		const other = await pc2.waitFor(
			(m) => m.commandId === "luck-spend-other",
		);
		expect(other.type).toBe("command:rejected");
		expect(other.payload.code).toBe("FORBIDDEN");

		sendCommand(
			gm,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: failedCheck.eventId,
				points: 3,
			},
			"luck-spend-gm",
		);
		const gmSpend = await gm.waitFor(
			(m) => m.commandId === "luck-spend-gm",
		);
		expect(gmSpend.type).toBe("command:rejected");
		expect(gmSpend.payload.code).toBe("FORBIDDEN");

		// C/D. 只能修改最近一次检定
		const olderCheck = await perform("侦查", [9, 9], "luck-check-older");
		await perform("侦查", [1, 2], "luck-check-newer");
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: olderCheck.eventId,
				points: 39,
			},
			"luck-spend-older",
		);
		const olderReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-older",
		);
		expect(olderReply.type).toBe("command:rejected");
		expect(olderReply.payload.code).toBe("LUCK_SPEND_NOT_LATEST");

		// E. 天然大失败不可花
		const fumbleCheck = await perform("侦查", [0, 0], "luck-check-fumble");
		expect(fumbleCheck.payload.result.outcome).toBe("fumble");
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: fumbleCheck.eventId,
				points: 1,
			},
			"luck-spend-fumble",
		);
		const fumbleReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-fumble",
		);
		expect(fumbleReply.type).toBe("command:rejected");
		expect(fumbleReply.payload.code).toBe("LUCK_SPEND_NOT_ALLOWED");

		// F. 幸运检定本身不可花
		const luckCheck = await perform("luck", [3, 6], "luck-check-luck");
		expect(luckCheck.payload.skillKey).toBe("luck");
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: luckCheck.eventId,
				points: 1,
			},
			"luck-spend-luck",
		);
		const luckReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-luck",
		);
		expect(luckReply.type).toBe("command:rejected");
		expect(luckReply.payload.code).toBe("LUCK_SPEND_NOT_ALLOWED");

		// G. SAN 检定不可花
		const sanSince = maxEventId(gm);
		random.push(30);
		sendCommand(
			gm,
			"check:san",
			{
				characterId: "char-pc1",
				sanLossExpression: "1/1d6",
				hidden: false,
			},
			"luck-check-san",
		);
		const sanCheck = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" &&
				m.eventId > sanSince &&
				m.payload.skillKey === "san",
		);
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: sanCheck.eventId,
				points: 1,
			},
			"luck-spend-san",
		);
		const sanReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-san",
		);
		expect(sanReply.type).toBe("command:rejected");
		expect(sanReply.payload.code).toBe("LUCK_SPEND_NOT_ALLOWED");

		// H. 点数超过当前幸运
		const expensiveCheck = await perform("侦查", [9, 9], "luck-check-poor");
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: expensiveCheck.eventId,
				points: 69,
			},
			"luck-spend-poor",
		);
		const poorReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-poor",
		);
		expect(poorReply.type).toBe("command:rejected");
		expect(poorReply.payload.code).toBe("LUCK_SPEND_INSUFFICIENT");

		// 暗骰不可由玩家修改
		const hiddenSince = maxEventId(gm);
		random.push(3, 6);
		sendCommand(
			gm,
			"check:perform",
			{
				characterId: "char-pc1",
				skillKey: "侦查",
				hidden: true,
			},
			"luck-check-hidden",
		);
		const hiddenCheck = await gm.waitFor(
			(m) =>
				m.type === "check:resolved" &&
				m.eventId > hiddenSince &&
				m.payload.hidden === true,
		);
		sendCommand(
			pc1,
			"check:spend-luck",
			{
				characterId: "char-pc1",
				eventId: hiddenCheck.eventId,
				points: 1,
			},
			"luck-spend-hidden",
		);
		const hiddenReply = await pc1.waitFor(
			(m) => m.commandId === "luck-spend-hidden",
		);
		expect(hiddenReply.type).toBe("command:rejected");
		expect(hiddenReply.payload.code).toBe("LUCK_SPEND_NOT_ALLOWED");

		// 幸运恢复：成功 / 不变 / 上限 99
		const recoverySince = maxEventId(gm);
		random.push(78, 7);
		sendCommand(
			gm,
			"luck:recover",
			{ characterId: "char-pc1" },
			"luck-recover-1",
		);
		const recovered = await gm.waitFor(
			(m) =>
				m.type === "luck:recovered" &&
				m.eventId > recoverySince &&
				m.payload.characterId === "char-pc1",
		);
		expect(recovered.payload).toMatchObject({
			roll: 78,
			luckBefore: 46,
			luckAfter: 53,
			gain: 7,
		});
		await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.luck === 53,
		);

		random.push(30);
		sendCommand(
			gm,
			"luck:recover",
			{ characterId: "char-pc1" },
			"luck-recover-2",
		);
		const unchanged = await gm.waitFor(
			(m) =>
				m.type === "luck:recovered" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.roll === 30,
		);
		expect(unchanged.payload).toMatchObject({
			luckBefore: 53,
			luckAfter: 53,
			gain: 0,
		});

		sendCommand(
			gm,
			"state:edit",
			{ characterId: "char-pc1", luck: 98 },
			"luck-set-98",
		);
		await gm.waitFor(
			(m) =>
				m.type === "state:changed" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.state.luck === 98,
		);
		random.push(99, 10);
		sendCommand(
			gm,
			"luck:recover",
			{ characterId: "char-pc1" },
			"luck-recover-cap",
		);
		const capped = await gm.waitFor(
			(m) =>
				m.type === "luck:recovered" &&
				m.payload.characterId === "char-pc1" &&
				m.payload.roll === 99,
		);
		expect(capped.payload).toMatchObject({
			luckBefore: 98,
			luckAfter: 99,
			gain: 1,
		});

		// 历史页只保留修正后的结果
		sendCommand(pc1, "history:page", { limit: 100 }, "luck-history");
		const historyReply = await pc1.waitFor(
			(m) => m.commandId === "luck-history",
		);
		expect(historyReply.type).toBe("command:accepted");
		const historyItems = historyReply.payload.history.items as Array<{
			kind: string;
			eventId: number;
			type?: string;
			payload?: Record<string, unknown>;
		}>;
		expect(
			historyItems.some(
				(item) =>
					item.kind === "activity" &&
					item.type === "check:resolved" &&
					item.eventId === successCheck.eventId,
			),
		).toBe(false);
		expect(
			historyItems.some(
				(item) =>
					item.kind === "activity" &&
					item.type === "check:amended" &&
					item.payload?.amendsEventId === successCheck.eventId,
			),
		).toBe(true);

		// 重连快照同样只包含修正后的检定
		await closeWs(pc2);
		const pc2Reconnect = await connectWs(
			wsUrl(),
			ctx.playerTokens.get("pc2")!,
		);
		const snapshot = await pc2Reconnect.waitFor((m) => m.type === "snapshot");
		const recent = snapshot.payload.recentHistory as Array<{
			kind: string;
			eventId: number;
			type?: string;
			payload?: Record<string, unknown>;
		}>;
		expect(
			recent.some(
				(item) =>
					item.kind === "activity" &&
					item.type === "check:resolved" &&
					item.eventId === successCheck.eventId,
			),
		).toBe(false);
		expect(
			recent.some(
				(item) =>
					item.kind === "activity" &&
					item.type === "check:amended" &&
					item.payload?.amendsEventId === successCheck.eventId,
			),
		).toBe(true);

		await closeWs(gm);
		await closeWs(pc1);
		await closeWs(pc2Reconnect);
	});
});
