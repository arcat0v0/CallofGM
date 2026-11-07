import { beforeEach, describe, expect, test } from "bun:test";
import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CharacterProfileEditorDialog } from "../src/features/characters/character-profile-editor-dialog";

const attributes = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 50,
	app: 50,
	int: 50,
	pow: 50,
	edu: 50,
	luck: 50,
};

function detail(): CharacterDetailDto {
	return {
		id: "char-profile",
		ownerId: "pl-1",
		ownerKind: "pl",
		name: "旧调查员",
		background: "旧背景",
		kind: "pc",
		ruleId: "coc7e",
		sheetJson: JSON.stringify(
			coc7e.normalizeCoc7eSheet({
				attributes,
				skills: { 侦查: 55 },
				weapons: [
					{
						name: "警用左轮",
						skillKey: "射击(手枪)",
						damage: "1d10",
						range: "15 码",
						attacks: "1",
						ammo: 6,
						malfunction: 100,
						impale: false,
						applyDamageBonus: false,
					},
				],
				assets: {
					currency: "$",
					spendingLevel: 10,
					cash: 82,
					otherAssets: 2050,
					details: [{ category: "residence", name: "公寓", value: 2000 }],
				},
				spells: [
					{
						name: "旧法术",
						mpCost: "1d6",
						sanCost: "1",
						castingTime: "1 轮",
						effect: "保留",
					},
				],
			}),
		),
		sheetVersion: 2,
		profileVersion: 2,
		version: 4,
		originType: null,
		originRefId: null,
		createdAt: 1,
		updatedAt: 1,
		portraits: [],
	};
}

describe("character profile editor full-sheet preservation", () => {
	beforeEach(() => {
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
	});

	test("patches attributes and skills without discarding weapons, assets or spells", async () => {
		const calls: Array<{ url: string; body: string }> = [];
		const originalFetch = globalThis.fetch;
		const response: CharacterDto = detail();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				calls.push({ url: String(url), body: String(init?.body ?? "") });
				return new Response(JSON.stringify(response), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as typeof fetch,
		});
		try {
			const character = detail();
			const view = render(
				<CharacterProfileEditorDialog
					scope="pl"
					character={character}
					open
					onClose={() => undefined}
					onSaved={() => undefined}
				/>,
			);
			const strength = view.getByRole("spinbutton", {
				name: "力量 STR",
			}) as HTMLInputElement;
			setNativeValue(strength, "65");
			fireEvent.input(strength);
			const skill = view.getByRole("spinbutton", {
				name: "技能 侦查",
			}) as HTMLInputElement;
			setNativeValue(skill, "60");
			fireEvent.input(skill);
			fireEvent.click(view.getByRole("button", { name: "保存" }));
			await waitFor(() =>
				expect(
					calls.some((call) =>
						call.url.includes("/pl/characters/char-profile"),
					),
				).toBe(true),
			);
			await waitFor(() => {
				const latest = [...calls]
					.reverse()
					.find((entry) => entry.url.includes("/pl/characters/char-profile"));
				const sent = JSON.parse(latest?.body ?? "{}") as {
					sheetData: { attributes: Record<string, number> };
				};
				expect(sent.sheetData.attributes.str).toBe(65);
			});
			const call = [...calls]
				.reverse()
				.find((entry) => entry.url.includes("/pl/characters/char-profile"));
			const payload = JSON.parse(call?.body ?? "{}") as {
				expectedVersion: number;
				sheetData: ReturnType<typeof coc7e.normalizeCoc7eSheet>;
			};
			expect(payload.expectedVersion).toBe(4);
			expect(payload.sheetData.attributes.str).toBe(65);
			expect(payload.sheetData.skills["侦查"]).toBe(60);
			expect(payload.sheetData.weapons[0]?.name).toBe("警用左轮");
			expect(payload.sheetData.assets.cash).toBe(82);
			expect(payload.sheetData.assets.details[0]?.name).toBe("公寓");
			expect(payload.sheetData.spells[0]?.effect).toBe("保留");
			expect(payload.sheetData.schemaVersion).toBe(2);
		} finally {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		}
	});
});

function setNativeValue(element: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)?.set;
	setter?.call(element, value);
}
