import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	CharacterDto,
	CharacterInviteDto,
	coc7e,
	ModuleDto,
} from "@cogm/shared";
import { createApp } from "@/app";
import {
	loginToken,
	seedPlayers,
	setupTestApp,
	type TestContext,
} from "../helpers/setup";

const PASSWORD = "security-test-password-123";

describe("Character input validation and HTTP security hardening", () => {
	let ctx: TestContext;
	let fullApp: ReturnType<typeof createApp>;
	let plToken: string;
	let inviteToken: string;
	let createdCharacterId: string;

	function api(path: string, init: RequestInit & { token?: string } = {}) {
		const headers = new Headers(init.headers);
		if (!headers.has("Content-Type") && init.body !== undefined) {
			headers.set("Content-Type", "application/json");
		}
		if (init.token) {
			headers.set("Authorization", `Bearer ${init.token}`);
		}
		return fullApp.handle(
			new Request(`http://localhost${path}`, {
				...init,
				headers,
			}),
		);
	}

	beforeAll(async () => {
		ctx = await setupTestApp({ players: [], characters: [] });
		fullApp = createApp(ctx.container);
		await seedPlayers(ctx.container.db, PASSWORD, ["sec-pl"]);
		plToken = await loginToken(fullApp, "sec-pl", PASSWORD);

		const modRes = await api("/api/v1/gm/modules", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				name: "安全校验测试模组",
				description: "",
				ruleId: "coc7e",
			}),
		});
		expect(modRes.status).toBe(200);
		const moduleId = ModuleDto.parse(await modRes.json()).id;

		const inviteRes = await api("/api/v1/gm/invites", {
			method: "POST",
			token: ctx.gmToken,
			body: JSON.stringify({
				scope: "module",
				targetId: moduleId,
				expiresInDays: 7,
			}),
		});
		expect(inviteRes.status).toBe(200);
		const parsedInvite = CharacterInviteDto.parse(await inviteRes.json());
		if (!parsedInvite.token) {
			throw new Error("expected invite token");
		}
		inviteToken = parsedInvite.token;
	});

	afterAll(() => {
		ctx.container.dbContext.sqlite.close();
	});

	test("sets defense-in-depth HTTP security headers on API responses", async () => {
		const res = await api("/api/version");
		expect(res.status).toBe(200);
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
	});

	test("POST /api/v1/pl/characters enforces required background, length limits, and blocks control/bidi chars", async () => {
		const rejectedPayloads = [
			{ name: "缺背景", ruleId: "coc7e" },
			{ name: "空背景", ruleId: "coc7e", background: "" },
			{ name: "空白背景", ruleId: "coc7e", background: "   \n\t  " },
			{ name: "超长背景", ruleId: "coc7e", background: "字".repeat(4001) },
			{ name: "含空字节", ruleId: "coc7e", background: "背景\u0000注入" },
			{ name: "含转义序列", ruleId: "coc7e", background: "背景\u001B[31m" },
			{ name: "含双向伪装", ruleId: "coc7e", background: "背景\u202E伪装" },
			{ name: "单行含换行\n注入", ruleId: "coc7e", background: "合法背景" },
			{
				name: "规则字段含空字节",
				ruleId: "coc7e",
				background: "合法背景",
				sheetData: {
					...coc7e.createEmptyCoc7eSheet({
						str: 50,
						con: 50,
						siz: 50,
						dex: 50,
						app: 50,
						int: 50,
						pow: 50,
						edu: 50,
						luck: 50,
					}),
					backgroundProfile: {
						ideologyBeliefs: "恶意\u0000注入",
					},
				},
			},
		];

		for (const payload of rejectedPayloads) {
			const res = await api("/api/v1/pl/characters", {
				method: "POST",
				token: plToken,
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
		}

		// 1 个字及普通脚本/SQL 字符按纯文本原样存储（输出层由 React 转义，存储层参数化查询）
		const literalAttackText =
			"<script>alert(1)</script>\r\n'; DROP TABLE characters; --";
		const okRes = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "合法调查员",
				ruleId: "coc7e",
				background: literalAttackText,
			}),
		});
		expect(okRes.status).toBe(200);
		const created = CharacterDto.parse(await okRes.json());
		createdCharacterId = created.id;
		expect(created.background).toBe(
			"<script>alert(1)</script>\n'; DROP TABLE characters; --",
		);

		// 确认最小 1 个字也可通过
		const oneCharRes = await api("/api/v1/pl/characters", {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				name: "一字背景",
				ruleId: "coc7e",
				background: " 探 ",
			}),
		});
		expect(oneCharRes.status).toBe(200);
		expect(CharacterDto.parse(await oneCharRes.json()).background).toBe("探");
	});

	test("PATCH /api/v1/pl/characters/:id rejects clearing background or injecting control chars while allowing partial patches", async () => {
		for (const badBackground of ["", "   \n ", "a".repeat(4001), "bad\u202E"]) {
			const res = await api(`/api/v1/pl/characters/${createdCharacterId}`, {
				method: "PATCH",
				token: plToken,
				body: JSON.stringify({ background: badBackground }),
			});
			expect(res.status).toBe(400);
		}

		const partialRes = await api(
			`/api/v1/pl/characters/${createdCharacterId}`,
			{
				method: "PATCH",
				token: plToken,
				body: JSON.stringify({ name: "改名后调查员" }),
			},
		);
		expect(partialRes.status).toBe(200);
		expect(CharacterDto.parse(await partialRes.json()).name).toBe(
			"改名后调查员",
		);
	});

	test("POST /api/v1/pl/invites/:token/submissions strictly validates mode=new with Zod", async () => {
		const path = `/api/v1/pl/invites/${encodeURIComponent(inviteToken)}/submissions`;
		const badBodies = [
			{ mode: "new", name: "无背景" },
			{ mode: "new", name: "空背景", background: "   " },
			{ mode: "new", name: 123, background: "类型混淆" },
			{ mode: "new", name: "类型混淆", background: { nested: true } },
			{ mode: "new", name: "超长", background: "x".repeat(4001) },
			{ mode: "new", name: "控制字符", background: "abc\u0000def" },
			{ mode: "existing" },
			{ mode: "existing", characterId: "   " },
		];

		for (const body of badBodies) {
			const res = await api(path, {
				method: "POST",
				token: plToken,
				body: JSON.stringify(body),
			});
			expect(res.status).toBe(400);
		}

		const okRes = await api(path, {
			method: "POST",
			token: plToken,
			body: JSON.stringify({
				mode: "new",
				name: "受邀新人",
				background: " 探\r\n索 ",
			}),
		});
		expect(okRes.status).toBe(200);
		const submitted = (await okRes.json()) as { characterId: string };
		const detailRes = await api(
			`/api/v1/pl/characters/${submitted.characterId}`,
			{
				token: plToken,
			},
		);
		expect(detailRes.status).toBe(200);
		expect(CharacterDto.parse(await detailRes.json()).background).toBe(
			"探\n索",
		);
	});

	test("rejects oversized non-multipart JSON bodies with 413 PAYLOAD_TOO_LARGE (both Content-Length and streamed)", async () => {
		const path = `/api/v1/pl/invites/${encodeURIComponent(inviteToken)}/submissions`;
		const oversizedJson = JSON.stringify({
			mode: "new",
			name: "大包攻击",
			background: "a".repeat(2 * 1024 * 1024 + 64),
		});

		// 1. 带 Content-Length 快速拒绝
		const resWithLength = await api(path, {
			method: "POST",
			token: plToken,
			headers: {
				"Content-Type": "application/json",
				"Content-Length": String(Buffer.byteLength(oversizedJson)),
			},
			body: oversizedJson,
		});
		expect(resWithLength.status).toBe(413);
		expect(resWithLength.headers.get("x-content-type-options")).toBe("nosniff");

		// 2. 流式分块（无 Content-Length）同样在 onParse 截断拒绝
		const encoded = new TextEncoder().encode(oversizedJson);
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const chunkSize = 256 * 1024;
				for (let offset = 0; offset < encoded.byteLength; offset += chunkSize) {
					controller.enqueue(encoded.subarray(offset, offset + chunkSize));
				}
				controller.close();
			},
		});
		const resStreamed = await fullApp.handle(
			new Request(`http://localhost${path}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${plToken}`,
				},
				body: stream,
			}),
		);
		expect(resStreamed.status).toBe(413);
	});
});
