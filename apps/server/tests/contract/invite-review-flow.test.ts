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
});
