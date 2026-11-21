import { beforeEach, describe, expect, test } from "bun:test";
import type {
	CharacterCreationRollDto,
	CharacterSheetContextResponse,
} from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { Coc7eCharacterCreationEditor } from "../src/rules/coc7e/character-creation-editor";
import { Coc7eBackgroundTab } from "../src/rules/coc7e/tabs/background-tab";
import type { RuleCreationRollContext } from "../src/rules/types";

type Sheet = ReturnType<typeof coc7e.normalizeCoc7eSheet>;

const baseAttributes = {
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

function emptySheet(): Sheet {
	return coc7e.normalizeCoc7eSheet({ attributes: baseAttributes, skills: {} });
}

function Harness({
	initial = emptySheet(),
	sheetContext = null,
	creation = null,
	onChange,
}: {
	initial?: Sheet;
	sheetContext?: CharacterSheetContextResponse | null;
	creation?: RuleCreationRollContext | null;
	onChange: (sheet: Sheet) => void;
}) {
	const [sheet, setSheet] = useState(initial);
	return (
		<Coc7eCharacterCreationEditor
			creation={creation}
			sheet={sheet}
			showValidation={false}
			onValidityChange={() => undefined}
			sheetContext={sheetContext}
			onChange={(next) => {
				const parsed = coc7e.Coc7eCharacterSheet.parse(next);
				onChange(parsed);
				setSheet(parsed);
			}}
		/>
	);
}

function BackgroundHarness() {
	const [sheet, setSheet] = useState(emptySheet());
	const [background, setBackground] = useState("");
	return (
		<div>
			<Coc7eBackgroundTab
				sheet={sheet}
				onChange={(patch) => setSheet((current) => ({ ...current, ...patch }))}
				background={background}
				onBackgroundChange={setBackground}
			/>
			<output data-testid="background-value">{background}</output>
		</div>
	);
}

function setValue(element: HTMLElement, value: string) {
	const prototype =
		element.tagName === "TEXTAREA"
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	setter?.call(element, value);
	fireEvent.input(element);
}

function openTab(view: ReturnType<typeof render>, pattern: RegExp) {
	fireEvent.click(view.getByRole("tab", { name: pattern }));
}

describe("CoC 7e v2 7-tab features", () => {
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

	test("without a creation method attributes are manual-only", () => {
		const view = render(<Harness onChange={() => undefined} />);
		expect(view.queryByRole("button", { name: "一键掷全部属性" })).toBeNull();
		expect(view.queryByRole("button", { name: /重掷/ })).toBeNull();
		expect(view.queryByRole("button", { name: /天命骰/ })).toBeNull();
	});

	test("destiny: rolls once via the server context and applies the chosen set", async () => {
		const setA = { ...baseAttributes, str: 80, luck: 35 };
		const setB = { ...baseAttributes, str: 40, siz: 70, luck: 60 };
		const rolled: CharacterCreationRollDto = {
			id: "roll-1",
			ruleId: "coc7e",
			options: { method: "destiny", count: 2 },
			result: {
				method: "destiny",
				sets: [
					{ attributes: setA, youngLuck: 20 },
					{ attributes: setB, youngLuck: 75 },
				],
			},
			chosenIndex: null,
			createdAt: 1,
			chosenAt: null,
		};
		const calls: string[] = [];
		function DestinyHarness({ onChange }: { onChange: (sheet: Sheet) => void }) {
			const [roll, setRoll] = useState<CharacterCreationRollDto | null>(null);
			return (
				<Harness
					onChange={onChange}
					creation={{
						options: { method: "destiny", count: 2 },
						roll,
						pending: false,
						onRoll: async () => {
							calls.push("roll");
							setRoll(rolled);
							return rolled;
						},
						onChoose: async (index) => {
							calls.push(`choose:${index}`);
							const next = { ...rolled, chosenIndex: index, chosenAt: 2 };
							setRoll(next);
							return next;
						},
					}}
				/>
			);
		}
		let latest = emptySheet();
		const view = render(
			<DestinyHarness
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		fireEvent.click(view.getByRole("button", { name: "天命骰（2 套）" }));
		await waitFor(() => expect(view.getByText("第 2 套")).toBeTruthy());
		expect(view.queryByRole("button", { name: /天命骰/ })).toBeNull();
		fireEvent.click(view.getAllByRole("button", { name: "选这套" })[1]!);
		fireEvent.click(
			within(document.body).getByRole("button", { name: "选定" }),
		);
		await waitFor(() => expect(latest.attributes).toEqual(setB));
		expect(calls).toEqual(["roll", "choose:1"]);
		expect(view.queryByRole("button", { name: "选这套" })).toBeNull();
		expect(view.getByText("已选定")).toBeTruthy();
	});

	test("point buy: shows the budget and rolls luck once", async () => {
		const rolled: CharacterCreationRollDto = {
			id: "roll-2",
			ruleId: "coc7e",
			options: { method: "pointBuy", points: 460 },
			result: { method: "pointBuy", luck: 65, youngLuck: 30 },
			chosenIndex: 0,
			createdAt: 1,
			chosenAt: 1,
		};
		function PointBuyHarness({
			onChange,
		}: {
			onChange: (sheet: Sheet) => void;
		}) {
			const [roll, setRoll] = useState<CharacterCreationRollDto | null>(null);
			return (
				<Harness
					onChange={onChange}
					creation={{
						options: { method: "pointBuy", points: 460 },
						roll,
						pending: false,
						onRoll: async () => {
							setRoll(rolled);
							return rolled;
						},
						onChoose: async () => null,
					}}
				/>
			);
		}
		let latest = emptySheet();
		const view = render(
			<PointBuyHarness
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		expect(view.getByText("已分配 400 / 460")).toBeTruthy();
		expect(view.getByText("剩余 60")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "骰幸运（只能掷一次）" }));
		await waitFor(() => expect(latest.attributes.luck).toBe(65));
		expect(view.queryByRole("button", { name: "骰幸运（只能掷一次）" })).toBeNull();
		expect(view.getByText("幸运 65")).toBeTruthy();
	});

	test("enables storied investigator rule with adjustable experience budget and 3rd ledger column", async () => {
		let latest = emptySheet();
		const view = render(
			<Harness
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		const toggle = view.getByRole("switch", {
			name: "有故事的调查员（可选规则）",
		});
		expect(toggle.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(toggle);
		await waitFor(() => expect(latest.profile.storiedInvestigator).toBe(true));
		const bonusInput = view.getByRole("spinbutton", {
			name: "经历包技能点预算",
		});
		setValue(bonusInput, "120");
		await waitFor(() => expect(latest.profile.experienceBonusPoints).toBe(120));

		openTab(view, /技能/);
		const ledger = view.getByRole("region", { name: "技能点账本" });
		expect(ledger.textContent).toContain("经历包点数");
		expect(ledger.textContent).toContain("120");

		// Allocate 5 points from experience bucket on 侦查
		const spotCard = view
			.getByRole("spinbutton", { name: "技能 侦查" })
			.closest("div.flex.flex-col.gap-2\\.5") as HTMLElement;
		fireEvent.click(within(spotCard).getByRole("button", { name: /^经历/ }));
		await waitFor(() => {
			expect(latest.skillAllocation["侦查"]?.experience).toBe(5);
			expect(latest.skills["侦查"]).toBe(30);
		});
		expect(ledger.textContent).toContain("余 115");
	});

	test("synchronizes cross-tab credit warnings between occupation and equipment tabs and fixes in one click", async () => {
		let latest = emptySheet();
		const view = render(
			<Harness
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		openTab(view, /职业/);
		fireEvent.click(view.getByRole("button", { name: "选择职业…" }));
		fireEvent.change(
			view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "会计师" } },
		);
		fireEvent.click(view.getByRole("button", { name: "会计师" }));
		await waitFor(() => expect(latest.occupation.creditMin).toBe(30));
		// Both Occupation tab and Equipment tab carry credit alert
		expect(view.getByRole("tab", { name: /职业.*提醒/ })).toBeTruthy();
		expect(view.getByRole("tab", { name: /装备·资产.*1 项提醒/ })).toBeTruthy();
		// Jump to Assets via the occupation alert button
		fireEvent.click(view.getByRole("button", { name: "去装备·资产页修正" }));
		expect(
			view
				.getByRole("tab", { name: /装备·资产/ })
				.getAttribute("aria-selected"),
		).toBe("true");
		expect(view.getAllByText(/超出职业范围 30–70/).length).toBeGreaterThan(0);
		// Click one-click fix to 30
		fireEvent.click(view.getByRole("button", { name: "一键调到 30" }));
		await waitFor(() => expect(latest.skills["信用评级"]).toBe(30));
		expect(view.getByRole("tab", { name: "装备·资产，无提醒" })).toBeTruthy();
	});

	test("supports 8-grid background, exclusive key connection, and multiple partner cards", async () => {
		let latest = emptySheet();
		const sheetContext: CharacterSheetContextResponse = {
			companions: [
				{
					characterId: "pc-2",
					name: "安妮·博士",
					sessionId: "sess-1",
					sessionName: "阿卡姆迷雾",
					linkedToMe: true,
				},
			],
			phaseRecords: [],
			growthRecords: [],
		};
		const view = render(
			<Harness
				sheetContext={sheetContext}
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		openTab(view, /背景/);
		setValue(
			view.getByRole("textbox", { name: "思想与信念" }),
			"理智终将战胜疯狂",
		);
		setValue(view.getByRole("textbox", { name: "重要之人" }), "失踪的导师");
		const keyButtons = view.getAllByRole("button", { name: "设为关键链接" });
		expect(keyButtons).toHaveLength(8);
		if (keyButtons[0]) {
			fireEvent.click(keyButtons[0]);
		}
		await waitFor(() =>
			expect(latest.backgroundProfile.keyConnection).toBe("ideologyBeliefs"),
		);
		// Selecting another field switches the single key connection
		const nextKeyButton = view.getAllByRole("button", {
			name: "设为关键链接",
		})[0];
		if (nextKeyButton) {
			fireEvent.click(nextKeyButton);
		}
		await waitFor(() =>
			expect(latest.backgroundProfile.keyConnection).toBe("significantPeople"),
		);

		fireEvent.click(view.getByRole("button", { name: "添加一位伙伴" }));
		const partnerTrigger = view.getByRole("combobox", {
			name: "从同团成员选择",
		});
		fireEvent.pointerDown(partnerTrigger, { button: 0, ctrlKey: false });
		fireEvent.click(partnerTrigger);
		fireEvent.click(
			await within(view.baseElement).findByRole("option", {
				name: "安妮·博士（阿卡姆迷雾）",
			}),
		);
		await waitFor(() => {
			expect(latest.backgroundProfile.partners[0]).toMatchObject({
				characterId: "pc-2",
				name: "安妮·博士",
			});
		});
		expect(view.getByText(/同团互为伙伴 · 阿卡姆迷雾/)).toBeTruthy();

		setValue(
			view.getByRole("textbox", { name: "关系小注" }),
			"一起调查密大失踪案",
		);
		fireEvent.click(view.getByRole("button", { name: "添加一位伙伴" }));
		const nameFields = view.getAllByRole("textbox", { name: "伙伴姓名" });
		const secondName = nameFields[1];
		if (secondName) {
			setValue(secondName, "手写的线人");
		}
		await waitFor(() => {
			expect(latest.backgroundProfile.partners).toHaveLength(2);
			expect(latest.backgroundProfile.partners[0]?.note).toBe(
				"一起调查密大失踪案",
			);
			expect(latest.backgroundProfile.partners[1]?.name).toBe("手写的线人");
		});
		fireEvent.click(view.getByRole("button", { name: "移除第 2 位伙伴" }));
		await waitFor(() =>
			expect(latest.backgroundProfile.partners).toHaveLength(1),
		);

		setValue(
			view.getByRole("textbox", { name: "关键链接小传" }),
			"导师十年前失踪于密大图书馆。",
		);
		await waitFor(() =>
			expect(latest.backgroundProfile.keyConnectionStory).toBe(
				"导师十年前失踪于密大图书馆。",
			),
		);
	});

	test("clears the auto-synced background when the last partner is emptied", async () => {
		const view = render(<BackgroundHarness />);
		fireEvent.click(view.getByRole("button", { name: "添加一位伙伴" }));
		const nameField = view.getByRole("textbox", { name: "伙伴姓名" });
		setValue(nameField, "1");
		await waitFor(() =>
			expect(view.getByTestId("background-value").textContent).toBe(
				"【调查员伙伴】1",
			),
		);
		setValue(nameField, "");
		await waitFor(() =>
			expect(view.getByTestId("background-value").textContent).toBe(""),
		);
	});

	test("manages gear backpack cards, wear slots, statuses, and one-click weapon registration", async () => {
		let latest = emptySheet();
		const view = render(
			<Harness
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		openTab(view, /装备·资产/);
		expect(view.getByText("穿戴在身")).toBeTruthy();
		expect(view.getByText(/暂无穿戴在身的装备/)).toBeTruthy();
		expect(view.getByText(/背包暂无物品/)).toBeTruthy();
		const quickInput = view.getByPlaceholderText("输入物品名称快速添加…");
		setValue(quickInput, "警用左轮手枪");
		fireEvent.click(view.getByRole("button", { name: "放入背包" }));
		await waitFor(() => expect(latest.gear).toHaveLength(1));

		// Increment quantity +1
		fireEvent.click(view.getByRole("button", { name: "警用左轮手枪 +1" }));
		await waitFor(() => expect(latest.gear[0]?.quantity).toBe(2));

		// Unregistered weapon badge/button appears and registers weapon
		fireEvent.click(view.getByRole("button", { name: "补登记为武器" }));
		await waitFor(() => {
			expect(latest.weapons).toHaveLength(1);
			expect(latest.weapons[0]?.name).toBe("警用左轮手枪");
			expect(latest.weapons[0]?.skillKey).toBe("射击(手枪)");
		});

		// Expand gear card to move it to chest wear slot & mark as lent & treasured possession
		fireEvent.click(view.getByRole("button", { name: "警用左轮手枪" }));
		const slotTrigger = view.getByRole("combobox", { name: "位置" });
		fireEvent.pointerDown(slotTrigger, { button: 0, ctrlKey: false });
		fireEvent.click(slotTrigger);
		fireEvent.click(
			await within(view.baseElement).findByRole("option", { name: "胸前" }),
		);
		const statusTrigger = view.getByRole("combobox", { name: "状态" });
		fireEvent.pointerDown(statusTrigger, { button: 0, ctrlKey: false });
		fireEvent.click(statusTrigger);
		fireEvent.click(
			await within(view.baseElement).findByRole("option", { name: "借出" }),
		);
		fireEvent.click(view.getByRole("checkbox", { name: "同时是宝贵之物" }));
		await waitFor(() => {
			expect(latest.gear[0]?.slot).toBe("chest");
			expect(latest.gear[0]?.status).toBe("lent");
			expect(latest.gear[0]?.linkedPossession).toBe(true);
		});
		expect(view.getByText("穿戴在身")).toBeTruthy();
	});

	test("claims experiences from sheet records and KP phase records, adds manual entries, and shows growth table", async () => {
		const initial = emptySheet();
		initial.encounters = [
			{
				name: "深潜者伏击",
				sanLoss: "1d6",
				mythosGain: 3,
				count: 1,
				notes: "码头仓库夜战",
			},
		];
		const sheetContext: CharacterSheetContextResponse = {
			companions: [],
			phaseRecords: [
				{
					sessionId: "sess-1",
					sessionName: "阿卡姆迷雾",
					eventId: 1,
					phase: "free_discussion",
					occurredAt: 1_700_000_000_000,
				},
			],
			growthRecords: [
				{
					id: "g-1",
					characterId: "pc-1",
					sessionId: "sess-1",
					actorUserId: "user-1",
					skillKey: "侦查",
					oldValue: 50,
					newValue: 55,
					reason: "幕间成长",
					createdAt: 1_700_000_000_000,
				},
			],
		};
		let latest = initial;
		const view = render(
			<Harness
				initial={initial}
				sheetContext={sheetContext}
				onChange={(next) => {
					latest = next;
				}}
			/>,
		);
		openTab(view, /经历/);
		expect(view.getByText(/侦查：50 → 55（幕间成长）/)).toBeTruthy();

		// Claim from sheet records
		fireEvent.click(view.getByRole("button", { name: "从卡内记录引用" }));
		fireEvent.click(view.getByRole("button", { name: "认领" }));
		await waitFor(() => {
			expect(latest.experiences).toHaveLength(1);
			expect(latest.experiences[0]?.sourceType).toBe("record");
		});
		expect(view.getByRole("button", { name: "已认领" })).toBeTruthy();

		// Claim from KP phase records
		fireEvent.click(view.getByRole("button", { name: "认领团阶段记录" }));
		expect(view.getByText("阿卡姆迷雾 · 自由讨论")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "认领" }));
		await waitFor(() => {
			expect(latest.experiences).toHaveLength(2);
			expect(latest.experiences[0]?.sourceType).toBe("session_phase");
			expect(latest.experiences[0]?.refLabel).toBe("阿卡姆迷雾 · 自由讨论");
		});

		// Add manual experience
		fireEvent.click(view.getByRole("button", { name: "手写一条" }));
		await waitFor(() => {
			expect(latest.experiences).toHaveLength(3);
			expect(latest.experiences[0]?.sourceType).toBe("manual");
		});
	});

	test("summarizes issues on review tab, jumps to target tab, and scrolls mobile tab bar into view", async () => {
		const originalScrollIntoView = Element.prototype.scrollIntoView;
		let scrollCalls = 0;
		Element.prototype.scrollIntoView = () => {
			scrollCalls += 1;
		};
		try {
			const view = render(<Harness onChange={() => undefined} />);
			openTab(view, /检查/);
			expect(scrollCalls).toBeGreaterThan(0);
			const reviewTab = view.getByRole("tab", { name: /检查/ });
			expect(reviewTab.className).toContain("min-w-[96px]");
			expect(reviewTab.className).toContain("min-h-[44px]");
			expect(view.getByText(/背景已填 0\/8 格/)).toBeTruthy();
			expect(view.getByText(/待确认提醒/)).toBeTruthy();
			fireEvent.click(view.getByRole("button", { name: "去背景页补齐" }));
			expect(
				view.getByRole("tab", { name: /背景/ }).getAttribute("aria-selected"),
			).toBe("true");
		} finally {
			Element.prototype.scrollIntoView = originalScrollIntoView;
		}
	});
});
