import { beforeEach, describe, expect, test } from "bun:test";
import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { coc7e, dnd5r } from "@cogm/shared";
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
			expect(view.queryByRole("textbox", { name: "姓名" })).toBeNull();
		} finally {
			restore();
		}
	});

	test("profile tab renders structured background UI and keeps detailed background independently editable", async () => {
		const char = detail({
			background: "曾经在伦敦担任警探，后来转行做私家调查。",
			sheetJson: JSON.stringify(
				coc7e.normalizeCoc7eSheet({
					attributes,
					skills: { 侦查: 55 },
					backgroundProfile: {
						ideologyBeliefs: "真理高于一切",
						keyConnection: "ideologyBeliefs",
					},
				}),
			),
		});
		const { calls, restore } = mockFetch(() => char);
		try {
			const view = render(
				<CharacterSheetPage
					scope="pl"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			await view.findByRole("spinbutton", { name: "力量 STR" });
			fireEvent.mouseDown(view.getByRole("tab", { name: "资料与立绘" }), {
				button: 0,
			});
			await waitFor(() =>
				expect(
					view
						.getByRole("tab", { name: "资料与立绘" })
						.getAttribute("aria-selected"),
				).toBe("true"),
			);
			expect(await view.findByRole("textbox", { name: "姓名" })).toBeTruthy();
			expect(view.getByText("人物卡背景设定")).toBeTruthy();
			expect(view.getByText("思想与信念")).toBeTruthy();
			expect(view.getByText("关键链接")).toBeTruthy();
			expect(view.getByText("真理高于一切")).toBeTruthy();
			expect(view.queryByText(/【思想与信念/)).toBeNull();
			expect(view.queryByText("自动同步")).toBeNull();

			const detailedInput = view.getByRole("textbox", {
				name: "详细背景描述",
			}) as HTMLTextAreaElement;
			expect(detailedInput.value).toBe(
				"曾经在伦敦担任警探，后来转行做私家调查。",
			);
			const setter = Object.getOwnPropertyDescriptor(
				HTMLTextAreaElement.prototype,
				"value",
			)?.set;
			setter?.call(detailedInput, "补充了详细的童年经历与动机。");
			fireEvent.input(detailedInput);
			fireEvent.click(view.getByRole("button", { name: "保存" }));
			await waitFor(() =>
				expect(calls.some((call) => call.method === "PATCH")).toBe(true),
			);
			const patch = calls.find((call) => call.method === "PATCH");
			const payload = JSON.parse(patch?.body ?? "{}") as {
				background: string;
			};
			expect(payload.background).toBe("补充了详细的童年经历与动机。");
		} finally {
			restore();
		}
	});

	test("pl scope blocks saving when detailed background is cleared to blank", async () => {
		const char = detail({ background: "原有详细背景" });
		const { calls, restore } = mockFetch(() => char);
		try {
			const view = render(
				<CharacterSheetPage
					scope="pl"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			await view.findByRole("spinbutton", { name: "力量 STR" });
			fireEvent.mouseDown(view.getByRole("tab", { name: "资料与立绘" }), {
				button: 0,
			});
			const detailedInput = (await view.findByRole("textbox", {
				name: "详细背景描述",
			})) as HTMLTextAreaElement;
			const setter = Object.getOwnPropertyDescriptor(
				HTMLTextAreaElement.prototype,
				"value",
			)?.set;
			setter?.call(detailedInput, "   ");
			fireEvent.input(detailedInput);
			fireEvent.click(view.getByRole("button", { name: "保存" }));
			expect(
				view.getByText("请至少填写 1 个字的人物详细背景描述"),
			).toBeTruthy();
			expect(calls.some((call) => call.method === "PATCH")).toBe(false);
		} finally {
			restore();
		}
	});

	test("gm scope renders full read-only CoC 7e sheet, history, and portraits for a player-owned character", async () => {
		const richSheet = coc7e.normalizeCoc7eSheet({
			era: "modern",
			age: 21,
			attributes: { ...attributes, str: 60, int: 75, pow: 65, luck: 55 },
			profile: {
				gender: "女",
				residence: "东京",
				birthplace: "秋叶原",
				appearance: "戴厚镜片眼镜的大学生",
			},
			occupation: {
				presetId: null,
				name: "学生、实习生",
				creditMin: 5,
				creditMax: 15,
				skillKeys: ["图书馆使用", "侦查"],
			},
			skills: { 侦查: 70, 图书馆使用: 65, 信用评级: 10 },
			skillAllocation: {
				侦查: { occupation: 45, interest: 0, experience: 0 },
				图书馆使用: { occupation: 45, interest: 0, experience: 0 },
				信用评级: { occupation: 10, interest: 0, experience: 0 },
			},
			weapons: [
				{
					name: "防身短棍",
					skillKey: "斗殴",
					damage: "1d6",
					range: "近战",
					attacks: "1",
					applyDamageBonus: true,
				},
			],
			armor: { name: "厚冬装", value: 1, locations: "躯干", penalty: 0 },
			gear: [
				{
					name: "母亲的樱花胸针",
					quantity: 1,
					slot: "chest",
					status: "in_use",
					linkedPossession: true,
					note: "从不离身",
				},
			],
			assets: {
				currency: "¥",
				spendingLevel: 5000,
				cash: 12000,
				otherAssets: 80000,
				details: [{ category: "securities", name: "奖学金存折", value: 80000 }],
			},
			backgroundProfile: {
				ideologyBeliefs: "只想平静地读完大学",
				significantPeople: "母亲",
				keyConnection: "significantPeople",
				keyConnectionStory: "每周五都会回家看望母亲",
				partners: [
					{ id: "p1", characterId: null, name: "小林", note: "社团学姐" },
				],
			},
			spells: [
				{
					name: "枯萎术",
					mpCost: "3",
					sanCost: "1d4",
					castingTime: "即时",
					effect: "令植物迅速枯萎",
				},
			],
			mythosTomes: [
				{
					name: "旧书摊抄本",
					sanLoss: "1d3",
					mythosGain: 2,
					studyHours: 6,
					spells: "枯萎术",
				},
			],
			encounters: [
				{
					name: "静眠山黑影",
					sanLoss: "1/1d6",
					mythosGain: 1,
					count: 1,
					notes: "在雾夜山道目击",
				},
			],
			experiences: [
				{
					id: "exp-1",
					title: "初入静眠山",
					sourceType: "manual",
					summary: "在老宅阁楼发现笔记",
					changes: ["SAN -2"],
					occurredLabel: "2026-11",
				},
			],
		});
		const playerChar = detail({
			name: "由美",
			sheetJson: JSON.stringify(richSheet),
			portraits: [
				{
					id: "p-default",
					characterId: "char-sheet",
					expressionKey: "default",
					label: "微笑",
					portraitAssetId: "asset-smile",
					isDefault: 1,
					sortOrder: 0,
					createdAt: 1,
				},
			],
		});
		const calls: Array<{ url: string; method: string; body: string }> = [];
		const originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				calls.push({
					url: target,
					method: String(init?.method ?? "GET"),
					body: String(init?.body ?? ""),
				});
				if (target.includes("/sheet-context")) {
					return new Response(
						JSON.stringify({
							companions: [],
							phaseRecords: [],
							growthRecords: [],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				if (target.includes("/history")) {
					return new Response(
						JSON.stringify({
							versions: [],
							growth: [
								{
									id: "g-1",
									characterId: "char-sheet",
									sessionId: "sess-1",
									skillKey: "侦查",
									oldValue: 65,
									newValue: 70,
									actorUserId: "gm-1",
									reason: "结团成长",
									createdAt: 1_700_000_000_000,
								},
							],
							audits: [
								{
									id: "a-1",
									characterId: "char-sheet",
									sessionId: "sess-1",
									gmUserId: "gm-1",
									field: "pow",
									oldValue: "60",
									newValue: "65",
									reason: "仪式祝福",
									createdAt: 1_700_000_000_000,
								},
							],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}
				return new Response(JSON.stringify(playerChar), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as typeof fetch,
		});
		try {
			const view = render(
				<CharacterSheetPage
					scope="gm"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			await view.findByText(
				"该人物属于玩家。主持人只能通过「永久修正」修改终生属性并留下审计，完整人物卡请由玩家本人编辑。",
			);
			expect(
				view
					.getByRole("tab", { name: "完整人物卡" })
					.getAttribute("aria-selected"),
			).toBe("true");
			expect(view.queryByRole("button", { name: "保存" })).toBeNull();
			expect(view.queryByRole("spinbutton")).toBeNull();

			// 属性与衍生数值、技能、装备、资产、背景、神话、经历、成长审计完整可见
			expect(view.getByText("基础资料与衍生数值")).toBeTruthy();
			expect(view.getByText("九项属性")).toBeTruthy();
			expect(view.getByText("30 / 12")).toBeTruthy(); // STR 60 -> 30/12
			expect(view.getByText("防身短棍")).toBeTruthy();
			expect(view.getByText("厚冬装")).toBeTruthy();
			expect(view.getByText("母亲的樱花胸针")).toBeTruthy();
			expect(view.getByText("奖学金存折")).toBeTruthy();
			expect(view.getByText("每周五都会回家看望母亲")).toBeTruthy();
			expect(view.getByText("小林")).toBeTruthy();
			expect(view.getByText("枯萎术")).toBeTruthy();
			expect(view.getByText("旧书摊抄本")).toBeTruthy();
			expect(view.getByText("静眠山黑影")).toBeTruthy();
			expect(view.getByText("初入静眠山")).toBeTruthy();
			expect(await view.findByText(/侦查：65 → 70/)).toBeTruthy();
			expect(view.getByText(/原因：仪式祝福/)).toBeTruthy();

			// 切换到「资料与立绘」以结构化 UI 展示背景并只读查看立绘与详细背景描述
			fireEvent.mouseDown(view.getByRole("tab", { name: "资料与立绘" }), {
				button: 0,
			});
			expect(await view.findByText("表情立绘")).toBeTruthy();
			expect(view.getByText("人物卡背景设定")).toBeTruthy();
			expect(view.getByText("详细背景描述")).toBeTruthy();
			expect(view.getByText("曾经的警探")).toBeTruthy();
			expect(view.queryByText(/【思想与信念/)).toBeNull();
			expect(view.getByAltText("微笑")).toBeTruthy();
			expect(view.queryByRole("textbox", { name: "姓名" })).toBeNull();
			expect(view.queryByRole("textbox", { name: "详细背景描述" })).toBeNull();
			expect(
				calls.some(
					(call) =>
						call.method === "PATCH" && call.url.includes("/gm/characters"),
				),
			).toBe(false);
		} finally {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		}
	});

	test("gm scope renders full read-only D&D 5r sheet and read-only profile background", async () => {
		const dndSheet = dnd5r.CharacterSheet.parse({
			...dnd5r.createBlankSheet(),
			level: 5,
			subclass: "战斗大师",
			feats: ["警觉"],
			inventory: [{ name: "医疗包", quantity: 2 }],
			notes: "守卫北境关隘的老兵笔记",
		});
		const dndChar = detail({
			ruleId: "dnd5r",
			name: "艾拉",
			background: "曾效力于北境军团",
			sheetJson: JSON.stringify(dndSheet),
		});
		const { restore } = mockFetch(() => dndChar);
		try {
			const view = render(
				<CharacterSheetPage
					scope="gm"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			expect(await view.findByText("核心概念与衍生数值")).toBeTruthy();
			expect(view.getByText("六项属性与豁免检定")).toBeTruthy();
			expect(view.getByText("战斗大师")).toBeTruthy();
			expect(view.getByText("医疗包")).toBeTruthy();
			expect(view.getByText("警觉")).toBeTruthy();
			expect(view.getByText("守卫北境关隘的老兵笔记")).toBeTruthy();
			expect(view.queryByRole("button", { name: "保存" })).toBeNull();

			fireEvent.mouseDown(view.getByRole("tab", { name: "资料与立绘" }), {
				button: 0,
			});
			expect(await view.findByText("曾效力于北境军团")).toBeTruthy();
			expect(view.queryByRole("textbox", { name: "背景" })).toBeNull();
			expect(view.getByText("该人物尚未上传表情立绘。")).toBeTruthy();
		} finally {
			restore();
		}
	});

	test("loads sheet-context phase records, claims one into experiences, and persists via PATCH", async () => {
		const calls: Array<{ url: string; method: string; body: string }> = [];
		const originalFetch = globalThis.fetch;
		const char = detail();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				const method = String(init?.method ?? "GET");
				calls.push({ url: target, method, body: String(init?.body ?? "") });
				if (target.includes("/sheet-context")) {
					return new Response(
						JSON.stringify({
							companions: [],
							phaseRecords: [
								{
									sessionId: "sess-1",
									sessionName: "雾中山庄",
									eventId: 42,
									phase: "performance_time",
									occurredAt: 1_700_000_000_000,
								},
							],
							growthRecords: [],
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}
				return new Response(JSON.stringify(char), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as typeof fetch,
		});
		try {
			const view = render(
				<CharacterSheetPage
					scope="pl"
					characterId="char-sheet"
					onBack={() => undefined}
				/>,
			);
			await view.findByRole("spinbutton", { name: "力量 STR" });
			await waitFor(() =>
				expect(calls.some((call) => call.url.includes("/sheet-context"))).toBe(
					true,
				),
			);
			fireEvent.click(view.getByRole("tab", { name: /经历/ }));
			fireEvent.click(view.getByRole("button", { name: "认领团阶段记录" }));
			expect(await view.findByText("雾中山庄 · 演绎时间")).toBeTruthy();
			fireEvent.click(view.getByRole("button", { name: "认领" }));
			expect(view.getByRole("button", { name: "已认领" })).toBeTruthy();
			fireEvent.click(view.getByRole("button", { name: "保存" }));
			await waitFor(() =>
				expect(calls.some((call) => call.method === "PATCH")).toBe(true),
			);
			const patch = calls.find((call) => call.method === "PATCH");
			const body = JSON.parse(patch?.body ?? "{}") as {
				sheetData: {
					experiences: Array<{
						sourceType: string;
						refId: string;
						refLabel: string;
					}>;
				};
			};
			expect(body.sheetData.experiences).toHaveLength(1);
			expect(body.sheetData.experiences[0]).toMatchObject({
				sourceType: "session_phase",
				refId: "sess-1:42",
				refLabel: "雾中山庄 · 演绎时间",
			});
		} finally {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		}
	});
});
