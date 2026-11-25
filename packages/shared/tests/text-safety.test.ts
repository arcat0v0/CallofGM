import { describe, expect, test } from "bun:test";
import {
	CreateCharacterRequest,
	CreatePlCharacterRequest,
	coc7e,
	dnd5r,
	hasUnsafeMultiLineChars,
	hasUnsafeSingleLineChars,
	SubmitCharacterRequest,
	safeMultiLineText,
	safeSingleLineText,
	UpdatePlCharacterRequest,
} from "../src";

describe("text safety helpers and character input schemas", () => {
	test("normalizes line endings and preserves ordinary punctuation/angle brackets", () => {
		const schema = safeMultiLineText({ min: 1, max: 4000 });
		const parsed = schema.parse(
			"  第一行 <script>SAN <= 50</script>\r\n第二行\t缩进\r第三行  ",
		);
		expect(parsed).toBe(
			"第一行 <script>SAN <= 50</script>\n第二行\t缩进\n第三行",
		);
		expect(schema.parse("甲")).toBe("甲");
	});

	test("rejects empty, whitespace-only, overlong, control, and bidi override text", () => {
		const multi = safeMultiLineText({ min: 1, max: 10 });
		const single = safeSingleLineText({ min: 1, max: 10 });

		expect(multi.safeParse("").success).toBe(false);
		expect(multi.safeParse("   \n\t\r\n ").success).toBe(false);
		expect(multi.safeParse("12345678901").success).toBe(false);
		expect(multi.safeParse("abc\u0000def").success).toBe(false);
		expect(multi.safeParse("abc\u001B[31m").success).toBe(false);
		expect(multi.safeParse("abc\u009Bdef").success).toBe(false);
		expect(multi.safeParse("正常\u202E伪装").success).toBe(false);
		expect(multi.safeParse("正常\u2066隔离").success).toBe(false);

		expect(single.safeParse("第一行\n第二行").success).toBe(false);
		expect(single.safeParse("abc\u0000").success).toBe(false);
		expect(single.safeParse("abc\u202E").success).toBe(false);
		expect(hasUnsafeSingleLineChars("a\nb")).toBe(true);
		expect(hasUnsafeMultiLineChars("a\nb")).toBe(false);
		expect(hasUnsafeMultiLineChars("a\u202Eb")).toBe(true);
	});

	test("enforces required background on PL creation, invite submission, and non-empty PL updates", () => {
		expect(
			CreatePlCharacterRequest.safeParse({
				name: "调查员",
				ruleId: "coc7e",
			}).success,
		).toBe(false);
		expect(
			CreatePlCharacterRequest.safeParse({
				name: "调查员",
				ruleId: "coc7e",
				background: "   ",
			}).success,
		).toBe(false);
		expect(
			CreatePlCharacterRequest.parse({
				name: " 调查员 ",
				ruleId: "coc7e",
				background: " 探 ",
			}),
		).toMatchObject({ name: "调查员", background: "探" });

		// GM 创建 NPC 时仍允许省略背景，但提供危险字符时拒绝
		expect(
			CreateCharacterRequest.safeParse({
				name: "路人甲",
				kind: "npc",
				ruleId: "coc7e",
			}).success,
		).toBe(true);
		expect(
			CreateCharacterRequest.safeParse({
				name: "路人甲",
				kind: "npc",
				ruleId: "coc7e",
				background: "含控制字符\u0000",
			}).success,
		).toBe(false);

		// PL 局部更新可省略 background，但传入时不可为空或空白
		expect(UpdatePlCharacterRequest.safeParse({ name: "新名" }).success).toBe(
			true,
		);
		expect(UpdatePlCharacterRequest.safeParse({ background: "" }).success).toBe(
			false,
		);
		expect(
			UpdatePlCharacterRequest.safeParse({ background: "   \n " }).success,
		).toBe(false);

		// 邀请提交为严格 discriminated union
		expect(
			SubmitCharacterRequest.safeParse({ mode: "new", name: "无背景" }).success,
		).toBe(false);
		expect(
			SubmitCharacterRequest.safeParse({
				mode: "new",
				name: "有背景",
				background: "探",
			}).success,
		).toBe(true);
		expect(
			SubmitCharacterRequest.safeParse({
				mode: "existing",
				characterId: "char-1",
			}).success,
		).toBe(true);
		expect(
			SubmitCharacterRequest.safeParse({
				mode: "existing",
				characterId: "",
			}).success,
		).toBe(false);
	});

	test("rejects control/bidi characters inside CoC 7e and D&D 5r sheet text fields", () => {
		const validCoc = coc7e.createEmptyCoc7eSheet({
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
		expect(
			coc7e.Coc7eCharacterSheet.safeParse({
				...validCoc,
				backgroundProfile: {
					...validCoc.backgroundProfile,
					ideologyBeliefs: "含空字节\u0000",
				},
			}).success,
		).toBe(false);

		const validDnd = dnd5r.createBlankSheet();
		expect(
			dnd5r.CharacterSheet.safeParse({
				...validDnd,
				notes: "含双向伪装\u202E",
			}).success,
		).toBe(false);
	});
});
