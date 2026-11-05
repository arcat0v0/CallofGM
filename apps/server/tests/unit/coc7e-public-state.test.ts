import { describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { Coc7eRuleSystem } from "@/rules/coc7e";

const rule = new Coc7eRuleSystem();

function fullState() {
	return coc7e.CharacterSessionState.parse({
		sessionId: "session-1",
		characterId: "char-1",
		hp: 7,
		maxHp: 10,
		mp: 3,
		maxMp: 5,
		san: 50,
		maxSan: 60,
		statuses: ["major_wound"],
		tags: ["gm-secret-tag"],
		growthMarks: ["侦查"],
		hiddenGrowthMarks: ["图书馆使用"],
	});
}

describe("CoC 7e public session state projection", () => {
	test("公开项为空时投影为 null", () => {
		expect(rule.projectPublicSessionState(fullState(), [])).toBeNull();
	});

	test("HP 投影包含当前值与上限，不包含其他字段", () => {
		expect(rule.projectPublicSessionState(fullState(), ["hp"])).toEqual({
			hp: 7,
			maxHp: 10,
		});
	});

	test("MP、SAN 与状态标记分别投影成对字段", () => {
		expect(rule.projectPublicSessionState(fullState(), ["mp"])).toEqual({
			mp: 3,
			maxMp: 5,
		});
		expect(rule.projectPublicSessionState(fullState(), ["san"])).toEqual({
			san: 50,
			maxSan: 60,
		});
		expect(rule.projectPublicSessionState(fullState(), ["statuses"])).toEqual({
			statuses: ["major_wound"],
		});
	});

	test("组合公开项合并为一个投影对象", () => {
		expect(
			rule.projectPublicSessionState(fullState(), ["hp", "statuses", "san"]),
		).toEqual({
			hp: 7,
			maxHp: 10,
			san: 50,
			maxSan: 60,
			statuses: ["major_wound"],
		});
	});

	test("声明可公开字段且不包含自定义标签或成长标记", () => {
		expect([...rule.publicStateFields].sort()).toEqual([
			"hp",
			"mp",
			"san",
			"statuses",
		]);
	});

	test("未知公开字段被拒绝", () => {
		expect(() =>
			rule.projectPublicSessionState(fullState(), ["tags"]),
		).toThrow();
	});
});
