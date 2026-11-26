import { beforeEach, describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import {
	act,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { ChatMessageCard } from "../src/features/chat/chat-message-card";
import type { ChatMessage } from "../src/features/chat/types";
import { GmChatPanel } from "../src/features/gm-console/gm-chat-panel";
import { GmToolProvider } from "../src/features/gm-console/gm-tool-context";
import { StageStudio } from "../src/features/gm-console/stage-studio";
import { DialogueBox } from "../src/features/session-stage/dialogue-box";
import { PortraitLayer } from "../src/features/session-stage/portrait-layer";
import { latestStageDialogue } from "../src/features/session-stage/stage-dialogue";
import { usePlayStore } from "../src/stores/play-store";
import { defaultTheme } from "../src/themes/default";
import { GmConsoleStage } from "../src/themes/default/slots/gm-console-stage";
import { registerDefaultTheme } from "../src/themes/runtime/registry";

function sampleCharacter(
	characterId: string,
	name: string,
	kind: "pc" | "npc",
): SnapshotCharacter {
	return {
		characterId,
		name,
		kind,
		ruleId: "coc7e",
		currentExpressionKey: null,
		state: null,
		portraits: [
			{
				expressionKey: "default",
				portraitAssetId: `asset-${characterId}`,
				isDefault: true,
				label: "默认",
				sortOrder: 0,
			},
		],
		claim: null,
		sheet: null,
	};
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		status: "active",
		phase: "performance_time",
		scene: { id: "s1", name: "弗兰克餐馆 · 街景", bgAssetId: null },
		messages: [],
	});
});

describe("GM stage and speaker labels", () => {
	test("GM identity is labelled as 主持人 rather than 旁白", () => {
		const view = render(
			<GmToolProvider>
				<GmChatPanel />
			</GmToolProvider>,
		);
		expect(view.getByText("主持人")).toBeTruthy();
		expect(view.queryByText("旁白")).toBeNull();
	});

	test("chat card shows the expression badge next to the speaker", () => {
		const view = render(
			<ChatMessageCard
				message={{
					id: "card-1",
					sortKey: 1,
					speakerName: "礼帽男子",
					speakerRoleLabel: "NPC",
					expressionLabel: "tip_hat_smile",
					avatarInitials: "礼",
					avatarBg: "bg-default",
					avatarFg: "text-foreground",
					time: "16:04",
					body: "你好",
					tone: "ic",
				}}
			/>,
		);
		expect(view.getByText("tip_hat_smile")).toBeTruthy();
	});

	test("stage dialogue displays the expression beside the speaker label", () => {
		const view = render(
			<DialogueBox
				speaker="礼帽男子"
				roleLabel="NPC"
				expressionLabel="tip_hat_smile"
				text="你好"
			/>,
		);
		expect(view.getByText("tip_hat_smile")).toBeTruthy();
	});

	test("portraitless characters speak without creating a live stage placeholder", () => {
		usePlayStore.setState({
			characters: [
				{ ...sampleCharacter("yumi", "由美", "pc"), portraits: [] },
				sampleCharacter("mirror", "御剑镜", "pc"),
			],
		});
		const view = render(
			<>
				<PortraitLayer />
				<DialogueBox speaker="由美" text="等一下。" />
			</>,
		);
		expect(
			view.container.querySelector('[data-stage-character="yumi"]'),
		).toBeNull();
		expect(view.getByRole("img", { name: "御剑镜" })).toBeTruthy();
		expect(view.getByText("由美")).toBeTruthy();
		expect(view.getByText("等一下。")).toBeTruthy();
	});

	test("stage editing retains the position of a portraitless character", () => {
		usePlayStore.setState({
			characters: [{ ...sampleCharacter("yumi", "由美", "pc"), portraits: [] }],
		});
		const selected: string[] = [];
		const view = render(
			<PortraitLayer
				interactive={{
					selectedId: null,
					draggingId: null,
					onSelect: (id) => selected.push(id),
					onPointerDownMove: () => undefined,
					onPointerDownScale: () => undefined,
				}}
			/>,
		);
		fireEvent.pointerDown(view.getByText("由美"));
		expect(selected).toEqual(["yumi"]);
		expect(view.queryByRole("img")).toBeNull();
	});

	test("stage dialogue and speaker focus use only presented roleplay messages", () => {
		const presented: ChatMessage = {
			id: "presented",
			sortKey: 1,
			speakerName: "由美",
			speakerRoleLabel: "PC",
			avatarInitials: "由",
			avatarBg: "",
			avatarFg: "",
			time: "20:00",
			body: "等一下。",
			tone: "ic",
		};
		const excluded: ChatMessage[] = [
			{ ...presented, id: "pending", pending: true },
			{ ...presented, id: "rejected", rejected: true },
			{ ...presented, id: "ooc", tone: "ooc" },
		];
		expect(latestStageDialogue(excluded)).toBeUndefined();
		expect(latestStageDialogue([presented, ...excluded])).toBe(presented);
	});

	test("long stage dialogue scrolls in place and resets for a new line", () => {
		const first = "旧日发言\n".repeat(40);
		const view = render(<DialogueBox speaker="主持人" text={first} />);
		const body = view.container.querySelector("p");
		expect(body?.textContent).toBe(first);
		expect(body?.classList.contains("overflow-y-auto")).toBe(true);

		if (body) {
			body.scrollTop = 120;
		}
		view.rerender(<DialogueBox speaker="主持人" text="新发言" />);
		expect(body?.scrollTop).toBe(0);
	});

	test("delegated GM stage shows the empty state for a selected scene with no background", () => {
		const view = render(
			<GmConsoleStage
				view={{
					sceneName: "弗兰克餐馆 · 街景",
					sceneBgUrl: null,
					status: "active",
					phase: "performance_time",
					hasDialogue: false,
				}}
				nodes={{
					sceneInfo: null,
					portrait: <div data-testid="portrait">立绘</div>,
					dialogue: null,
					audio: null,
				}}
			/>,
		);
		const title = view.getByText("暂无场景画面");
		expect(
			view.getByText("选择场景或背景后，画面会显示在这里。"),
		).not.toBeNull();
		const surface = title.closest(".pointer-events-none.bg-transparent");
		expect(surface?.className).toContain("rounded-none");
		expect(
			view.container.querySelector("svg.lucide-clapperboard"),
		).not.toBeNull();
		expect(view.getByTestId("portrait")).not.toBeNull();
		expect(view.container.querySelector("img")).toBeNull();
	});

	test("delegated GM stage crossfades backgrounds and restores empty state on deselection", async () => {
		const nodes = {
			sceneInfo: null,
			portrait: null,
			dialogue: null,
			audio: null,
		};
		const view = render(
			<GmConsoleStage
				view={{
					sceneName: "弗兰克餐馆 · 街景",
					sceneBgUrl: "/media/first.png",
					status: "active",
					phase: "performance_time",
					hasDialogue: false,
				}}
				nodes={nodes}
			/>,
		);
		expect(
			view.container.querySelector('img[src="/media/first.png"]'),
		).not.toBeNull();

		view.rerender(
			<GmConsoleStage
				view={{
					sceneName: "夜色街道",
					sceneBgUrl: "/media/second.png",
					status: "active",
					phase: "performance_time",
					hasDialogue: false,
				}}
				nodes={nodes}
			/>,
		);
		await waitFor(() => {
			expect(
				view.container.querySelector('img[src="/media/first.png"]'),
			).not.toBeNull();
			const front = view.container.querySelector(
				'img[src="/media/second.png"]',
			);
			expect(front?.className).toContain("opacity-100");
		});

		view.rerender(
			<GmConsoleStage
				view={{
					sceneName: "夜色街道",
					sceneBgUrl: null,
					status: "active",
					phase: "performance_time",
					hasDialogue: false,
				}}
				nodes={nodes}
			/>,
		);
		await waitFor(() => {
			expect(view.getByText("暂无场景画面")).not.toBeNull();
			expect(view.container.querySelector("img")).toBeNull();
		});
	});

	test("GM stage reuses the player desktop stage layout", () => {
		const view = render(
			<GmConsoleStage
				view={{
					sceneName: "弗兰克餐馆 · 街景",
					sceneBgUrl: null,
					status: "active",
					phase: "performance_time",
					hasDialogue: false,
				}}
				nodes={{
					sceneInfo: null,
					portrait: <div data-testid="portrait">立绘</div>,
					dialogue: null,
					audio: <div data-testid="audio">音频</div>,
				}}
			/>,
		);
		expect(view.getByTestId("portrait")).toBeTruthy();
		expect(view.queryByTestId("audio")).toBeNull();
	});

	test("unified stage studio trigger is available from the GM top bar", async () => {
		const view = render(<StageStudio />);
		const button = view.getByRole("button", {
			name: "舞台编排与玩家视角预览",
		});
		expect(button).toBeTruthy();
	});

	test("an expression-only stage edit can be published and follows the server after confirmation", async () => {
		const character = sampleCharacter("pc-1", "林婉", "pc");
		character.currentExpressionKey = "default";
		character.portraits.push({
			expressionKey: "c01-01",
			portraitAssetId: "asset-afraid",
			isDefault: false,
			label: "恐惧瑟缩",
			sortOrder: 1,
		});
		usePlayStore.setState({ sessionId: "sess-1", characters: [character] });
		const view = render(<StageStudio />);
		fireEvent.click(
			view.getByRole("button", { name: "舞台编排与玩家视角预览" }),
		);
		expect(
			(view.getByRole("button", { name: "同步放映" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		act(() =>
			usePlayStore.getState().setStageExpressionDraft({ "pc-1": "c01-01" }),
		);
		expect(
			(view.getByRole("button", { name: "同步放映" }) as HTMLButtonElement)
				.disabled,
		).toBe(false);
		expect(usePlayStore.getState().characters[0]?.currentExpressionKey).toBe(
			"default",
		);
		const expressions = [{ characterId: "pc-1", expressionKey: "c01-01" }];
		act(() =>
			usePlayStore.getState().applyMessage({
				protocolVersion: 1,
				eventId: 1,
				occurredAt: 1,
				type: "stage:layout-changed",
				payload: { layout: "auto", scale: "md", expressions },
			}),
		);
		expect(usePlayStore.getState().characters[0]?.currentExpressionKey).toBe(
			"c01-01",
		);
		expect(usePlayStore.getState().stageExpressionDraft).toEqual({});
		expect(
			(view.getByRole("button", { name: "同步放映" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	test("stage studio previews draft edits locally without altering live composition until published", async () => {
		usePlayStore.setState({
			sessionId: "sess-1",
			status: "waiting",
			characters: [
				sampleCharacter("pc-1", "林婉", "pc"),
				sampleCharacter("npc-1", "神秘侦探", "npc"),
			],
		});

		const view = render(<StageStudio />);
		fireEvent.click(
			view.getByRole("button", { name: "舞台编排与玩家视角预览" }),
		);

		await waitFor(() => {
			expect(view.getByText("与线上一致")).toBeTruthy();
		});

		// Put NPC onto stage in draft
		const putOnButtons = view.getAllByRole("button", { name: "上台" });
		fireEvent.click(putOnButtons[0]!);

		await waitFor(() => {
			expect(view.getByText("有未放映改动")).toBeTruthy();
		});
		// Live composition must remain untouched before clicking 同步放映
		expect(usePlayStore.getState().stageComposition).toBeNull();
		expect(usePlayStore.getState().stageDraft?.items).toHaveLength(2);

		// Close and reopen: draft is preserved
		fireEvent.click(view.getByRole("button", { name: "关闭" }));
		await waitFor(() => {
			expect(view.queryByText("有未放映改动")).toBeNull();
		});
		expect(usePlayStore.getState().stageDraft?.items).toHaveLength(2);

		fireEvent.click(
			view.getByRole("button", { name: "舞台编排与玩家视角预览" }),
		);
		await waitFor(() => {
			expect(view.getByText("有未放映改动")).toBeTruthy();
		});

		// Discard draft restores synced status
		fireEvent.click(view.getByRole("button", { name: "还原线上" }));
		await waitFor(() => {
			expect(view.getByText("与线上一致")).toBeTruthy();
		});
		expect(usePlayStore.getState().stageDraft).toBeNull();
	});

	test("stage studio opens read-only pure preview when session has ended", async () => {
		usePlayStore.setState({
			sessionId: "sess-ended",
			status: "ended",
			characters: [sampleCharacter("pc-1", "林婉", "pc")],
		});
		const view = render(<StageStudio />);
		fireEvent.click(
			view.getByRole("button", { name: "舞台编排与玩家视角预览" }),
		);
		await waitFor(() => {
			expect(view.getByText("已结团 · 只读")).toBeTruthy();
		});
		expect(view.queryByRole("button", { name: "同步放映" })).toBeNull();
	});

	test("stage studio opens in the GM presentation and can still switch to the player layout", () => {
		registerDefaultTheme(defaultTheme);
		usePlayStore.setState({
			characters: [sampleCharacter("pc-1", "林婉", "pc")],
		});
		const view = render(<StageStudio />);
		fireEvent.click(
			view.getByRole("button", { name: "舞台编排与玩家视角预览" }),
		);
		const dialog = view.getByRole("dialog");
		const studio = within(dialog);
		expect(
			studio
				.getByRole("radio", { name: "主持人视角" })
				.getAttribute("aria-checked"),
		).toBe("true");
		const portrait = dialog.querySelector('[data-stage-character="pc-1"]');
		expect(portrait?.querySelector("img")?.alt).toBe("林婉");
		expect(portrait?.textContent).toBe("");
		expect(studio.queryByText("玩家聊天栏区域")).toBeNull();

		fireEvent.click(studio.getByRole("button", { name: "名牌状态" }));
		expect(portrait?.querySelector(".absolute.top-full")?.textContent).toBe(
			"林婉",
		);

		fireEvent.click(studio.getByRole("radio", { name: "桌面（含聊天）" }));
		expect(studio.getByText("玩家聊天栏区域")).toBeTruthy();
	});

	test("PortraitLayer renders custom coordinates, flips image only, and preserves manual z-order during speaker focus", () => {
		usePlayStore.setState({
			characters: [
				sampleCharacter("pc-1", "林婉", "pc"),
				sampleCharacter("npc-1", "礼帽男子", "npc"),
			],
			messages: [
				{
					id: "m1",
					sortKey: 1,
					speakerName: "林婉",
					speakerRoleLabel: "PC",
					avatarInitials: "林",
					avatarBg: "",
					avatarFg: "",
					time: "20:00",
					body: "你好",
					tone: "ic",
				},
			],
			stageComposition: {
				mode: "custom",
				emphasizeSpeaker: true,
				items: [
					{
						characterId: "pc-1",
						x: 25,
						y: 10,
						scale: 1.2,
						flipX: false,
						zIndex: 10,
					},
					{
						characterId: "npc-1",
						x: 75,
						y: -5,
						scale: 0.9,
						flipX: true,
						zIndex: 20,
					},
				],
			},
		});

		const view = render(<PortraitLayer audience="player" showNameplate />);
		const pcSlot = view.container.querySelector<HTMLElement>(
			'[data-stage-character="pc-1"]',
		);
		const npcSlot = view.container.querySelector<HTMLElement>(
			'[data-stage-character="npc-1"]',
		);
		expect(pcSlot?.style.left).toBe("25%");
		expect(pcSlot?.style.bottom).toBe("10%");
		// Speaking pc-1 must NOT override npc-1's higher manual zIndex
		expect(pcSlot?.style.zIndex).toBe("10");
		expect(npcSlot?.style.zIndex).toBe("20");
		// Non-speaker is dimmed when emphasizeSpeaker=true
		expect(npcSlot?.className).toContain("opacity-55");
		// Flip applies to the portrait <img>, NOT the whole slot containing nameplate text
		const npcImg = npcSlot?.querySelector("img");
		expect(npcImg?.className).toContain("-scale-x-100");
		expect(npcSlot?.className).not.toContain("-scale-x-100");
	});
});
