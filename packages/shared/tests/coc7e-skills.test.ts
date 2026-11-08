import { describe, expect, it } from "bun:test";
import {
	COC7E_SKILL_CATALOG,
	COC7E_SKILL_GROUP_INFO,
	coc7eSkillDescription,
} from "../src/rules/coc7e";

describe("CoC 7e skill catalog descriptions", () => {
	it("gives every standalone skill a description", () => {
		for (const entry of COC7E_SKILL_CATALOG) {
			if (entry.group) {
				continue;
			}
			expect(entry.description?.trim()).not.toBeFalsy();
		}
	});

	it("describes every specialization group used by the catalog", () => {
		const groups = new Set(
			COC7E_SKILL_CATALOG.filter((entry) => entry.group).map(
				(entry) => entry.group as string,
			),
		);
		for (const group of groups) {
			expect(COC7E_SKILL_GROUP_INFO[group]?.description.trim()).not.toBeFalsy();
		}
	});

	it("provides generic slot bases matching the blank character sheet", () => {
		expect(COC7E_SKILL_GROUP_INFO["技艺"]?.base).toBe(5);
		expect(COC7E_SKILL_GROUP_INFO["科学"]?.base).toBe(1);
		expect(COC7E_SKILL_GROUP_INFO["格斗"]?.base).toBe(0);
		expect(COC7E_SKILL_GROUP_INFO["射击"]?.base).toBe(0);
		expect(COC7E_SKILL_GROUP_INFO["语言"]?.base).toBe(1);
		expect(COC7E_SKILL_GROUP_INFO["驾驶"]?.base).toBe(1);
		expect(COC7E_SKILL_GROUP_INFO["生存"]?.base).toBe(10);
		expect(COC7E_SKILL_GROUP_INFO["学识"]?.base).toBe(1);
	});

	it("resolves descriptions from the catalog or the skill group", () => {
		expect(coc7eSkillDescription("侦查")).toBe(
			COC7E_SKILL_CATALOG.find((entry) => entry.key === "侦查")?.description ??
				null,
		);
		expect(coc7eSkillDescription("科学(化学)")).toBe(
			COC7E_SKILL_GROUP_INFO["科学"]?.description ?? null,
		);
		expect(coc7eSkillDescription("不存在的技能")).toBeNull();
	});
});
