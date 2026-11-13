import { beforeEach, describe, expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { ChatMessageCard } from "../src/features/chat/chat-message-card";
import { GmChatPanel } from "../src/features/gm-console/gm-chat-panel";
import { GmToolProvider } from "../src/features/gm-console/gm-tool-context";
import { PlayerStagePreview } from "../src/features/gm-console/player-stage-preview";
import { DialogueBox } from "../src/features/session-stage/dialogue-box";
import { usePlayStore } from "../src/stores/play-store";
import { GmConsoleStage } from "../src/themes/default/slots/gm-console-stage";

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

	test("player stage preview is available from the GM top bar", async () => {
		const view = render(<PlayerStagePreview />);
		const button = view.getByRole("button", {
			name: "玩家视角预览",
		});
		expect(button).toBeTruthy();
	});
});
