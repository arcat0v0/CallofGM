import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterCreationRollDto,
	CharacterInviteDto,
	CharacterInviteInfoResponse,
	CharacterReviewDto,
	coc7e,
	ModuleDto,
} from "@cogm/shared";
import {
	loginToken,
	seedPlayers,
	setupTestApp,
	type TestContext,
} from "../helpers/setup";

const PASSWORD = "creation-roll-password";

describe("车卡属性生成（CoC 7e 天命 / 购点）", () => {
	let ctx: TestContext;
	let plToken = "";
	let otherPlToken = "";
	let moduleId = "";

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

	async function createInvite(creationOptions?: unknown) {
		const res = await api("/api/v1/gm/invites", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				scope: "module",
				targetId: moduleId,
				expiresInDays: 7,
				...(creationOptions === undefined ? {} : { creationOptions }),
			}),
		});
		return res;
	}

	async function issuedInvite(creationOptions?: unknown) {
		const res = await createInvite(creationOptions);
		expect(res.status).toBe(200);
		const invite = CharacterInviteDto.parse(await res.json());
		expect(invite.token).toBeString();
		return invite as CharacterInviteDto & { token: string };
	}

	function roll(token: string, userToken = plToken) {
		return api(`/api/v1/pl/invites/${token}/creation-roll`, {
			method: "POST",
			token: userToken,
		});
	}

	function choose(token: string, index: number, userToken = plToken) {
		return api(`/api/v1/pl/invites/${token}/creation-roll/choice`, {
			method: "POST",
			token: userToken,
			body: JSON.stringify({ index }),
		});
	}

	function submitNew(token: string, attributes: coc7e.Coc7eAttributes) {
		return api(`/api/v1/pl/invites/${token}/submissions`, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				mode: "new",
				name: "天命调查员",
				sheetData: { attributes, skills: {} },
			}),
		});
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		await seedPlayers(ctx.container.db, PASSWORD, ["roll-a", "roll-b"]);
		plToken = await loginToken(ctx.app, "roll-a", PASSWORD);
		otherPlToken = await loginToken(ctx.app, "roll-b", PASSWORD);
		const moduleRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({ name: "车卡模组", description: "", ruleId: "coc7e" }),
		});
		moduleId = ModuleDto.parse(await moduleRes.json()).id;
	});

	afterAll(() => {
		ctx.container.dbContext.sqlite.close();
	});

	test("链接校验生成方式：天命数量越界被拒绝", async () => {
		expect(
			(await createInvite({ method: "destiny", count: 0 })).status,
		).toBe(400);
		expect(
			(await createInvite({ method: "destiny", count: 11 })).status,
		).toBe(400);
		expect((await createInvite({ method: "unknown" })).status).toBe(400);
	});

	test("天命 5：一次掷出 5 套，重复请求不重掷，选定后不可更改", async () => {
		const invite = await issuedInvite({ method: "destiny", count: 5 });
		expect(invite.creationOptions).toEqual({ method: "destiny", count: 5 });

		const info = CharacterInviteInfoResponse.parse(
			await (
				await api(`/api/v1/pl/invites/${invite.token}`, { token: plToken })
			).json(),
		);
		expect(info.creationOptions).toEqual({ method: "destiny", count: 5 });
		expect(info.creationRoll).toBeNull();

		const first = await roll(invite.token);
		expect(first.status).toBe(200);
		const rolled = CharacterCreationRollDto.parse(await first.json());
		const result = coc7e.Coc7eCreationRollResult.parse(rolled.result);
		expect(result.method).toBe("destiny");
		if (result.method !== "destiny") throw new Error("unreachable");
		expect(result.sets).toHaveLength(5);
		for (const set of result.sets) {
			expect(set.attributes.siz).toBeGreaterThanOrEqual(40);
			expect(set.attributes.str % 5).toBe(0);
		}
		expect(rolled.chosenIndex).toBeNull();

		const again = CharacterCreationRollDto.parse(
			await (await roll(invite.token)).json(),
		);
		expect(again.id).toBe(rolled.id);
		expect(again.result).toEqual(rolled.result);

		// 未选定前不能提交新建人物
		const chosenSet = result.sets[2]!;
		expect((await submitNew(invite.token, chosenSet.attributes)).status).toBe(
			400,
		);

		expect((await choose(invite.token, 5)).status).toBe(400);
		const chosen = await choose(invite.token, 2);
		expect(chosen.status).toBe(200);
		expect(CharacterCreationRollDto.parse(await chosen.json()).chosenIndex).toBe(
			2,
		);
		expect((await choose(invite.token, 1)).status).toBe(409);

		// 其他玩家独立掷骰
		const other = CharacterCreationRollDto.parse(
			await (await roll(invite.token, otherPlToken)).json(),
		);
		expect(other.id).not.toBe(rolled.id);

		const submitted = await submitNew(invite.token, {
			...chosenSet.attributes,
			str: chosenSet.attributes.str === 90 ? 85 : chosenSet.attributes.str + 5,
		});
		expect(submitted.status).toBe(200);

		const reviews = (
			(await (
				await api("/api/v1/gm/reviews?status=pending", { token: ctx.gmToken })
			).json()) as unknown[]
		).map((item) => CharacterReviewDto.parse(item));
		const review = reviews.find((item) => item.inviteId === invite.id);
		expect(review?.ruleId).toBe("coc7e");
		expect(review?.creationRoll?.chosenIndex).toBe(2);
		const sheet = coc7e.Coc7eCharacterSheet.parse(review?.submittedSheet);
		const differences = coc7e.coc7eCreationDifferences(
			coc7e.Coc7eCreationRollResult.parse(review?.creationRoll?.result),
			2,
			sheet.attributes,
			sheet.age,
		);
		expect(differences.map((item) => item.key)).toEqual(["str"]);
	});

	test("购点 + 骰幸运：幸运掷一次即自动选定，可直接提交", async () => {
		const invite = await issuedInvite({ method: "pointBuy" });
		expect(invite.creationOptions).toEqual({ method: "pointBuy", points: 460 });
		const rolled = CharacterCreationRollDto.parse(
			await (await roll(invite.token)).json(),
		);
		const result = coc7e.Coc7eCreationRollResult.parse(rolled.result);
		expect(result.method).toBe("pointBuy");
		expect(rolled.chosenIndex).toBe(0);
		if (result.method !== "pointBuy") throw new Error("unreachable");
		const submitted = await submitNew(invite.token, {
			str: 60,
			con: 60,
			siz: 60,
			dex: 60,
			app: 50,
			int: 60,
			pow: 50,
			edu: 60,
			luck: result.luck,
		});
		expect(submitted.status).toBe(200);
	});

	test("未设定生成方式的链接：不能掷骰，新建人物照常提交", async () => {
		const invite = await issuedInvite();
		expect(invite.creationOptions).toBeNull();
		expect((await roll(invite.token)).status).toBe(400);
		const submitted = await submitNew(invite.token, {
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		});
		expect(submitted.status).toBe(200);
	});
});
