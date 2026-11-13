import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterDetailDto,
	CharacterDto,
	CharacterInviteDto,
	CharacterInviteInfoResponse,
	type CharacterReviewDto,
	CharacterSyncDiffDto,
	coc7e,
	ModuleDto,
} from "@cogm/shared";
import { createApp } from "@/app";
import {
	listenTestApp,
	loginToken,
	seedPlayers,
	setupTestApp,
	stopServer,
	type TestContext,
	type TestServer,
} from "../helpers/setup";

const PASSWORD = "invite-flow-password";

describe("Invite, submit and review chain", () => {
	let ctx: TestContext;
	let server: TestServer;
	let plToken = "";
	let otherPlToken = "";
	let plUserId = "";
	let otherPlUserId = "";
	let moduleId = "";
	let fullApp: ReturnType<typeof createApp>;

	function api(
		path: string,
		init: RequestInit & { token?: string } = {},
	): Promise<Response> {
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

	function fullApi(
		path: string,
		init: RequestInit & { token?: string } = {},
	): Promise<Response> {
		const { token, ...rest } = init;
		return fullApp.handle(
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
		fullApp = createApp(ctx.container);

		const accounts = await seedPlayers(ctx.container.db, PASSWORD, [
			"invite-a",
			"invite-b",
		]);
		plUserId = accounts.get("invite-a")!.userId;
		otherPlUserId = accounts.get("invite-b")!.userId;
		plToken = await loginToken(ctx.app, "invite-a", PASSWORD);
		otherPlToken = await loginToken(ctx.app, "invite-b", PASSWORD);

		const moduleRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "邀请流程模组",
				description: "",
				ruleId: "coc7e",
			}),
		});
		moduleId = ModuleDto.parse(await moduleRes.json()).id;
	});

	afterAll(async () => {
		await stopServer(server);
		ctx.container.dbContext.sqlite.close();
	});

	async function createInvite(scope: "module" | "session", targetId: string) {
		const res = await api("/api/v1/gm/invites", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ scope, targetId, expiresInDays: 7 }),
		});
		expect(res.status).toBe(200);
		return CharacterInviteDto.parse(await res.json());
	}

	async function createPlCharacter(name: string) {
		const res = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name,
				ruleId: "coc7e",
				sheetData: {
					attributes: {
						str: 50,
						con: 50,
						siz: 50,
						dex: 50,
						app: 50,
						int: 60,
						pow: 60,
						edu: 70,
						luck: 50,
					},
					skills: { 侦查: 40 },
				},
			}),
		});
		expect(res.status).toBe(200);
		return CharacterDto.parse(await res.json());
	}

	function completeCoc7eSheet() {
		return coc7e.normalizeCoc7eSheet({
			schemaVersion: 2,
			era: "1920s",
			age: 42,
			occupation: {
				presetId: "occ-220",
				name: "记者",
				skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
				creditMin: 9,
				creditMax: 30,
				skillKeys: ["历史", "图书馆"],
				choiceSelections: {},
				freeSkillKeys: [],
			},
			movementModifier: -2,
			attributes: {
				str: 60,
				con: 65,
				siz: 70,
				dex: 55,
				app: 45,
				int: 80,
				pow: 60,
				edu: 75,
				luck: 50,
			},
			skills: { 侦查: 65, "格斗(斗殴)": 45, 克苏鲁神话: 3 },
			customSkills: {
				"语言(法语)": { base: 1 },
				"母语(英语)": { base: 0, formula: "edu" },
			},
			weapons: [
				{
					name: "点三八左轮",
					skillKey: "射击(手枪)",
					damage: "1D10",
					range: "15码",
					attacks: "1",
					ammo: 6,
					malfunction: 100,
					impale: false,
					applyDamageBonus: false,
				},
			],
			armor: { name: "皮夹克", value: 1, locations: "躯干", penalty: 0 },
			gear: [
				{ name: "笔记本", quantity: 2 },
				{ name: "手电筒", quantity: 1 },
			],
			spells: [
				{
					name: "心灵感应",
					mpCost: "3",
					sanCost: "1D3",
					castingTime: "1轮",
					effect: "读取表层思绪",
				},
			],
			mythosTomes: [
				{
					name: "无名祭祀书",
					sanLoss: "1D6",
					mythosGain: 2,
					studyHours: 12,
					spells: "心灵感应",
				},
			],
			encounters: [
				{
					name: "深潜者",
					sanLoss: "1/1D6",
					mythosGain: 1,
					count: 2,
					notes: "港口遭遇",
				},
			],
			assets: {
				currency: "$",
				spendingLevel: 10,
				cash: 82.5,
				otherAssets: 2050,
				details: [{ category: "residence", name: "公寓", value: 2000 }],
			},
		});
	}

	function expectCompleteCoc7eSheet(sheet: coc7e.Coc7eCharacterSheet) {
		expect(sheet.schemaVersion).toBe(2);
		expect(sheet.era).toBe("1920s");
		expect(sheet.age).toBe(42);
		expect(sheet.occupation).toEqual({
			presetId: "occ-220",
			name: "记者",
			skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
			creditMin: 9,
			creditMax: 30,
			skillKeys: ["历史", "图书馆"],
			choiceSelections: {},
			freeSkillKeys: [],
		});
		expect(sheet.movementModifier).toBe(-2);
		expect(sheet.attributes.str).toBe(60);
		expect(sheet.attributes.edu).toBe(75);
		expect(sheet.skills["侦查"]).toBe(65);
		expect(sheet.skills["格斗(斗殴)"]).toBe(45);
		expect(sheet.customSkills["语言(法语)"]).toEqual({ base: 1 });
		expect(sheet.customSkills["母语(英语)"]).toEqual({
			base: 0,
			formula: "edu",
		});
		expect(sheet.weapons[0]).toMatchObject({
			name: "点三八左轮",
			skillKey: "射击(手枪)",
			damage: "1D10",
			ammo: 6,
		});
		expect(sheet.armor).toEqual({
			name: "皮夹克",
			value: 1,
			locations: "躯干",
			penalty: 0,
		});
		expect(sheet.gear[0]).toEqual({ name: "笔记本", quantity: 2 });
		expect(sheet.spells[0]?.name).toBe("心灵感应");
		expect(sheet.mythosTomes[0]?.name).toBe("无名祭祀书");
		expect(sheet.mythosTomes[0]?.mythosGain).toBe(2);
		expect(sheet.encounters[0]?.name).toBe("深潜者");
		expect(sheet.encounters[0]?.count).toBe(2);
		expect(sheet.assets.cash).toBe(82.5);
		expect(sheet.assets.details[0]).toEqual({
			category: "residence",
			name: "公寓",
			value: 2000,
		});
	}

	function countCharacters(): number {
		return (
			ctx.container.dbContext.sqlite
				.query<{ count: number }, []>(
					"select count(*) as count from characters",
				)
				.get()?.count ?? 0
		);
	}

	function countReviews(): number {
		return (
			ctx.container.dbContext.sqlite
				.query<{ count: number }, []>(
					"select count(*) as count from character_reviews",
				)
				.get()?.count ?? 0
		);
	}

	function countActiveClaims(sessionId: string): number {
		return (
			ctx.container.dbContext.sqlite
				.query<{ count: number }, [string]>(
					"select count(*) as count from session_claims where session_id = ? and released_at is null",
				)
				.get(sessionId)?.count ?? 0
		);
	}

	async function createSession(characterIds: string[] = []): Promise<string> {
		const res = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds }),
		});
		expect(res.status).toBe(200);
		return ((await res.json()) as { session: { id: string } }).session.id;
	}

	async function createCharacterFor(
		token: string,
		name: string,
	): Promise<CharacterDto> {
		const res = await api("/api/v1/pl/characters", {
			method: "POST",
			token,
			body: JSON.stringify({
				name,
				ruleId: "coc7e",
				sheetData: {
					attributes: {
						str: 50,
						con: 50,
						siz: 50,
						dex: 50,
						app: 50,
						int: 60,
						pow: 60,
						edu: 70,
						luck: 50,
					},
					skills: { 侦查: 40 },
				},
			}),
		});
		expect(res.status).toBe(200);
		return CharacterDto.parse(await res.json());
	}

	async function bumpSheetVersion(
		token: string,
		characterId: string,
		spotValue: number,
	): Promise<CharacterDto> {
		const detailRes = await api(`/api/v1/pl/characters/${characterId}`, {
			token,
		});
		expect(detailRes.status).toBe(200);
		const detail = CharacterDetailDto.parse(await detailRes.json());
		const sheet = coc7e.Coc7eCharacterSheet.parse(JSON.parse(detail.sheetJson));
		const patchRes = await api(`/api/v1/pl/characters/${characterId}`, {
			method: "PATCH",
			token,
			body: JSON.stringify({
				sheetData: {
					...sheet,
					skills: { ...sheet.skills, 侦查: spotValue },
				},
				expectedVersion: detail.version,
			}),
		});
		expect(patchRes.status).toBe(200);
		return CharacterDto.parse(await patchRes.json());
	}

	test("模组链接：PL 可查看邀请信息并提交已有同规则人物", async () => {
		const invite = await createInvite("module", moduleId);
		expect(invite.token).not.toBeNull();

		const infoRes = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}`,
			{ token: plToken },
		);
		expect(infoRes.status).toBe(200);
		const info = CharacterInviteInfoResponse.parse(await infoRes.json());
		expect(info.scope).toBe("module");
		expect(info.targetId).toBe(moduleId);
		expect(info.ruleId).toBe("coc7e");

		const character = await createPlCharacter("提交人物甲");
		const submit = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			},
		);
		expect(submit.status).toBe(200);
		const submitted = (await submit.json()) as {
			reviewId: string;
			characterId: string;
		};
		expect(submitted.characterId).toBe(character.id);

		const duplicate = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			},
		);
		expect(duplicate.status).toBe(409);
	});

	test("模组链接：GM 通过后人物加入模组，PL 可见提交状态", async () => {
		const invite = await createInvite("module", moduleId);
		const character = await createPlCharacter("提交人物乙");
		const submit = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			},
		);
		const { reviewId } = (await submit.json()) as { reviewId: string };

		const pending = await api("/api/v1/gm/reviews?status=pending", {
			token: ctx.gmToken,
		});
		expect(pending.status).toBe(200);
		const reviews = (await pending.json()) as CharacterReviewDto[];
		const review = reviews.find((item) => item.id === reviewId);
		expect(review?.characterId).toBe(character.id);
		expect(review?.scope).toBe("module");

		const decide = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decide.status).toBe(200);

		const linked = await api(
			`/api/v1/gm/modules/${moduleId}/characters?limit=100`,
			{ token: ctx.gmToken },
		);
		const linkedBody = (await linked.json()) as {
			items: Array<{ id: string }>;
		};
		expect(linkedBody.items.some((item) => item.id === character.id)).toBe(
			true,
		);

		const mine = await api("/api/v1/pl/submissions", { token: plToken });
		const mineBody = (await mine.json()) as CharacterReviewDto[];
		expect(mineBody.find((item) => item.id === reviewId)?.status).toBe(
			"approved",
		);

		const again = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(again.status).toBe(409);
	});

	test("驳回后可重新提交同一人物", async () => {
		const invite = await createInvite("module", moduleId);
		const character = await createPlCharacter("提交人物丙");
		const token = encodeURIComponent(invite.token!);

		const first = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		const { reviewId } = (await first.json()) as { reviewId: string };

		const reject = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: false, reason: "数值不合理" }),
		});
		expect(reject.status).toBe(200);

		const resubmit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(resubmit.status).toBe(200);
	});

	test("团链接：通过后人物进入团内可用 PC，PL 可以认领", async () => {
		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [] }),
		});
		expect(sessionRes.status).toBe(200);
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("入团人物丁");
		const token = encodeURIComponent(invite.token!);

		const submit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(submit.status).toBe(200);
		const { reviewId } = (await submit.json()) as { reviewId: string };

		const decide = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decide.status).toBe(200);

		const joinInfo = await api(
			`/api/v1/public/sessions/${sessionId}/join-info`,
		);
		expect(joinInfo.status).toBe(200);
		const info = (await joinInfo.json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		const entry = info.characters.find((item) => item.id === character.id);
		expect(entry).toBeDefined();
		expect(entry?.claimable).toBe(true);

		const claim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(claim.status).toBe(200);
	});

	test("链接可撤销；撤销后无法查看或提交", async () => {
		const invite = await createInvite("module", moduleId);
		const token = encodeURIComponent(invite.token!);

		const revoke = await api(`/api/v1/gm/invites/${invite.id}`, {
			method: "DELETE",
			token: ctx.gmToken,
		});
		expect(revoke.status).toBe(200);

		const info = await api(`/api/v1/pl/invites/${token}`, {
			token: plToken,
		});
		expect(info.status).toBeGreaterThanOrEqual(400);

		const submit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "new", name: "过期提交" }),
		});
		expect(submit.status).toBeGreaterThanOrEqual(400);
	});

	test("其他 PL 不能认领他人已审核人物所在席位", async () => {
		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [] }),
		});
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("独占人物戊");
		const token = encodeURIComponent(invite.token!);

		const submit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		const { reviewId } = (await submit.json()) as { reviewId: string };
		await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});

		const claim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(claim.status).toBe(200);

		const steal = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: otherPlToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(steal.status).toBe(400);
		expect(((await steal.json()) as { code: string }).code).toBe(
			"SEAT_ALREADY_CLAIMED",
		);
	});

	test("跨 GM 隔离：他人模组的邀请不可创建、不可审核", async () => {
		const gmAccounts = await seedPlayers(ctx.container.db, PASSWORD, [
			"invite-gm2",
		]);
		const otherGmId = gmAccounts.get("invite-gm2")!.userId;
		await ctx.container.dbContext.sqlite
			.query("update users set role = 'gm' where id = ?")
			.run(otherGmId);
		const otherGmToken = await loginToken(ctx.app, "invite-gm2", PASSWORD);

		const create = await api("/api/v1/gm/invites", {
			method: "POST",
			token: otherGmToken,
			body: JSON.stringify({ scope: "module", targetId: moduleId }),
		});
		expect(create.status).toBe(404);

		const invite = await createInvite("module", moduleId);
		const character = await createPlCharacter("越权审核人物");
		const submit = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			},
		);
		const { reviewId } = (await submit.json()) as { reviewId: string };

		const decide = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: otherGmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decide.status).toBe(404);
	});

	test("团内同步：差异预览只列可同步字段，应用后主卡变化进入团内快照", async () => {
		const character = await createPlCharacter("同步人物");
		const link = await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: character.id }),
		});
		expect(link.status).toBe(200);

		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [character.id] }),
		});
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const update = await api(`/api/v1/pl/characters/${character.id}`, {
			method: "PATCH",
			token: plToken,
			body: JSON.stringify({
				background: "加入团之后更新的背景",
				expectedVersion: character.version,
			}),
		});
		expect(update.status).toBe(200);
		const updatedCharacter = CharacterDto.parse(await update.json());
		expect(updatedCharacter.version).toBe(character.version + 1);

		const preview = await api(
			`/api/v1/gm/sessions/${sessionId}/characters/${character.id}/sync-preview`,
			{ token: ctx.gmToken },
		);
		expect(preview.status).toBe(200);
		const diff = CharacterSyncDiffDto.parse(await preview.json());
		expect(diff.characterId).toBe(character.id);
		expect(diff.baseBackground).not.toBe(diff.currentBackground);
		expect(diff.currentBackground).toBe("加入团之后更新的背景");

		const sync = await api(
			`/api/v1/gm/sessions/${sessionId}/characters/${character.id}/sync`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					fields: ["background"],
					expectedVersion: updatedCharacter.version,
				}),
			},
		);
		expect(sync.status).toBe(200);

		const detail = await api(`/api/v1/gm/sessions/${sessionId}`, {
			token: ctx.gmToken,
		});
		const detailBody = (await detail.json()) as {
			characters: Array<{ characterId: string; background: string }>;
		};
		expect(
			detailBody.characters.find((item) => item.characterId === character.id)
				?.background,
		).toBe("加入团之后更新的背景");
	});

	test("团内同步：数值变化重算上限、保留损失并拒绝过期版本", async () => {
		const character = await createPlCharacter("同步数值人物");
		const link = await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: character.id }),
		});
		expect(link.status).toBe(200);
		const sessionRes = await api("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [character.id] }),
		});
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;
		const state = {
			schemaVersion: 1,
			sessionId,
			characterId: character.id,
			hp: 3,
			maxHp: 10,
			mp: 2,
			maxMp: 12,
			san: 30,
			maxSan: 99,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		};
		await ctx.container.db
			.update((await import("@/platform/db/schema")).sessionCharacters)
			.set({ stateJson: JSON.stringify(state) })
			.where(
				(await import("drizzle-orm")).and(
					(await import("drizzle-orm")).eq(
						(await import("@/platform/db/schema")).sessionCharacters.sessionId,
						sessionId,
					),
					(await import("drizzle-orm")).eq(
						(await import("@/platform/db/schema")).sessionCharacters
							.characterId,
						character.id,
					),
				),
			);
		const current = await api(`/api/v1/pl/characters/${character.id}`, {
			token: plToken,
		});
		const currentDetail = CharacterDetailDto.parse(await current.json());
		const currentSheet = coc7e.Coc7eCharacterSheet.parse(
			JSON.parse(currentDetail.sheetJson),
		);
		const update = await api(`/api/v1/pl/characters/${character.id}`, {
			method: "PATCH",
			token: plToken,
			body: JSON.stringify({
				sheetData: {
					...currentSheet,
					attributes: { ...currentSheet.attributes, con: 80, siz: 80, pow: 70 },
					skills: { ...currentSheet.skills, 克苏鲁神话: 85 },
				},
				expectedVersion: currentDetail.version,
			}),
		});
		const updated = CharacterDto.parse(await update.json());
		const preview = await api(
			`/api/v1/gm/sessions/${sessionId}/characters/${character.id}/sync-preview`,
			{ token: ctx.gmToken },
		);
		const diff = CharacterSyncDiffDto.parse(await preview.json());
		expect(diff.statePreview).toEqual({
			current: { hp: 3, maxHp: 10, mp: 2, maxMp: 12, san: 30, maxSan: 99 },
			next: { hp: 9, maxHp: 16, mp: 4, maxMp: 14, san: 14, maxSan: 14 },
		});
		const stale = await api(
			`/api/v1/gm/sessions/${sessionId}/characters/${character.id}/sync`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					fields: ["sheet"],
					expectedVersion: updated.version - 1,
				}),
			},
		);
		expect(stale.status).toBe(409);
		const apply = await api(
			`/api/v1/gm/sessions/${sessionId}/characters/${character.id}/sync`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					fields: ["sheet"],
					expectedVersion: updated.version,
				}),
			},
		);
		expect(apply.status).toBe(200);
		const snapshot = await ctx.container.db
			.select()
			.from((await import("@/platform/db/schema")).sessionCharacters)
			.where(
				(await import("drizzle-orm")).and(
					(await import("drizzle-orm")).eq(
						(await import("@/platform/db/schema")).sessionCharacters.sessionId,
						sessionId,
					),
					(await import("drizzle-orm")).eq(
						(await import("@/platform/db/schema")).sessionCharacters
							.characterId,
						character.id,
					),
				),
			);
		const synced = coc7e.CharacterSessionState.parse(
			JSON.parse(snapshot[0]!.stateJson),
		);
		expect(synced).toMatchObject({
			hp: 9,
			maxHp: 16,
			mp: 4,
			maxMp: 14,
			san: 14,
			maxSan: 14,
		});
		expect(snapshot[0]!.baseSheetVersion).toBe(updated.sheetVersion);
	});

	test("模组链接：新人物提交完整 CoC 7e v2 角色卡并持久化详情与审核", async () => {
		const invite = await createInvite("module", moduleId);
		const expected = completeCoc7eSheet();
		const res = await fullApi(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({
					mode: "new",
					name: "完整提交人物",
					background: "完整提交背景",
					sheetData: expected,
				}),
			},
		);
		expect(res.status).toBe(200);
		const submitted = (await res.json()) as {
			reviewId: string;
			characterId: string;
		};

		const detailRes = await fullApi(
			`/api/v1/pl/characters/${submitted.characterId}`,
			{ token: plToken },
		);
		expect(detailRes.status).toBe(200);
		const detail = CharacterDetailDto.parse(await detailRes.json());
		expect(detail.ownerId).toBe(plUserId);
		expect(detail.ownerKind).toBe("pl");
		expect(detail.kind).toBe("pc");
		expect(detail.ruleId).toBe("coc7e");
		expect(detail.name).toBe("完整提交人物");
		expect(detail.background).toBe("完整提交背景");
		const persisted: coc7e.Coc7eCharacterSheet = JSON.parse(detail.sheetJson);
		expect(persisted).toEqual(expected);
		expectCompleteCoc7eSheet(persisted);

		const reviewRes = await fullApi("/api/v1/gm/reviews?status=pending", {
			token: ctx.gmToken,
		});
		expect(reviewRes.status).toBe(200);
		const reviews = (await reviewRes.json()) as CharacterReviewDto[];
		const review = reviews.find((item) => item.id === submitted.reviewId);
		expect(review?.characterId).toBe(submitted.characterId);
		expect(review?.characterName).toBe("完整提交人物");
		expect(review?.scope).toBe("module");
		expect(review?.targetId).toBe(moduleId);
		expect(review?.submittedByUserId).toBe(plUserId);
		expect(review?.submittedSheetVersion).toBe(1);
		expect(review?.status).toBe("pending");
	});

	test("模组链接：新人物提交字段非法的完整卡返回 400 且不新增人物或审核", async () => {
		const invite = await createInvite("module", moduleId);
		const invalid = {
			...completeCoc7eSheet(),
			weapons: [{ name: "损坏的武器" }],
		};
		const charactersBefore = countCharacters();
		const reviewsBefore = countReviews();

		const res = await fullApi(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({
					mode: "new",
					name: "非法提交人物",
					background: "",
					sheetData: invalid,
				}),
			},
		);
		expect(res.status).toBe(400);
		expect(countCharacters()).toBe(charactersBefore);
		expect(countReviews()).toBe(reviewsBefore);
	});

	test("POST invite 生成的明文 token 不会出现在后续列表响应中", async () => {
		const invite = await createInvite("module", moduleId);
		expect(invite.token).toBeTruthy();

		const listRes = await api("/api/v1/gm/invites", { token: ctx.gmToken });
		expect(listRes.status).toBe(200);
		const rawBody = await listRes.text();
		expect(rawBody).not.toContain(invite.token!);
		const list = (JSON.parse(rawBody) as unknown[]).map((item) =>
			CharacterInviteDto.parse(item),
		);
		const found = list.find((item) => item.id === invite.id);
		expect(found).toBeDefined();
		expect(found?.token).toBeNull();
	});

	test("他人认领 PL A 已审核但尚未认领的 PC 时被拒绝且不写入认领记录", async () => {
		const sessionId = await createSession();
		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("A专属调查员");
		const token = encodeURIComponent(invite.token!);

		const submit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(submit.status).toBe(200);
		const { reviewId } = (await submit.json()) as { reviewId: string };
		const decide = await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decide.status).toBe(200);

		const bMyClaim = await api(`/api/v1/sessions/${sessionId}/my-claim`, {
			token: otherPlToken,
		});
		expect(bMyClaim.status).toBe(200);
		expect(
			((await bMyClaim.json()) as { canAutoClaimCharacterId: string | null })
				.canAutoClaimCharacterId,
		).toBeNull();

		const bJoinInfo = await api(
			`/api/v1/public/sessions/${sessionId}/join-info`,
			{ token: otherPlToken },
		);
		expect(bJoinInfo.status).toBe(200);
		const bInfo = (await bJoinInfo.json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(bInfo.characters.find((c) => c.id === character.id)?.claimable).toBe(
			false,
		);

		const bClaim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: otherPlToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(bClaim.status).toBe(403);
		expect(((await bClaim.json()) as { code: string }).code).toBe(
			"SESSION_CHARACTER_NOT_CLAIMABLE",
		);
		expect(countActiveClaims(sessionId)).toBe(0);

		const aMyClaim = await api(`/api/v1/sessions/${sessionId}/my-claim`, {
			token: plToken,
		});
		expect(aMyClaim.status).toBe(200);
		expect(
			((await aMyClaim.json()) as { canAutoClaimCharacterId: string | null })
				.canAutoClaimCharacterId,
		).toBe(character.id);

		const aClaim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(aClaim.status).toBe(200);
	});

	test("join-info 按登录 PL 返回各自的 claimable，且匿名保留登录入口", async () => {
		const gmPrebuiltRes = await api("/api/v1/gm/characters", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "GM预建调查员",
				kind: "pc",
				ruleId: "coc7e",
			}),
		});
		expect(gmPrebuiltRes.status).toBe(200);
		const gmPrebuilt = CharacterDto.parse(await gmPrebuiltRes.json());
		await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: gmPrebuilt.id }),
		});

		const sessionId = await createSession([gmPrebuilt.id]);
		const invite = await createInvite("session", sessionId);
		const charA = await createCharacterFor(plToken, "PL-A人物");
		const charB = await createCharacterFor(otherPlToken, "PL-B人物");
		const token = encodeURIComponent(invite.token!);

		const subA = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: charA.id }),
		});
		const subB = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: otherPlToken,
			body: JSON.stringify({ mode: "existing", characterId: charB.id }),
		});
		const revA = ((await subA.json()) as { reviewId: string }).reviewId;
		const revB = ((await subB.json()) as { reviewId: string }).reviewId;
		await api(`/api/v1/gm/reviews/${revA}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		await api(`/api/v1/gm/reviews/${revB}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});

		const anonInfo = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`)
		).json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(anonInfo.requiresLogin).toBe(true);
		expect(anonInfo.characters.find((c) => c.id === charA.id)?.claimable).toBe(
			true,
		);
		expect(anonInfo.characters.find((c) => c.id === charB.id)?.claimable).toBe(
			true,
		);
		expect(
			anonInfo.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(true);

		const aInfo = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: plToken,
			})
		).json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(aInfo.characters.find((c) => c.id === charA.id)?.claimable).toBe(
			true,
		);
		expect(aInfo.characters.find((c) => c.id === charB.id)?.claimable).toBe(
			false,
		);
		expect(
			aInfo.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(true);

		const bInfo = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: otherPlToken,
			})
		).json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(bInfo.characters.find((c) => c.id === charA.id)?.claimable).toBe(
			false,
		);
		expect(bInfo.characters.find((c) => c.id === charB.id)?.claimable).toBe(
			true,
		);
		expect(
			bInfo.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(true);
	});

	test("过期已审核版本即使当前无任何有效审核也不能认领，且重提通过后恢复资格", async () => {
		const sessionId = await createSession();
		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("版本变更人物");
		const token = encodeURIComponent(invite.token!);

		const sub1 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		const { reviewId: review1 } = (await sub1.json()) as { reviewId: string };
		await api(`/api/v1/gm/reviews/${review1}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});

		const updated = await bumpSheetVersion(plToken, character.id, 77);
		expect(updated.sheetVersion).toBe(2);

		const staleInfoA = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: plToken,
			})
		).json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(
			staleInfoA.characters.find((c) => c.id === character.id)?.claimable,
		).toBe(false);

		const staleInfoAnon = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`)
		).json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(
			staleInfoAnon.characters.find((c) => c.id === character.id)?.claimable,
		).toBe(false);
		expect(staleInfoAnon.requiresLogin).toBe(false);

		const staleMyClaim = (await (
			await api(`/api/v1/sessions/${sessionId}/my-claim`, { token: plToken })
		).json()) as { canAutoClaimCharacterId: string | null };
		expect(staleMyClaim.canAutoClaimCharacterId).toBeNull();

		const staleClaimA = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(staleClaimA.status).toBe(403);
		expect(((await staleClaimA.json()) as { code: string }).code).toBe(
			"SESSION_CHARACTER_NOT_CLAIMABLE",
		);
		expect(countActiveClaims(sessionId)).toBe(0);

		const inviteInfo = CharacterInviteInfoResponse.parse(
			await (
				await api(`/api/v1/pl/invites/${token}`, { token: plToken })
			).json(),
		);
		expect(
			inviteInfo.ownedCharacters.find((c) => c.id === character.id)
				?.alreadySubmitted,
		).toBe(false);

		const sub2 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub2.status).toBe(200);
		const { reviewId: review2 } = (await sub2.json()) as { reviewId: string };

		const dup2 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(dup2.status).toBe(409);

		const pendingClaimA = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(pendingClaimA.status).toBe(403);

		const approve2 = await api(`/api/v1/gm/reviews/${review2}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(approve2.status).toBe(200);

		const restoredInfoA = (await (
			await api(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: plToken,
			})
		).json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(
			restoredInfoA.characters.find((c) => c.id === character.id)?.claimable,
		).toBe(true);

		const restoredClaimA = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(restoredClaimA.status).toBe(200);
	});

	test("待审核卡改卡重提会取代旧待审记录（不物理删除也不留重复待办），通过后恢复认领资格", async () => {
		const sessionId = await createSession();
		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("待审改卡人物");
		const token = encodeURIComponent(invite.token!);

		const sub1 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub1.status).toBe(200);
		const { reviewId: review1 } = (await sub1.json()) as { reviewId: string };
		const reviewsAfterFirst = countReviews();

		await bumpSheetVersion(plToken, character.id, 66);

		const inviteInfo = CharacterInviteInfoResponse.parse(
			await (
				await api(`/api/v1/pl/invites/${token}`, { token: plToken })
			).json(),
		);
		expect(
			inviteInfo.ownedCharacters.find((c) => c.id === character.id)
				?.alreadySubmitted,
		).toBe(false);

		const sub2 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub2.status).toBe(200);
		const { reviewId: review2 } = (await sub2.json()) as { reviewId: string };
		expect(review2).not.toBe(review1);
		expect(countReviews()).toBe(reviewsAfterFirst + 1);

		const dup2 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(dup2.status).toBe(409);

		const pendingRes = await api("/api/v1/gm/reviews?status=pending", {
			token: ctx.gmToken,
		});
		expect(pendingRes.status).toBe(200);
		const pendingForChar = (
			(await pendingRes.json()) as CharacterReviewDto[]
		).filter(
			(r) =>
				r.scope === "session" &&
				r.targetId === sessionId &&
				r.characterId === character.id,
		);
		expect(pendingForChar.map((r) => r.id)).toEqual([review2]);

		const decideOld = await api(`/api/v1/gm/reviews/${review1}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decideOld.status).toBe(404);

		const decideNew = await api(`/api/v1/gm/reviews/${review2}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decideNew.status).toBe(200);

		const claimA = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(claimA.status).toBe(200);
	});

	test("无审核遗留认领、GM 显式指派与匿名 OB 规则保持有效", async () => {
		const gmPrebuiltRes = await api("/api/v1/gm/characters", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "遗留预建PC",
				kind: "pc",
				ruleId: "coc7e",
			}),
		});
		const gmPrebuilt = CharacterDto.parse(await gmPrebuiltRes.json());
		await api(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: gmPrebuilt.id }),
		});

		const sessionId = await createSession([gmPrebuilt.id]);
		const legacyClaim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: gmPrebuilt.id }),
		});
		expect(legacyClaim.status).toBe(200);

		const invite = await createInvite("session", sessionId);
		const pendingChar = await createCharacterFor(plToken, "待审被指派PC");
		const sub = await api(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: pendingChar.id }),
			},
		);
		const { reviewId } = (await sub.json()) as { reviewId: string };
		await api(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: false, reason: "测试驳回" }),
		});

		const rejectedClaim = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: pendingChar.id }),
		});
		expect([403, 404]).toContain(rejectedClaim.status);

		const anonIdentity = await api("/api/v1/player/identity", {
			method: "POST",
			body: JSON.stringify({ fingerprint: "fp-invite-anon-ob" }),
		});
		const anonToken = ((await anonIdentity.json()) as { token: string }).token;
		const anonPc = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: anonToken,
			body: JSON.stringify({ role: "pc", characterId: gmPrebuilt.id }),
		});
		expect(anonPc.status).toBe(401);
		const anonOb = await api(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: anonToken,
			body: JSON.stringify({ role: "ob" }),
		});
		expect(anonOb.status).toBe(200);

		const assignRes = await api(
			`/api/v1/gm/sessions/${sessionId}/claims/assign`,
			{
				method: "POST",
				token: ctx.gmToken,
				body: JSON.stringify({
					userId: otherPlUserId,
					characterId: gmPrebuilt.id,
				}),
			},
		);
		expect(assignRes.status).toBe(200);
	});

	test("模组邀请过审后建团（无团审记录）仅允许所属 PL 认领，他人不可自动或直接认领且匿名可见登录入口", async () => {
		const invite = await createInvite("module", moduleId);
		const character = await createPlCharacter("模组过审人物");
		const submit = await fullApi(
			`/api/v1/pl/invites/${encodeURIComponent(invite.token!)}/submissions`,
			{
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			},
		);
		expect(submit.status).toBe(200);
		const { reviewId } = (await submit.json()) as { reviewId: string };

		const decide = await fullApi(`/api/v1/gm/reviews/${reviewId}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(decide.status).toBe(200);

		const sessionRes = await fullApi("/api/v1/gm/sessions", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ moduleId, characterIds: [character.id] }),
		});
		expect(sessionRes.status).toBe(200);
		const sessionId = ((await sessionRes.json()) as { session: { id: string } })
			.session.id;

		const anonJoinInfo = await fullApi(
			`/api/v1/public/sessions/${sessionId}/join-info`,
		);
		expect(anonJoinInfo.status).toBe(200);
		const anonBody = (await anonJoinInfo.json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean; claimed: boolean }>;
		};
		expect(anonBody.requiresLogin).toBe(true);
		expect(
			anonBody.characters.find((c) => c.id === character.id),
		).toMatchObject({
			id: character.id,
			claimable: true,
			claimed: false,
		});

		const bMyClaim = await fullApi(`/api/v1/sessions/${sessionId}/my-claim`, {
			token: otherPlToken,
		});
		expect(bMyClaim.status).toBe(200);
		expect(
			((await bMyClaim.json()) as { canAutoClaimCharacterId: string | null })
				.canAutoClaimCharacterId,
		).toBeNull();

		const bJoinInfo = await fullApi(
			`/api/v1/public/sessions/${sessionId}/join-info`,
			{ token: otherPlToken },
		);
		expect(bJoinInfo.status).toBe(200);
		const bInfo = (await bJoinInfo.json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(bInfo.characters.find((c) => c.id === character.id)?.claimable).toBe(
			false,
		);
		expect(bInfo.requiresLogin).toBe(false);

		const bClaim = await fullApi(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: otherPlToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(bClaim.status).toBe(403);
		expect(((await bClaim.json()) as { code: string }).code).toBe(
			"SESSION_CHARACTER_NOT_CLAIMABLE",
		);
		expect(countActiveClaims(sessionId)).toBe(0);

		const aMyClaim = await fullApi(`/api/v1/sessions/${sessionId}/my-claim`, {
			token: plToken,
		});
		expect(aMyClaim.status).toBe(200);
		expect(
			((await aMyClaim.json()) as { canAutoClaimCharacterId: string | null })
				.canAutoClaimCharacterId,
		).toBe(character.id);

		const aJoinInfo = await fullApi(
			`/api/v1/public/sessions/${sessionId}/join-info`,
			{ token: plToken },
		);
		expect(aJoinInfo.status).toBe(200);
		const aInfo = (await aJoinInfo.json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(aInfo.characters.find((c) => c.id === character.id)?.claimable).toBe(
			true,
		);

		const aClaim = await fullApi(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: character.id }),
		});
		expect(aClaim.status).toBe(200);
		expect(countActiveClaims(sessionId)).toBe(1);
	});

	test("GM 预建无审核 PC 仍保持对匿名与任意已登录 PL 可见、可自动认领与直接入团", async () => {
		const gmPrebuiltRes = await fullApi("/api/v1/gm/characters", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "回归预建PC",
				kind: "pc",
				ruleId: "coc7e",
			}),
		});
		expect(gmPrebuiltRes.status).toBe(200);
		const gmPrebuilt = CharacterDto.parse(await gmPrebuiltRes.json());
		const linkRes = await fullApi(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: gmPrebuilt.id }),
		});
		expect(linkRes.status).toBe(200);

		const sessionId = await createSession([gmPrebuilt.id]);

		const anonInfo = (await (
			await fullApi(`/api/v1/public/sessions/${sessionId}/join-info`)
		).json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(anonInfo.requiresLogin).toBe(true);
		expect(
			anonInfo.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(true);

		const bInfo = (await (
			await fullApi(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: otherPlToken,
			})
		).json()) as {
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(
			bInfo.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(true);

		const bMyClaim = (await (
			await fullApi(`/api/v1/sessions/${sessionId}/my-claim`, {
				token: otherPlToken,
			})
		).json()) as { canAutoClaimCharacterId: string | null };
		expect(bMyClaim.canAutoClaimCharacterId).toBe(gmPrebuilt.id);

		const bClaim = await fullApi(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: otherPlToken,
			body: JSON.stringify({ role: "pc", characterId: gmPrebuilt.id }),
		});
		expect(bClaim.status).toBe(200);
	});

	test("重提替换新审核插入失败时事务回滚，旧待审记录保持有效且仅有一条可操作待审", async () => {
		const sessionId = await createSession();
		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("事务回滚测试人物");
		if (!invite.token) {
			throw new Error("Expected invite token");
		}
		const token = encodeURIComponent(invite.token);

		const sub1 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub1.status).toBe(200);
		const { reviewId: review1 } = (await sub1.json()) as { reviewId: string };

		await bumpSheetVersion(plToken, character.id, 72);

		ctx.container.dbContext.sqlite.exec(`
			CREATE TRIGGER test_fail_review_insert
			BEFORE INSERT ON character_reviews
			WHEN NEW.character_id = '${character.id}' AND NEW.submitted_sheet_version = 2
			BEGIN
				SELECT RAISE(ABORT, 'injected review insert failure');
			END;
		`);
		try {
			const failedResubmit = await api(
				`/api/v1/pl/invites/${token}/submissions`,
				{
					method: "POST",
					token: plToken,
					body: JSON.stringify({ mode: "existing", characterId: character.id }),
				},
			);
			expect(failedResubmit.status).toBeGreaterThanOrEqual(500);
		} finally {
			ctx.container.dbContext.sqlite.exec(
				"DROP TRIGGER IF EXISTS test_fail_review_insert;",
			);
		}

		const rowsAfterFailure = ctx.container.dbContext.sqlite
			.query<
				{
					id: string;
					status: string;
					submitted_sheet_version: number;
					deleted_at: number | null;
				},
				[string, string]
			>(
				"select id, status, submitted_sheet_version, deleted_at from character_reviews where scope = 'session' and target_id = ? and character_id = ? order by created_at asc, rowid asc",
			)
			.all(sessionId, character.id);
		expect(rowsAfterFailure).toEqual([
			{
				id: review1,
				status: "pending",
				submitted_sheet_version: 1,
				deleted_at: null,
			},
		]);

		const pendingAfterFailure = await api("/api/v1/gm/reviews?status=pending", {
			token: ctx.gmToken,
		});
		expect(pendingAfterFailure.status).toBe(200);
		const pendingIdsAfterFailure = (
			(await pendingAfterFailure.json()) as CharacterReviewDto[]
		)
			.filter(
				(r) =>
					r.scope === "session" &&
					r.targetId === sessionId &&
					r.characterId === character.id,
			)
			.map((r) => r.id);
		expect(pendingIdsAfterFailure).toEqual([review1]);

		const retryResubmit = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(retryResubmit.status).toBe(200);
		const { reviewId: review2 } = (await retryResubmit.json()) as {
			reviewId: string;
		};
		expect(review2).not.toBe(review1);

		const rowsAfterRetry = ctx.container.dbContext.sqlite
			.query<
				{
					id: string;
					status: string;
					submitted_sheet_version: number;
					deleted_at: number | null;
				},
				[string, string]
			>(
				"select id, status, submitted_sheet_version, deleted_at from character_reviews where scope = 'session' and target_id = ? and character_id = ? order by created_at asc, rowid asc",
			)
			.all(sessionId, character.id);
		expect(rowsAfterRetry).toHaveLength(2);
		expect(rowsAfterRetry[0]?.id).toBe(review1);
		expect(rowsAfterRetry[0]?.deleted_at).not.toBeNull();
		expect(rowsAfterRetry[1]).toMatchObject({
			id: review2,
			status: "pending",
			submitted_sheet_version: 2,
			deleted_at: null,
		});
	});

	test("并发重提同一新版本不会产生重复可操作待审，且连续改卡替换保留软删除历史", async () => {
		const sessionId = await createSession();
		const invite = await createInvite("session", sessionId);
		const character = await createPlCharacter("并发重提人物");
		if (!invite.token) {
			throw new Error("Expected invite token");
		}
		const token = encodeURIComponent(invite.token);

		const sub1 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub1.status).toBe(200);
		const { reviewId: review1 } = (await sub1.json()) as { reviewId: string };

		await bumpSheetVersion(plToken, character.id, 65);

		const [raceA, raceB] = await Promise.all([
			api(`/api/v1/pl/invites/${token}/submissions`, {
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			}),
			api(`/api/v1/pl/invites/${token}/submissions`, {
				method: "POST",
				token: plToken,
				body: JSON.stringify({ mode: "existing", characterId: character.id }),
			}),
		]);
		const statuses = [raceA.status, raceB.status].sort((a, b) => a - b);
		expect(statuses).toEqual([200, 409]);

		const winnerBody = (await (raceA.status === 200
			? raceA
			: raceB
		).json()) as { reviewId: string };
		const review2 = winnerBody.reviewId;
		expect(review2).not.toBe(review1);

		const activePendingsAfterRace = ctx.container.dbContext.sqlite
			.query<{ id: string; submitted_sheet_version: number }, [string, string]>(
				"select id, submitted_sheet_version from character_reviews where scope = 'session' and target_id = ? and character_id = ? and status = 'pending' and deleted_at is null",
			)
			.all(sessionId, character.id);
		expect(activePendingsAfterRace).toEqual([
			{ id: review2, submitted_sheet_version: 2 },
		]);

		await bumpSheetVersion(plToken, character.id, 78);
		const sub3 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub3.status).toBe(200);
		const { reviewId: review3 } = (await sub3.json()) as { reviewId: string };

		const dup3 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(dup3.status).toBe(409);

		const allHistoryRows = ctx.container.dbContext.sqlite
			.query<
				{
					id: string;
					status: string;
					submitted_sheet_version: number;
					deleted_at: number | null;
				},
				[string, string]
			>(
				"select id, status, submitted_sheet_version, deleted_at from character_reviews where scope = 'session' and target_id = ? and character_id = ? order by submitted_sheet_version asc, rowid asc",
			)
			.all(sessionId, character.id);
		expect(allHistoryRows).toHaveLength(3);
		expect(allHistoryRows[0]?.id).toBe(review1);
		expect(allHistoryRows[0]?.deleted_at).not.toBeNull();
		expect(allHistoryRows[1]?.id).toBe(review2);
		expect(allHistoryRows[1]?.deleted_at).not.toBeNull();
		expect(allHistoryRows[2]).toMatchObject({
			id: review3,
			status: "pending",
			submitted_sheet_version: 3,
			deleted_at: null,
		});

		const approve3 = await api(`/api/v1/gm/reviews/${review3}/decide`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ approve: true }),
		});
		expect(approve3.status).toBe(200);

		await bumpSheetVersion(plToken, character.id, 88);
		const sub4 = await api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ mode: "existing", characterId: character.id }),
		});
		expect(sub4.status).toBe(200);
		const { reviewId: review4 } = (await sub4.json()) as { reviewId: string };

		const activePendingsAfterApprovedResubmit = ctx.container.dbContext.sqlite
			.query<{ id: string; submitted_sheet_version: number }, [string, string]>(
				"select id, submitted_sheet_version from character_reviews where scope = 'session' and target_id = ? and character_id = ? and status = 'pending' and deleted_at is null",
			)
			.all(sessionId, character.id);
		expect(activePendingsAfterApprovedResubmit).toEqual([
			{ id: review4, submitted_sheet_version: 4 },
		]);
	});

	test("无审核 GM 预建 PC 主卡被软删除后不可自动认领、join-info 不可认领、直接认领被拒且不写入认领记录", async () => {
		const gmPrebuiltRes = await fullApi("/api/v1/gm/characters", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "被删除预建PC",
				kind: "pc",
				ruleId: "coc7e",
			}),
		});
		expect(gmPrebuiltRes.status).toBe(200);
		const gmPrebuilt = CharacterDto.parse(await gmPrebuiltRes.json());
		const linkRes = await fullApi(`/api/v1/gm/modules/${moduleId}/characters`, {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ characterId: gmPrebuilt.id }),
		});
		expect(linkRes.status).toBe(200);

		const sessionId = await createSession([gmPrebuilt.id]);

		const deleteRes = await fullApi(`/api/v1/gm/characters/${gmPrebuilt.id}`, {
			method: "DELETE",
			token: ctx.gmToken,
		});
		expect(deleteRes.status).toBe(200);

		const myClaimRes = await fullApi(`/api/v1/sessions/${sessionId}/my-claim`, {
			token: plToken,
		});
		expect(myClaimRes.status).toBe(200);
		expect(
			(
				(await myClaimRes.json()) as {
					canAutoClaimCharacterId: string | null;
				}
			).canAutoClaimCharacterId,
		).toBeNull();

		const joinInfoPl = (await (
			await fullApi(`/api/v1/public/sessions/${sessionId}/join-info`, {
				token: plToken,
			})
		).json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(joinInfoPl.requiresLogin).toBe(false);
		expect(
			joinInfoPl.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(false);

		const joinInfoAnon = (await (
			await fullApi(`/api/v1/public/sessions/${sessionId}/join-info`)
		).json()) as {
			requiresLogin: boolean;
			characters: Array<{ id: string; claimable: boolean }>;
		};
		expect(joinInfoAnon.requiresLogin).toBe(false);
		expect(
			joinInfoAnon.characters.find((c) => c.id === gmPrebuilt.id)?.claimable,
		).toBe(false);

		const directClaim = await fullApi(`/api/v1/sessions/${sessionId}/claim`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({ role: "pc", characterId: gmPrebuilt.id }),
		});
		expect(directClaim.status).toBe(403);
		expect(((await directClaim.json()) as { code: string }).code).toBe(
			"SESSION_CHARACTER_NOT_CLAIMABLE",
		);

		const claimRows = ctx.container.dbContext.sqlite
			.query<{ count: number }, [string]>(
				"select count(*) as count from session_claims where session_id = ?",
			)
			.get(sessionId)?.count;
		expect(claimRows).toBe(0);
	});
});
