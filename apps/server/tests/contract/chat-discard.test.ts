import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	closeWs,
	connectWs,
	listenTestApp,
	sendCommand,
	setSessionPhase,
	setupTestApp,
	type TestContext,
	type TestServer,
	type TestWebSocket,
} from "../helpers/setup";

describe("Chat discard traceability contract", () => {
	let ctx: TestContext;
	let server: TestServer;
	const wsUrl = () =>
		`ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

	beforeAll(async () => {
		ctx = await setupTestApp({
			players: ["pc1"],
			characters: [{ id: "char-pc1", name: "调查员一号", kind: "pc" }],
			claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
		});
		server = listenTestApp(ctx.app);
		await setSessionPhase(ctx, "performance_time");
	});

	afterAll(async () => {
		await server.stop(true);
		ctx.container.dbContext.sqlite.close();
	});

	async function openAll() {
		const gm = await connectWs(wsUrl(), ctx.gmToken);
		const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		await Promise.all([
			gm.waitFor((m) => m.type === "snapshot"),
			pc.waitFor((m) => m.type === "snapshot"),
		]);
		return { gm, pc };
	}

	async function enqueue(
		pc: TestWebSocket,
		content: string,
		commandId: string,
	): Promise<string> {
		sendCommand(pc, "chat:send", { channel: "roleplay", content }, commandId);
		const reply = await pc.waitFor((m) => m.commandId === commandId);
		expect(reply.type).toBe("command:accepted");
		expect(reply.payload.presented).toBe(false);
		return reply.payload.messageId as string;
	}

	test("丢弃后恢复：消息回到队尾并可在后续放行", async () => {
		const { gm, pc } = await openAll();

		const firstId = await enqueue(pc, "第一条待审", "d-1");
		const secondId = await enqueue(pc, "第二条待审", "d-2");
		await gm.waitFor(
			(m) => m.type === "chat:queue" && m.payload.messages.length === 2,
		);

		sendCommand(gm, "chat:discard", { messageId: firstId }, "d-discard");
		const discardReply = await gm.waitFor((m) => m.commandId === "d-discard");
		expect(discardReply.type).toBe("command:accepted");

		const rejected = await pc.waitFor(
			(m) => m.type === "chat:rejected" && m.payload.messageId === firstId,
		);
		expect(rejected.payload.reason).toBeNull();

		const afterDiscard = await gm.waitFor(
			(m) =>
				m.type === "chat:queue" &&
				m.payload.messages.length === 1 &&
				(m.payload.discarded ?? []).some(
					(msg: { id: string }) => msg.id === firstId,
				),
		);
		expect(afterDiscard.payload.messages[0].id).toBe(secondId);

		expect(
			pc.messages.some(
				(m) => m.type === "chat:message" && m.payload.message.id === firstId,
			),
		).toBe(false);

		const snapshotGm = await connectWs(wsUrl(), ctx.gmToken);
		const gmSnapshot = await snapshotGm.waitFor((m) => m.type === "snapshot");
		expect(
			gmSnapshot.payload.discardedQueue.map((msg: { id: string }) => msg.id),
		).toContain(firstId);
		expect(
			gmSnapshot.payload.pendingQueue.map((msg: { id: string }) => msg.id),
		).not.toContain(firstId);

		const snapshotPc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
		const pcSnapshot = await snapshotPc.waitFor((m) => m.type === "snapshot");
		expect(pcSnapshot.payload.discardedQueue).toBeUndefined();

		sendCommand(gm, "chat:restore", { messageId: firstId }, "d-restore");
		const restoreReply = await gm.waitFor((m) => m.commandId === "d-restore");
		expect(restoreReply.type).toBe("command:accepted");
		expect(restoreReply.payload.messageId).toBe(firstId);

		const snapshotPcRestored = await connectWs(
			wsUrl(),
			ctx.playerTokens.get("pc1")!,
		);
		const restoredSnapshot = await snapshotPcRestored.waitFor(
			(m) => m.type === "snapshot",
		);
		expect(
			(restoredSnapshot.payload.ownPendingMessages ?? []).some(
				(msg: { id: string }) => msg.id === firstId,
			),
		).toBe(true);

		const afterRestore = await gm.waitFor(
			(m) =>
				m.type === "chat:queue" &&
				m.payload.messages.length === 2 &&
				m.payload.messages[0]?.id === secondId &&
				m.payload.messages[1]?.id === firstId &&
				(m.payload.discarded ?? []).length === 0,
		);
		expect(
			afterRestore.payload.messages.map((msg: { id: string }) => msg.id),
		).toEqual([secondId, firstId]);

		sendCommand(gm, "chat:release", { messageId: firstId }, "d-release");
		const presented = await pc.waitFor(
			(m) => m.type === "chat:message" && m.payload.message.id === firstId,
		);
		expect(presented.payload.message.content).toBe("第一条待审");

		await closeWs(snapshotGm);
		await closeWs(snapshotPc);
		await closeWs(snapshotPcRestored);
		await closeWs(gm);
		await closeWs(pc);
	});

	test("恢复：仅 GM 可用，非丢弃状态返回 MESSAGE_NOT_PENDING", async () => {
		const { gm, pc } = await openAll();

		const id = await enqueue(pc, "仍在队列", "r-1");

		sendCommand(pc, "chat:restore", { messageId: id }, "r-player");
		const pcReply = await pc.waitFor((m) => m.commandId === "r-player");
		expect(pcReply.type).toBe("command:rejected");
		expect(pcReply.payload.code).toBe("FORBIDDEN");

		sendCommand(gm, "chat:restore", { messageId: id }, "r-pending");
		const gmReply = await gm.waitFor((m) => m.commandId === "r-pending");
		expect(gmReply.type).toBe("command:rejected");
		expect(gmReply.payload.code).toBe("MESSAGE_NOT_PENDING");

		await closeWs(gm);
		await closeWs(pc);
	});
});
