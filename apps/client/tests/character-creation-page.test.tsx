import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RuleMetadata } from "@cogm/shared";
import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { useState } from "react";
import {
	characterCreationDraftKey,
	createEmptyCharacterSheet,
} from "../src/features/characters/character-creation-draft";
import {
	CharacterCreationPageView,
	type CharacterCreationSubmission,
} from "../src/features/characters/character-creation-page";

type FetchCall = { url: string; init: RequestInit };

const rules: RuleMetadata[] = [
	{
		id: "coc7e",
		name: "克苏鲁的呼唤 7 版",
		version: "2.0.0",
		apiVersion: 1,
		description: "CoC 7e 规则",
		permanentSheetFields: [
			"str",
			"con",
			"siz",
			"dex",
			"app",
			"int",
			"pow",
			"edu",
			"luck",
		],
	},
];

const inviteInfo = {
	scope: "module",
	targetId: "module-1",
	targetName: "阿卡姆的雾",
	ruleId: "coc7e",
	expiresAt: 4102444800000,
	ownedCharacters: [],
};

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function setup() {
	const calls: FetchCall[] = [];
	const responses = new Map<string, () => Response>();
	let status = 204;
	let body: unknown = null;
	const originalFetch = globalThis.fetch;
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		writable: true,
		value: (async (url: string | URL, init?: RequestInit) => {
			const target = String(url);
			calls.push({ url: target, init: init ?? {} });
			const matching = responses.get(
				new URL(target, "http://localhost").pathname,
			);
			if (matching) {
				return matching();
			}
			if (status >= 400) {
				return jsonResponse(body, status);
			}
			return new Response(null, { status });
		}) as typeof fetch,
	});
	return {
		calls,
		get(path: string, response: unknown) {
			responses.set(path, () => jsonResponse(response));
		},
		failWith(nextStatus: number, nextBody: unknown) {
			status = nextStatus;
			body = nextBody;
		},
		restore() {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		},
	};
}

function seedDraft(context: string, name = "", background = "") {
	localStorage.setItem(
		characterCreationDraftKey("pl-1", context),
		JSON.stringify({
			version: 1,
			name,
			background,
			ruleId: "coc7e",
			sheet: createEmptyCharacterSheet(),
		}),
	);
}

function Harness({
	mode,
	onDone,
}: {
	mode: "independent" | "invite";
	onDone: (value: CharacterCreationSubmission) => void;
}) {
	const [done, setDone] = useState(false);
	return (
		<>
			<CharacterCreationPageView
				accountId="pl-1"
				mode={mode}
				inviteToken={mode === "invite" ? "invite-token" : null}
				inviteRuleId={mode === "invite" ? "coc7e" : undefined}
				inviteTargetName={mode === "invite" ? "阿卡姆的雾" : undefined}
				rules={rules}
				onDone={(value) => {
					onDone(value);
					setDone(true);
				}}
			/>
			{done ? <span>done</span> : null}
		</>
	);
}

function submitPage(view: ReturnType<typeof render>, label: string) {
	const button = within(view.container).getAllByRole("button", {
		name: label,
	})[0];
	if (!button) {
		throw new Error(`missing submit button ${label}`);
	}
	fireEvent.click(button);
}

function openLegacyBackground(view: ReturnType<typeof render>) {
	fireEvent.click(within(view.container).getByRole("tab", { name: /背景/ }));
	const summary = within(view.container).getByText(/档案纯文本摘要/);
	const details = summary.closest("details");
	if (details && !details.open) {
		fireEvent.click(summary);
	}
	return within(view.container).getByRole("textbox", {
		name: "背景",
	}) as HTMLTextAreaElement;
}

async function confirmSoftWarningsIfShown() {
	const proceed = await within(document.body).findByRole("button", {
		name: "仍要提交",
	});
	fireEvent.click(proceed);
}

describe("character creation page", () => {
	let cleanupHarness: (() => void) | null = null;

	beforeEach(() => {
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
		const values = new Map<string, string>();
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			writable: true,
			value: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
				removeItem: (key: string) => values.delete(key),
				clear: () => values.clear(),
			},
		});
	});

	afterEach(() => {
		cleanupHarness?.();
		cleanupHarness = null;
		cleanup();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.pointerEvents = "";
	});

	test("submits a full sheet to the independent character endpoint", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		seedDraft("independent");
		const outcome: { value: CharacterCreationSubmission | null } = {
			value: null,
		};
		const view = render(
			<Harness
				mode="independent"
				onDone={(value) => (outcome.value = value)}
			/>,
		);
		setValue(
			within(view.container).getByRole("textbox", { name: "姓名" }),
			"哈维·沃尔特",
		);
		setValue(openLegacyBackground(view), "记者，痴迷古董。");
		submitPage(view, "创建人物");
		await confirmSoftWarningsIfShown();
		await waitFor(() =>
			expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
				true,
			),
		);
		const call = harness.calls.find((entry) => entry.init.method === "POST");
		expect(call?.url).toBe("/api/v1/pl/characters");
		const payload = JSON.parse(String(call?.init.body)) as Record<
			string,
			unknown
		>;
		expect(payload.name).toBe("哈维·沃尔特");
		expect(payload.background).toBe("记者，痴迷古董。");
		expect(payload.ruleId).toBe("coc7e");
		expect(payload.sheetData).toMatchObject({ schemaVersion: 2 });
		expect((payload.sheetData as { weapons: unknown[] }).weapons).toEqual([]);
		await waitFor(() =>
			expect(within(view.container).queryByText("done")).toBeTruthy(),
		);
		expect(outcome.value).toEqual({ mode: "independent", characterId: null });
	});

	test("submits a full sheet directly through the invite endpoint", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		harness.get("/api/v1/pl/invites/invite-token", inviteInfo);
		seedDraft("invite:invite-token");
		const outcome: { value: CharacterCreationSubmission | null } = {
			value: null,
		};
		const view = render(
			<Harness mode="invite" onDone={(value) => (outcome.value = value)} />,
		);
		await waitFor(() =>
			expect(
				within(view.container).queryByText("正在核对提交链接…"),
			).toBeNull(),
		);
		setValue(
			within(view.container).getByRole("textbox", { name: "姓名" }),
			"新调查员",
		);
		submitPage(view, "提交给主持人");
		await confirmSoftWarningsIfShown();
		await waitFor(() =>
			expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
				true,
			),
		);
		const call = harness.calls.find((entry) => entry.init.method === "POST");
		expect(call?.url).toBe("/api/v1/pl/invites/invite-token/submissions");
		const payload = JSON.parse(String(call?.init.body)) as Record<
			string,
			unknown
		>;
		expect(payload.mode).toBe("new");
		expect(payload.name).toBe("新调查员");
		expect(payload.sheetData).toMatchObject({ schemaVersion: 2 });
		await waitFor(() => expect(outcome.value?.mode).toBe("invite"));
		expect(outcome.value).toEqual({ mode: "invite", characterId: null });
	});

	test("keeps all entered data and draft after a failed request", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		harness.failWith(400, { code: "VALIDATION_FAILED", message: "数值卡无效" });
		seedDraft("independent");
		const view = render(
			<Harness mode="independent" onDone={() => undefined} />,
		);
		setValue(
			within(view.container).getByRole("textbox", { name: "姓名" }),
			"未完成的调查员",
		);
		setValue(openLegacyBackground(view), "保留这段描述");
		submitPage(view, "创建人物");
		await confirmSoftWarningsIfShown();
		await waitFor(() =>
			expect(within(view.container).queryByRole("alert")).toBeTruthy(),
		);
		fireEvent.click(
			within(view.container).getByRole("tab", { name: /身份·属性/ }),
		);
		expect(
			(
				within(view.container).getByRole("textbox", {
					name: "姓名",
				}) as HTMLInputElement
			).value,
		).toBe("未完成的调查员");
		expect(openLegacyBackground(view).value).toBe("保留这段描述");
		await waitFor(() =>
			expect(
				localStorage.getItem(characterCreationDraftKey("pl-1", "independent")),
			).toContain("未完成的调查员"),
		);
		expect(within(view.container).queryByText("done")).toBeNull();
	});

	test("blocks an invalid name and validates every rule field before submission", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		seedDraft("independent");
		const view = render(
			<Harness mode="independent" onDone={() => undefined} />,
		);
		submitPage(view, "创建人物");
		expect(within(view.container).getByText("此项不能为空")).toBeTruthy();
		expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
			false,
		);
		setValue(
			within(view.container).getByRole("textbox", { name: "姓名" }),
			"甲",
		);
		const strength = within(view.container).getByRole("spinbutton", {
			name: "力量 STR",
		}) as HTMLInputElement;
		setValue(strength, "0");
		submitPage(view, "创建人物");
		expect(
			within(view.container).getAllByText("请输入 1–99 的整数").length,
		).toBeGreaterThan(0);
		expect(
			within(document.body).queryByRole("button", { name: "仍要提交" }),
		).toBeNull();
		expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
			false,
		);
	});

	test("restores a saved draft and requires a second confirmation to reset it", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		seedDraft("independent", "恢复的调查员", "已有草稿");
		const view = render(
			<Harness mode="independent" onDone={() => undefined} />,
		);
		expect(
			(
				within(view.container).getByRole("textbox", {
					name: "姓名",
				}) as HTMLInputElement
			).value,
		).toBe("恢复的调查员");
		expect(openLegacyBackground(view).value).toBe("已有草稿");
		fireEvent.click(
			within(view.container).getByRole("tab", { name: /身份·属性/ }),
		);
		expect(
			within(view.container).getAllByText(/已恢复草稿/).length,
		).toBeGreaterThan(0);
		fireEvent.click(
			within(view.container).getByRole("button", { name: "清空重填" }),
		);
		const confirm = await within(document.body).findByRole("button", {
			name: "确认清空",
		});
		expect(confirm).toBeTruthy();
		fireEvent.click(confirm);
		expect(
			(
				within(view.container).getByRole("textbox", {
					name: "姓名",
				}) as HTMLInputElement
			).value,
		).toBe("");
	});

	test("cancels soft-warning submission dialog without posting and serializes structured background when warnings are cleared", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		const sheet = createEmptyCharacterSheet();
		// Spend all 100 interest points (INT 50 -> 100) and set a key connection
		sheet.skills = { 侦查: 75, 图书馆: 70 };
		sheet.skillAllocation = {
			侦查: { occupation: 0, interest: 50, experience: 0 },
			图书馆: { occupation: 0, interest: 50, experience: 0 },
		};
		sheet.backgroundProfile.ideologyBeliefs = "真理高于一切";
		sheet.backgroundProfile.keyConnection = "ideologyBeliefs";
		localStorage.setItem(
			characterCreationDraftKey("pl-1", "independent"),
			JSON.stringify({
				version: 1,
				name: "卡尔·斯坦",
				background: "",
				ruleId: "coc7e",
				sheet,
			}),
		);
		const view = render(
			<Harness mode="independent" onDone={() => undefined} />,
		);
		// No warnings -> submits directly without confirmation dialog
		submitPage(view, "创建人物");
		expect(
			within(document.body).queryByRole("button", { name: "仍要提交" }),
		).toBeNull();
		await waitFor(() =>
			expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
				true,
			),
		);
		const call = harness.calls.find((entry) => entry.init.method === "POST");
		const payload = JSON.parse(String(call?.init.body)) as {
			background: string;
		};
		expect(payload.background).toContain(
			"【思想与信念 ★关键链接】真理高于一切",
		);
	});

	test("does not post if user cancels the soft-warning confirmation dialog", async () => {
		const harness = setup();
		cleanupHarness = harness.restore;
		seedDraft("independent", "未确认者");
		const view = render(
			<Harness mode="independent" onDone={() => undefined} />,
		);
		submitPage(view, "创建人物");
		const cancelBtn = await within(document.body).findByRole("button", {
			name: "取消",
		});
		fireEvent.click(cancelBtn);
		expect(harness.calls.some((call) => call.init.method === "POST")).toBe(
			false,
		);
	});
});

function setValue(element: HTMLElement, value: string) {
	const prototype =
		element.tagName === "TEXTAREA"
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	setter?.call(element, value);
	fireEvent.input(element);
}
