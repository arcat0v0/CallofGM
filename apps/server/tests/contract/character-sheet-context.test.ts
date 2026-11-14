import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterDetailDto,
	CharacterSheetContextResponse,
	coc7e,
} from "@cogm/shared";
import { createApp } from "@/app";
import {
	characterGrowthEntries,
	sessionHistoryEvents,
} from "@/platform/db/schema";
import {
	listenTestApp,
	loginToken,
	seedPlayers,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const PASSWORD = "pl-flow-password";

describe("Character sheet context and v2 sheet fields", () => {
	let ctx: TestContext;
	let server: TestServer;
	let app: ReturnType<typeof createApp>;
	let plAToken = "";
	let plBToken = "";
	let plAId = "";
	let moduleId = "";

	function api(path: string, init: RequestInit & { token?: string } = {}) {
		const { token, ...rest } = init;
		return app.handle(
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
		app = createApp(ctx.container);

		const accounts = await seedPlayers(ctx.container.db, PASSWORD, [
			"ctx-a",
			"ctx-b",
		]);
		plAId = accounts.get("ctx-a")?.userId ?? "";
		plAToken = await loginToken(ctx.app, "ctx-a", PASSWORD);
		plBToken = await loginToken(ctx.app, "ctx-b", PASSWORD);

		const modRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "阿卡姆迷雾模组",
				description: "",
				ruleId: "coc7e",
			}),
		});
		moduleId = ((await modRes.json()) as { id: string }).id;
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	test("returns companions with mutual linkedToMe flag, non-archived phase records, growth entries, and enforces ownership", async () => {
		const attrs = {
			str: 55,
			con: 50,
			siz: 55,
			dex: 60,
			app: 50,
			int: 70,
			pow: 65,
			edu: 75,
			luck: 50,
		};
		// Create Char A (owned by ctx-a)
		const resA = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plAToken,
			body: JSON.stringify({
				name: "亚瑟·侦探",
				ruleId: "coc7e",
				background: "老派私家侦探",
				sheetData: {
					attributes: attrs,
					profile: {
						gender: "男",
						residence: "阿卡姆",
						birthplace: "波士顿",
						appearance: "风衣与烟斗",
						storiedInvestigator: true,
						experienceBonusPoints: 100,
					},
					gear: [
						{
							name: "怀表",
							quantity: 1,
							slot: "chest",
							status: "in_use",
							note: "父亲遗物",
							linkedPossession: true,
						},
					],
					experiences: [
						{
							id: "exp-init",
							title: "图书馆夜查",
							sourceType: "manual",
							refKind: null,
							refId: null,
							refLabel: "",
							summary: "发现禁书目录",
							changes: ["克苏鲁神话 +2"],
							occurredLabel: "1924 秋",
						},
					],
					skillAllocation: {
						侦查: { occupation: 20, interest: 10, experience: 5 },
					},
					skills: { 侦查: 60 },
				},
			}),
		});
		expect(resA.status).toBe(200);
		const charA = (await resA.json()) as { id: string; version: number };

		// Create Char B (owned by ctx-b) that links partnerCharacterId -> charA.id
		const resB = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plBToken,
			body: JSON.stringify({
				name: "安妮·医师",
				ruleId: "coc7e",
				background: "",
				sheetData: {
					attributes: attrs,
					skills: {},
					backgroundProfile: {
						partnerCharacterId: charA.id,
						partnerName: "亚瑟·侦探",
					},
				},
			}),
		});
		expect(resB.status).toBe(200);
		const charB = (await resB.json()) as { id: string };

		// Link both PCs to the module and create a session
		for (const characterId of [charA.id, charB.id]) {
			const linkRes = await api(`/api/v1/gm/modules/${moduleId}/characters`, {
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({ characterId }),
			});
			expect(linkRes.status).toBe(200);
		}
		const sessRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				moduleId,
				name: "血月夜",
				characterIds: [charA.id, charB.id],
			}),
		});
		expect(sessRes.status).toBe(200);
		const sessionId = ((await sessRes.json()) as { session: { id: string } })
			.session.id;

		// Transition session to active and change phase via real GM endpoint
		const prepRes = await api(`/api/v1/gm/sessions/${sessionId}/status`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ status: "preparing" }),
		});
		expect(prepRes.status).toBe(200);
		const activeRes = await api(`/api/v1/gm/sessions/${sessionId}/status`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ status: "active" }),
		});
		expect(activeRes.status).toBe(200);
		const phaseRes = await api(`/api/v1/gm/sessions/${sessionId}/phase`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ phase: "free_discussion" }),
		});
		expect(phaseRes.status).toBe(200);

		// Seed one legacy { to } phase event, one archived phase event, and one growth record
		await ctx.container.db.insert(sessionHistoryEvents).values([
			{
				id: "hist-phase-1",
				sessionId,
				eventId: 10,
				type: "session:phase-changed",
				payloadJson: JSON.stringify({ from: "running", to: "investigation" }),
				visibilityJson: JSON.stringify({ kind: "public" }),
				playerVisible: 1,
				anchorable: 1,
				occurredAt: 1_700_000_001_000,
				archivedAt: null,
				archivedByRewindId: null,
				createdAt: 1_700_000_001_000,
			},
			{
				id: "hist-phase-archived",
				sessionId,
				eventId: 11,
				type: "session:phase-changed",
				payloadJson: JSON.stringify({ phase: "forced_cg" }),
				visibilityJson: JSON.stringify({ kind: "public" }),
				playerVisible: 1,
				anchorable: 1,
				occurredAt: 1_700_000_002_000,
				archivedAt: 1_700_000_003_000,
				archivedByRewindId: "rewind-1",
				createdAt: 1_700_000_002_000,
			},
		]);

		await ctx.container.db.insert(characterGrowthEntries).values({
			id: "growth-1",
			characterId: charA.id,
			sessionId,
			skillKey: "侦查",
			oldValue: 60,
			newValue: 65,
			actorUserId: plAId,
			reason: "幕间成长",
			createdAt: 1_700_000_005_000,
		});

		// Owner reads PL sheet-context
		const plCtxRes = await api(
			`/api/v1/pl/characters/${charA.id}/sheet-context`,
			{ token: plAToken },
		);
		expect(plCtxRes.status).toBe(200);
		const plCtx = CharacterSheetContextResponse.parse(await plCtxRes.json());
		expect(plCtx.companions).toEqual([
			{
				characterId: charB.id,
				name: "安妮·医师",
				sessionId,
				sessionName: "血月夜",
				linkedToMe: true,
			},
		]);
		expect(plCtx.phaseRecords).toEqual([
			expect.objectContaining({
				sessionId,
				sessionName: "血月夜",
				phase: "free_discussion",
			}),
			{
				eventId: 10,
				sessionId,
				sessionName: "血月夜",
				phase: "investigation",
				occurredAt: 1_700_000_001_000,
			},
		]);
		expect(plCtx.growthRecords).toHaveLength(1);
		expect(plCtx.growthRecords[0]).toMatchObject({
			id: "growth-1",
			skillKey: "侦查",
			oldValue: 60,
			newValue: 65,
		});

		// Other PL cannot read Char A's sheet-context
		const forbiddenPl = await api(
			`/api/v1/pl/characters/${charA.id}/sheet-context`,
			{ token: plBToken },
		);
		expect(forbiddenPl.status).toBe(404);

		// PL cannot access GM route; GM can read Char A's sheet-context
		const plOnGmRoute = await api(
			`/api/v1/gm/characters/${charA.id}/sheet-context`,
			{ token: plAToken },
		);
		expect(plOnGmRoute.status).toBe(403);

		const gmCtxRes = await api(
			`/api/v1/gm/characters/${charA.id}/sheet-context`,
			{ token: ctx.gmToken },
		);
		expect(gmCtxRes.status).toBe(200);
		const gmCtx = CharacterSheetContextResponse.parse(await gmCtxRes.json());
		expect(gmCtx.companions[0]?.linkedToMe).toBe(true);

		// Verify v2 fields persisted intact
		const detailRes = await api(`/api/v1/pl/characters/${charA.id}`, {
			token: plAToken,
		});
		expect(detailRes.status).toBe(200);
		const detail = CharacterDetailDto.parse(await detailRes.json());
		const parsedSheet = coc7e.Coc7eCharacterSheet.parse(
			JSON.parse(detail.sheetJson),
		);
		expect(parsedSheet.profile.storiedInvestigator).toBe(true);
		expect(parsedSheet.gear[0]).toMatchObject({
			name: "怀表",
			slot: "chest",
			status: "in_use",
			linkedPossession: true,
		});
		expect(parsedSheet.experiences[0]?.title).toBe("图书馆夜查");
		expect(parsedSheet.skillAllocation["侦查"]).toEqual({
			occupation: 20,
			interest: 10,
			experience: 5,
		});
	});
});
