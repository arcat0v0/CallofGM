import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CharacterDto,
	CharacterInviteDto,
	CharacterInviteInfoResponse,
	CharacterReviewDto,
	ClaimDto,
	CreateSessionResponse,
	dnd5r,
	JoinInfoResponse,
	RuleListResponse,
	SessionDetailResponse,
	SessionSnapshotPayload,
} from "@cogm/shared";
import { createApp } from "@/app";
import { Container } from "@/bootstrap/container";
import { buildCommandHandlers } from "@/bootstrap/handlers";
import {
	closeWs,
	connectWs,
	listenTestApp,
	ScriptedRandomSource,
	sendCommand,
	setupTestApp,
	stopServer,
	type TestWebSocket,
	testAppConfig,
} from "../helpers/setup";

async function snapshot(socket: TestWebSocket) {
	const message = await socket.waitFor((item) => item.type === "snapshot");
	return SessionSnapshotPayload.parse(message.payload);
}

async function reply(socket: TestWebSocket, type: string, payload: unknown) {
	const id = crypto.randomUUID();
	sendCommand(socket, type, payload, id);
	return socket.waitFor((item) => item.commandId === id);
}

async function accepted(socket: TestWebSocket, type: string, payload: unknown) {
	const result = await reply(socket, type, payload);
	expect(result).toMatchObject({ type: "command:accepted" });
	return result.payload;
}

test("a player-created 5R character joins by review and plays through rewind and restart", async () => {
	const random = new ScriptedRandomSource([]);
	const dir = await mkdtemp(join(tmpdir(), "cogm-dnd5r-"));
	const databaseUrl = join(dir, "campaign.sqlite");
	const fixture = await setupTestApp({
		randomSource: random,
		databaseUrl,
		themesDir: join(dir, "themes"),
		plAccounts: ["dnd-player"],
		players: ["dnd-observer"],
	});
	let container = fixture.container;
	let server = listenTestApp(fixture.app);
	const sockets: TestWebSocket[] = [];
	const pcToken = fixture.plTokens.get("dnd-player")!;
	const obToken = fixture.playerTokens.get("dnd-observer")!;
	const { gmToken } = fixture;
	async function request(
		path: string,
		token: string,
		method = "GET",
		body?: unknown,
	) {
		const response = await fetch(
			`http://127.0.0.1:${server.server.port}/api/v1${path}`,
			{
				method,
				headers: {
					Authorization: `Bearer ${token}`,
					...(body === undefined ? {} : { "Content-Type": "application/json" }),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			},
		);
		const result = await response.json();
		expect({ path, status: response.status, result }).toMatchObject({
			status: 200,
		});
		return result;
	}
	try {
		const rules = RuleListResponse.parse(await request("/rules", gmToken));
		expect(rules.map(({ id }) => id)).toEqual(["coc7e", "dnd5r"]);
		expect(rules.map(({ permanentFieldRange }) => permanentFieldRange)).toEqual(
			[
				{ min: 1, max: 99 },
				{ min: 1, max: 30 },
			],
		);
		const base = dnd5r.createBlankSheet();
		const pc = CharacterDto.parse(
			await request("/pl/characters", pcToken, "POST", {
				name: "Rook",
				ruleId: "dnd5r",
				background: "Veteran scout from the northern border.",
				sheetData: base,
			}),
		);
		expect(pc).toMatchObject({
			ownerId: fixture.plIds.get("dnd-player"),
			ownerKind: "pl",
			kind: "pc",
		});
		const goblin = CharacterDto.parse(
			await request("/gm/characters", gmToken, "POST", {
				name: "Bridge Guard",
				kind: "npc",
				ruleId: "dnd5r",
				sheetData: { ...base, creatureId: "goblin-warrior", maxHpOverride: 24 },
			}),
		);
		const { id: moduleId } = (await request("/gm/modules", gmToken, "POST", {
			name: "The Broken Bridge",
			description: "A crossing contested by a small patrol",
			ruleId: "dnd5r",
		})) as { id: string };
		await request(`/gm/modules/${moduleId}/characters`, gmToken, "POST", {
			characterId: goblin.id,
		});
		const { session } = CreateSessionResponse.parse(
			await request("/gm/sessions", gmToken, "POST", {
				moduleId,
				characterIds: [goblin.id],
			}),
		);
		const invite = CharacterInviteDto.parse(
			await request("/gm/invites", gmToken, "POST", {
				scope: "session",
				targetId: session.id,
			}),
		);
		expect(invite.token).not.toBeNull();
		const invitePath = `/pl/invites/${encodeURIComponent(invite.token!)}`;
		expect(
			CharacterInviteInfoResponse.parse(await request(invitePath, pcToken)),
		).toMatchObject({
			scope: "session",
			targetId: session.id,
			ruleId: "dnd5r",
			ownedCharacters: [{ id: pc.id, alreadySubmitted: false }],
		});
		const submission = (await request(
			`${invitePath}/submissions`,
			pcToken,
			"POST",
			{
				mode: "existing",
				characterId: pc.id,
			},
		)) as { reviewId: string; characterId: string };
		expect(submission.characterId).toBe(pc.id);
		const pendingReviews = CharacterReviewDto.array().parse(
			await request("/gm/reviews?status=pending", gmToken),
		);
		expect(
			pendingReviews.find(({ id }) => id === submission.reviewId),
		).toMatchObject({
			status: "pending",
			targetId: session.id,
			characterId: pc.id,
			submittedSheetVersion: pc.sheetVersion,
		});
		const joinInfoPath = `/public/sessions/${session.id}/join-info`;
		expect(
			JoinInfoResponse.parse(await request(joinInfoPath, pcToken)).characters,
		).toEqual([]);
		await request(
			`/gm/reviews/${submission.reviewId}/decide`,
			gmToken,
			"POST",
			{
				approve: true,
			},
		);
		const approvedReviews = CharacterReviewDto.array().parse(
			await request("/pl/submissions", pcToken),
		);
		expect(
			approvedReviews.find(({ id }) => id === submission.reviewId)?.status,
		).toBe("approved");
		expect(
			JoinInfoResponse.parse(await request(joinInfoPath, pcToken)).characters,
		).toMatchObject([{ id: pc.id, claimable: true, claimed: false }]);
		const endpoints = `/gm/sessions/${session.id}`;
		const publicEndpoints = `/sessions/${session.id}`;
		const detail = SessionDetailResponse.parse(
			await request(endpoints, gmToken),
		);
		expect(
			detail.characters.map(({ characterId, state }) => ({
				characterId,
				state,
			})),
		).toEqual(
			expect.arrayContaining(
				[pc.id, goblin.id].map((characterId) => ({
					characterId,
					state: expect.objectContaining({
						sessionId: session.id,
						characterId,
					}),
				})),
			),
		);
		await request(`${endpoints}/status`, gmToken, "POST", {
			status: "preparing",
		});
		const claim = ClaimDto.parse(
			await request(`${publicEndpoints}/claim`, pcToken, "POST", {
				role: "pc",
				characterId: pc.id,
			}),
		);
		expect(claim).toMatchObject({ role: "pc", characterId: pc.id });
		await request(`${publicEndpoints}/claim`, obToken, "POST", { role: "ob" });
		await request(`${endpoints}/status`, gmToken, "POST", { status: "active" });
		async function connect(token: string) {
			const connection = await connectWs(
				`ws://127.0.0.1:${server.server.port}/api/v1${publicEndpoints}/ws`,
				token,
			);
			sockets.push(connection);
			return connection;
		}
		const gm = await connect(gmToken);
		let player = await connect(pcToken);
		const ob = await connect(obToken);
		const initial = await snapshot(player);
		expect(
			initial.characters.find(({ characterId }) => characterId === goblin.id),
		).toMatchObject({ state: null, sheet: null });
		expect(
			dnd5r.SessionState.parse(
				initial.characters.find(({ characterId }) => characterId === pc.id)
					?.state,
			),
		).toMatchObject({ hp: 12, hitDice: 1 });
		await expect(
			reply(gm, "check:san", { characterId: pc.id, sanLossExpression: "0/1" }),
		).resolves.toMatchObject({
			type: "command:rejected",
			payload: { code: "RULE_ACTION_UNSUPPORTED" },
		});
		await expect(
			reply(gm, "luck:recover", { characterId: pc.id }),
		).resolves.toMatchObject({
			type: "command:rejected",
			payload: { code: "RULE_ACTION_UNSUPPORTED" },
		});
		await expect(
			reply(player, "check:spend-luck", {
				characterId: pc.id,
				eventId: 1,
				points: 1,
			}),
		).resolves.toMatchObject({
			type: "command:rejected",
			payload: { code: "LUCK_SPEND_NOT_LATEST" },
		});
		await expect(
			reply(ob, "check:perform", {
				characterId: pc.id,
				skillKey: "skill:athletics",
			}),
		).resolves.toMatchObject({ type: "command:rejected" });
		await expect(
			reply(player, "check:perform", {
				characterId: goblin.id,
				skillKey: "attack:shortbow",
			}),
		).resolves.toMatchObject({ type: "command:rejected" });
		await expect(
			reply(player, "rule:action", {
				action: "damage",
				characterId: pc.id,
				input: { amount: 1 },
			}),
		).resolves.toMatchObject({ type: "command:rejected" });
		await expect(
			reply(player, "check:perform", {
				characterId: pc.id,
				skillKey: "attack:longsword",
				options: { targetId: goblin.id },
			}),
		).resolves.toMatchObject({ type: "command:rejected" });

		const encounterStart = {
			action: "encounter-start",
			input: {
				characterIds: [pc.id, goblin.id],
				initiatives: { [pc.id]: 16, [goblin.id]: 12 },
			},
		};
		await accepted(gm, "rule:action", encounterStart);
		const start = await player.waitFor(
			(item) => item.type === "rule:state-changed",
		);
		expect(dnd5r.EncounterState.parse(start.payload.state)).toMatchObject({
			round: 1,
			turnIndex: 0,
			combatants: [
				{ characterId: pc.id, initiative: 16 },
				{ characterId: goblin.id, initiative: 12 },
			],
		});
		const { requestId } = await accepted(gm, "check:request", {
			characterId: pc.id,
			skillKey: "save:con",
			difficulty: "extreme",
			bonusDice: 2,
			options: { mode: "advantage", dc: 16 },
			hidden: true,
		});
		await closeWs(player);
		player = await connect(pcToken);
		const rejoined = await snapshot(player);
		expect(rejoined.pendingCheckRequests).toMatchObject([
			{ id: requestId, options: { mode: "advantage", dc: 16 } },
		]);
		expect(rejoined.ruleState).toEqual(start.payload.state);
		expect((await snapshot(ob)).pendingCheckRequests).toEqual([]);
		await request(`${endpoints}/phase`, gmToken, "POST", {
			phase: "forced_cg",
		});
		await expect(
			reply(player, "check:perform", {
				characterId: pc.id,
				skillKey: "save:con",
			}),
		).resolves.toMatchObject({ type: "command:rejected" });
		random.push(4, 11);
		expect(await accepted(player, "check:respond", { requestId })).toEqual({
			requestId,
			rolled: true,
			hidden: true,
		});
		const hidden = await gm.waitFor(
			(item) =>
				item.type === "check:resolved" && item.payload.requestId === requestId,
		);
		expect(dnd5r.CheckResult.parse(hidden.payload.result)).toMatchObject({
			mode: "advantage",
			rolls: [4, 11],
			roll: 11,
			modifier: 4,
			total: 15,
			dc: 16,
			outcome: "failure",
		});
		const obHistory = await accepted(ob, "history:page", {});
		expect(
			obHistory.history.items.some(
				(item: { eventId: number }) => item.eventId === hidden.eventId,
			),
		).toBe(false);
		await request(`${endpoints}/phase`, gmToken, "POST", {
			phase: "free_discussion",
		});
		random.push(20, 8, 5);
		await accepted(player, "check:perform", {
			characterId: pc.id,
			skillKey: "attack:longsword",
			options: { targetId: goblin.id },
		});
		const strike = await player.waitFor(
			(item) =>
				item.type === "check:resolved" &&
				item.payload.skillKey === "attack:longsword",
		);
		expect(dnd5r.CheckResult.parse(strike.payload.result)).toMatchObject({
			dc: null,
			outcome: "critical",
			targetId: goblin.id,
			damage: { rolls: [8, 5], total: 16 },
		});
		const gmState = await gm.waitFor(
			(item) =>
				item.type === "state:changed" && item.payload.characterId === goblin.id,
		);
		expect(gmState.payload.state.hp).toBe(8);
		const afterStrike = await snapshot(await connect(pcToken));
		expect(
			afterStrike.characters.find(
				({ characterId }) => characterId === goblin.id,
			)?.state,
		).toBeNull();
		await accepted(gm, "rule:action", { action: "encounter-next" });
		const turn = await player.waitFor(
			(item) =>
				item.type === "rule:state-changed" &&
				item.payload.state.turnIndex === 1,
		);
		expect(turn.payload.state.round).toBe(1);
		const preview = await accepted(gm, "history:preview-rewind", {
			anchorEventId: hidden.eventId,
		});
		expect(preview).toMatchObject({
			preview: { ruleStateChanged: true, revertedCheckCount: 1 },
		});
		await accepted(gm, "history:rewind", { anchorEventId: hidden.eventId });
		const rewound = await gm.waitFor(
			(item) =>
				item.type === "session:rewound" && item.payload.action === "rewind",
		);
		const restored = await snapshot(await connect(pcToken));
		expect(restored.pendingCheckRequests).toMatchObject([
			{ id: requestId, options: { dc: 16 } },
		]);
		expect(restored.ruleState).toEqual(start.payload.state);
		const restoredGm = await snapshot(await connect(gmToken));
		expect(
			restoredGm.characters.find(({ characterId }) => characterId === goblin.id)
				?.state,
		).toMatchObject({ hp: 24 });
		await accepted(gm, "history:undo-rewind", {
			rewindId: rewound.payload.rewindId,
		});
		const undone = await snapshot(await connect(gmToken));
		expect(undone.ruleState).toEqual(turn.payload.state);
		expect(undone.pendingCheckRequests).toEqual([]);
		expect(
			undone.characters.find(({ characterId }) => characterId === goblin.id)
				?.state,
		).toMatchObject({ hp: 8 });

		await accepted(gm, "rule:action", {
			action: "damage",
			characterId: pc.id,
			input: { amount: 12 },
		});
		random.push(1);
		await accepted(player, "check:perform", {
			characterId: pc.id,
			skillKey: "death",
			difficulty: "extreme",
			bonusDice: 2,
		});
		let dying = await snapshot(await connect(gmToken));
		expect(
			dying.characters.find(({ characterId }) => characterId === pc.id)?.state,
		).toMatchObject({ hp: 0, deathSaves: { failures: 2, dead: false } });
		random.push(20);
		await accepted(player, "check:perform", {
			characterId: pc.id,
			skillKey: "death",
		});
		random.push(5);
		await accepted(gm, "rule:action", {
			action: "short-rest",
			characterId: pc.id,
			input: { hitDice: 1 },
		});
		await accepted(gm, "rule:action", {
			action: "resource",
			characterId: pc.id,
			input: { id: "second-wind", delta: -1 },
		});
		const current = CharacterDto.parse(
			await request(`/pl/characters/${pc.id}`, pcToken),
		);
		const updated = CharacterDto.parse(
			await request(`/pl/characters/${pc.id}`, pcToken, "PATCH", {
				expectedVersion: current.version,
				sheetData: { ...base, level: 2 },
			}),
		);
		const syncPath = `${endpoints}/characters/${pc.id}`;
		expect(await request(`${syncPath}/sync-preview`, gmToken)).toMatchObject({
			statePreview: {
				current: { hp: 8, maxHp: 12, hitDice: 0, maxHitDice: 1 },
				next: { hp: 8, maxHp: 20, hitDice: 1, maxHitDice: 2 },
			},
		});
		await request(`${syncPath}/sync`, gmToken, "POST", {
			expectedVersion: updated.version,
			fields: ["sheet"],
		});
		dying = await snapshot(await connect(gmToken));
		expect(
			dying.characters.find(({ characterId }) => characterId === pc.id)?.state,
		).toMatchObject({
			hp: 8,
			maxHp: 20,
			hitDice: 1,
			resources: { "second-wind": { current: 1, max: 2 } },
		});
		await accepted(gm, "rule:action", {
			action: "long-rest",
			characterId: pc.id,
		});
		const camp = await snapshot(await connect(gmToken));
		expect(
			camp.characters.find(({ characterId }) => characterId === pc.id)?.state,
		).toMatchObject({
			hp: 20,
			hitDice: 2,
			resources: { "second-wind": { current: 2, max: 2 } },
		});
		const pendingAfterCamp = await accepted(gm, "check:request", {
			characterId: pc.id,
			skillKey: "skill:survival",
			options: { dc: 12 },
		});
		await Promise.all(sockets.splice(0).map(closeWs));
		await stopServer(server);
		container.dbContext.sqlite.close();
		container = new Container([], {
			config: testAppConfig({
				databaseUrl,
				themesDir: join(dir, "themes"),
			}),
		});
		await container.startupService.startup();
		container.sessionCommandExecutor.registerHandlers(
			buildCommandHandlers(container),
		);
		server = listenTestApp(createApp(container));
		const rebooted = await snapshot(await connect(pcToken));
		expect(rebooted.ruleState).toEqual(turn.payload.state);
		expect(rebooted.pendingCheckRequests).toMatchObject([
			{ id: pendingAfterCamp.requestId, options: { dc: 12 } },
		]);
		expect(
			rebooted.characters.find(({ characterId }) => characterId === pc.id)
				?.state,
		).toMatchObject({ hp: 20, maxHp: 20, hitDice: 2 });
		const rebootedGm = await connect(gmToken);
		const removalPath = `${endpoints}/npcs/${goblin.id}`;
		expect(await request(removalPath, gmToken, "DELETE")).toEqual({
			characterId: goblin.id,
			removed: true,
		});
		const afterRemoval = await snapshot(await connect(gmToken));
		expect(
			afterRemoval.characters.some(
				({ characterId }) => characterId === goblin.id,
			),
		).toBe(false);
		expect(afterRemoval.ruleState).toMatchObject({
			round: 2,
			turnIndex: 0,
			combatants: [{ characterId: pc.id }],
		});
		await accepted(rebootedGm, "history:rewind", {
			anchorEventId: turn.eventId,
		});
		const afterRemovalRewind = await snapshot(await connect(gmToken));
		expect(afterRemovalRewind.ruleState).toMatchObject({
			round: 1,
			turnIndex: 0,
			combatants: [{ characterId: pc.id }],
		});
		await request(`${endpoints}/npcs`, gmToken, "POST", {
			characterId: goblin.id,
		});
		await accepted(rebootedGm, "rule:action", {
			action: "encounter-start",
			input: { characterIds: [goblin.id] },
		});
		await request(removalPath, gmToken, "DELETE");
		expect((await snapshot(await connect(gmToken))).ruleState).toBeNull();
		await expect(
			reply(rebootedGm, "rule:action", { action: "encounter-next" }),
		).resolves.toMatchObject({ type: "command:rejected" });
		for (const characterIds of [[], [goblin.id]]) {
			await expect(
				reply(rebootedGm, "rule:action", {
					action: "encounter-start",
					input: { characterIds },
				}),
			).resolves.toMatchObject({ type: "command:rejected" });
		}
		await request(`${endpoints}/status`, gmToken, "POST", { status: "ended" });
		const growth = await fetch(
			`http://127.0.0.1:${server.server.port}/api/v1${endpoints}/growth/confirm`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${gmToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					gains: [{ skillKey: "credit rating", delta: 5 }],
				}),
			},
		);
		expect(growth.status).toBe(400);
		expect(await growth.json()).toMatchObject({
			code: "RULE_ACTION_UNSUPPORTED",
		});
		const afterGrowth = CharacterDto.parse(
			await request(`/pl/characters/${pc.id}`, pcToken),
		);
		expect(afterGrowth.version).toBe(updated.version);
	} finally {
		await Promise.all(sockets.map(closeWs));
		await stopServer(server);
		container.dbContext.sqlite.close();
		await rm(dir, { recursive: true, force: true });
	}
}, 15000);
