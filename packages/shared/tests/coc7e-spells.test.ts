import { describe, expect, it } from "bun:test";
import { COC7E_SPELLS } from "../src/rules/coc7e";

describe("CoC 7e spell presets", () => {
	it("ships a searchable spell list with unique names", () => {
		expect(COC7E_SPELLS.length).toBeGreaterThan(100);
		const names = new Set<string>();
		for (const spell of COC7E_SPELLS) {
			expect(spell.name.trim()).not.toBe("");
			expect(names.has(spell.name)).toBe(false);
			names.add(spell.name);
			expect(spell.effect.length).toBeLessThanOrEqual(80);
		}
	});

	it("keeps the magic point cost of most entries", () => {
		const withCost = COC7E_SPELLS.filter(
			(spell) => spell.mpCost !== "" || spell.sanCost !== "",
		);
		expect(withCost.length / COC7E_SPELLS.length).toBeGreaterThan(0.7);
	});

	it("keeps the well known contact spells intact", () => {
		const contact = COC7E_SPELLS.find((spell) =>
			spell.name.includes("古老者联络术"),
		);
		expect(contact).toBeDefined();
		expect(contact?.mpCost).toContain("魔法值");
		expect(contact?.castingTime).not.toBe("");
	});

	it("does not ship rulebook section headers as individual spells", () => {
		const headers = COC7E_SPELLS.filter((spell) =>
			/^[A-Z0-9 .'-]+$/.test(spell.englishName),
		);
		expect(headers.map((spell) => spell.name)).toEqual([]);
	});

	it("spells deity names with the standard romanization", () => {
		for (const spell of COC7E_SPELLS) {
			expect(spell.englishName).not.toContain("Pazzuzu");
		}
		expect(
			COC7E_SPELLS.some((spell) => spell.englishName === "Wrath of Pazuzu"),
		).toBe(true);
	});
});
