import { beforeEach, describe, expect, test } from "bun:test";
import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CharacterSheetPage } from "../src/features/characters/character-sheet-page";

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

function detail(
	overrides: Partial<CharacterDetailDto> = {},
): CharacterDetailDto {
	return {
		id: "char-sheet",
		ownerId: "pl-1",
		ownerKind: "pl",
		name: "立绘侦探",
		background: "曾经的警探",
		kind: "pc",
		ruleId: "coc7e",
		sheetJson: JSON.stringify(
			coc7e.normalizeCoc7eSheet({ attributes, skills: { 侦查: 55 } }),
		),
		sheetVersion: 2,
		profileVersion: 2,
		version: 4,
		originType: null,
		originRefId: null,
		createdAt: 1,
		updatedAt: 1,
		portraits: [],
		...overrides,
	};
}

function mockFetch(
	respond: (url: string) => CharacterDto | CharacterDetailDto,
) {
	const calls: Array<{ url: string; method: string; body: string }> = [];
	const originalFetch = globalThis.fetch;
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		writable: true,
		value: (async (url: string | URL, init?: RequestInit) => {
			calls.push({
				url: String(url),
				method: String(init?.method ?? "GET"),
				body: String(init?.body ?? ""),
			});
			return new Response(JSON.stringify(respond(String(url))), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch,
	});
	return {
		calls,
		restore() {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		},
	};
}

function setValue(element: HTMLElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)?.set;
	setter?.call(element, value);
	fireEvent.input(element);
}

describe("character sheet page", () => {
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

	test("pl scope loads the character and patches edited sheet with expectedVersion", async () => {
		const { calls, restore } = mockFetch((url) =>
			url.includes("char-sheet") ? detail() : detail(),
		);
		try {
			const view = render(
				<CharacterSheetPage
					scope="pl"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			const strength = (await view.findByRole("spinbutton", {
				name: "力量 STR",
			})) as HTMLInputElement;
			expect(strength.value).toBe("50");
			setValue(strength, "65");
			fireEvent.click(view.getByRole("button", { name: "保存" }));
			await waitFor(() =>
				expect(
					calls.some(
						(call) =>
							call.method === "PATCH" &&
							call.url.includes("/pl/characters/char-sheet"),
					),
				).toBe(true),
			);
			const patch = calls.find(
				(call) =>
					call.method === "PATCH" &&
					call.url.includes("/pl/characters/char-sheet"),
			);
			const payload = JSON.parse(patch?.body ?? "{}") as {
				name: string;
				background: string;
				expectedVersion: number;
				sheetData: ReturnType<typeof coc7e.normalizeCoc7eSheet>;
			};
			expect(payload.name).toBe("立绘侦探");
			expect(payload.background).toBe("曾经的警探");
			expect(payload.expectedVersion).toBe(4);
			expect(payload.sheetData.attributes.str).toBe(65);
			expect(payload.sheetData.skills.侦查).toBe(55);
		} finally {
			restore();
		}
	});

	test("gm scope shows read-only hint for a player-owned character", async () => {
		const { calls, restore } = mockFetch(() => detail());
		try {
			const view = render(
				<CharacterSheetPage
					scope="gm"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			await view.findByText(
				"该人物属于玩家。主持人只能通过「永久修正」修改终生属性并留下审计，完整数值请由玩家本人编辑。",
			);
			expect(view.queryByRole("button", { name: "完整数值" })).toBeNull();
			expect(
				calls.some(
					(call) =>
						call.method === "PATCH" && call.url.includes("/gm/characters"),
				),
			).toBe(false);
		} finally {
			restore();
		}
	});
});
