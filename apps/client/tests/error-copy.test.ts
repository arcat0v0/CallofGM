import { describe, expect, test } from "bun:test";
import { errorCopy } from "../src/lib/error-copy";

describe("errorCopy", () => {
	test("maps stable server error codes to Chinese copy", () => {
		expect(errorCopy({ code: "SESSION_PHASE_FORBIDS_ACTION" })).toBe(
			"当前阶段或席位不允许该操作",
		);
		expect(errorCopy({ code: "EXPRESSION_NOT_FOUND" })).toBe(
			"这个角色没有对应的立绘，请换一个表情",
		);
		expect(errorCopy({ code: "SKILL_NOT_FOUND" })).toBe(
			"人物卡上没有这个技能或属性",
		);
		expect(errorCopy({ code: "STATE_EDIT_OUT_OF_RANGE" })).toBe(
			"数值超出规则范围（HP/MP/SAN 上限为 0–99）",
		);
		expect(errorCopy({ code: "SESSION_NOT_FOUND" })).toBe(
			"找不到这个团，请检查链接或编号",
		);
		expect(errorCopy({ code: "INVALID_CREDENTIALS", status: 401 })).toBe(
			"密码不正确，请重新输入",
		);
		expect(errorCopy({ code: "SESSION_KICKED", status: 403 })).toBe(
			"你已被主持人移出本团，需由主持人解除禁入后才能重新进入",
		);
		expect(errorCopy({ code: "USERNAME_TAKEN", status: 409 })).toBe(
			"用户名已存在（包括回收站中的账号），请更换用户名",
		);
		expect(errorCopy({ code: "ACCOUNT_DISABLED", status: 403 })).toBe(
			"账号已被禁用或删除，请联系管理员",
		);
		expect(errorCopy({ code: "INVALID_PASSWORD", status: 400 })).toBe(
			"密码需为 8–128 个字符",
		);
		expect(errorCopy({ code: "NOT_FOUND", status: 404 })).toBe(
			"请求的接口不存在",
		);
		expect(errorCopy({ code: "DICE_EXPRESSION_OUT_OF_RANGE" })).toBe(
			"骰点超出限制：骰子 1–50 个、面数 2–1000、修正值 ±10000，表达式最多 32 个字符",
		);
		expect(errorCopy({ code: "STAGING_TARGET_MISMATCH", status: 409 })).toBe(
			"该导入预览不属于当前人物，请重新选择文件",
		);
	});

	test("maps HTTP 429 to rate-limit copy with or without a code", () => {
		expect(errorCopy({ code: "RATE_LIMITED", status: 429 })).toBe(
			"操作太频繁，请稍后再试",
		);
		expect(errorCopy({ status: 429 })).toBe("操作太频繁，请稍后再试");
	});

	test("falls back to Chinese status copy instead of raw English internals", () => {
		expect(errorCopy({ code: "SOMETHING_NEW", status: 404 })).toBe(
			"找不到请求的内容",
		);
		expect(errorCopy({ status: 500 })).toBe("服务器出错了，请稍后重试");
		expect(errorCopy({})).toBe("操作失败，请稍后重试");
	});

	test("code copy wins over status copy", () => {
		expect(errorCopy({ code: "PLAYER_NOT_FOUND", status: 404 })).toBe(
			"找不到该玩家",
		);
		expect(errorCopy({ code: "PLAYER_NOT_FOUND", status: 404 })).not.toBe(
			errorCopy({ status: 404 }),
		);
	});
});
