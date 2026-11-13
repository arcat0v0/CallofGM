import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { gmFloatingCard } from "../src/features/gm-console/gm-styles";
import { PlayerActionDock } from "../src/features/play/player-action-dock";
import { DialogueBox } from "../src/features/session-stage/dialogue-box";
import { SceneAudioStatus } from "../src/features/session-stage/scene-audio-status";
import { usePlayStore } from "../src/stores/play-store";
import { PlayLayout } from "../src/themes/default/slots/play-layout";
import { PlayStage } from "../src/themes/default/slots/play-stage";

type StageView = Parameters<typeof PlayStage>[0]["view"];

const emptyView = {
	sceneName: "林中小屋",
	sceneBgUrl: null,
	status: "active",
	phase: "free_discussion",
	hasDialogue: false,
} satisfies StageView;

const stageNodes = {
	sceneInfo: <div data-testid="scene-info">林中小屋</div>,
	portrait: null,
	dialogue: null,
	audio: null,
};

function expectEmptyScene(view: ReturnType<typeof render>) {
	const title = view.getByText("暂无场景画面");
	const description = view.getByText("选择场景或背景后，画面会显示在这里。");
	const surface = title.closest(".pointer-events-none.bg-transparent");
	expect(surface?.className).toContain("rounded-none");
	expect(
		view.container.querySelector("svg.lucide-clapperboard"),
	).not.toBeNull();
	expect(description).not.toBeNull();
	expect(view.container.querySelector("img")).toBeNull();
}

function expectStageGlass(element: Element | null) {
	expect(element).not.toBeNull();
	expect(element?.classList.contains("stage-glass")).toBe(true);
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		phase: "free_discussion",
		status: "active",
		viewer: {
			isGm: false,
			seatRole: "pc",
			holderKind: "anonymous",
			holderId: "p1",
		},
	});
});

describe("stage glass surfaces", () => {
	test("scene information and audio use the shared material", () => {
		const view = {
			sceneName: "林中小屋",
			sceneBgUrl: null,
			status: "active",
			phase: "free_discussion",
			hasDialogue: false,
		} as const;
		const nodes = {
			sceneInfo: <div data-testid="scene-info">林中小屋</div>,
			portrait: null,
			dialogue: null,
			audio: null,
		};
		for (const viewport of ["desktop", "landscape", "portrait"] as const) {
			const stage = render(
				<PlayStage viewport={viewport} view={view} nodes={nodes} />,
			);
			expectStageGlass(stage.getByTestId("scene-info").parentElement);
			stage.unmount();
		}

		const audio = render(<SceneAudioStatus trackName="未播放" />);
		expectStageGlass(audio.getByText("未播放").parentElement);
	});

	test("dialogue and chat use the shared material", () => {
		const dialogue = render(<DialogueBox speaker="礼帽男子" text="测试" />);
		expectStageGlass(dialogue.getByText("测试").parentElement);
		dialogue.unmount();

		const layout = render(
			<PlayLayout
				viewport="desktop"
				nodes={{
					stage: null,
					chat: <div data-testid="chat">桌边对话</div>,
					composer: null,
					overlays: null,
					connection: null,
				}}
				view={{
					sessionId: "s1",
					status: "active",
					phase: "free_discussion",
					landscapeChatOpen: true,
					chatOpen: true,
				}}
				actions={{ setLandscapeChatOpen: () => undefined }}
			/>,
		);
		expectStageGlass(layout.getByTestId("chat").parentElement);
	});

	test("empty player stages reuse the transparent, non-interactive empty state", () => {
		for (const viewport of ["desktop", "landscape", "portrait"] as const) {
			const stage = render(
				<PlayStage viewport={viewport} view={emptyView} nodes={stageNodes} />,
			);
			expectEmptyScene(stage);
			expectStageGlass(stage.getByTestId("scene-info").parentElement);
			stage.unmount();
		}
	});

	test("a selected scene with no background still shows the empty state", () => {
		usePlayStore.setState({
			scene: { id: "scene-1", name: "林中小屋", bgAssetId: null },
		});
		const stage = render(
			<PlayStage
				viewport="desktop"
				view={{ ...emptyView, sceneName: "林中小屋" }}
				nodes={stageNodes}
			/>,
		);
		expectEmptyScene(stage);
	});

	test("image appears on selection and the empty state returns on deselection", async () => {
		const stage = render(
			<PlayStage viewport="desktop" view={emptyView} nodes={stageNodes} />,
		);
		expectEmptyScene(stage);

		stage.rerender(
			<PlayStage
				viewport="desktop"
				view={{ ...emptyView, sceneBgUrl: "/media/scene-1.png" }}
				nodes={stageNodes}
			/>,
		);
		await waitFor(() => {
			expect(
				stage.container.querySelector('img[src="/media/scene-1.png"]'),
			).not.toBeNull();
			expect(stage.queryByText("暂无场景画面")).toBeNull();
		});

		stage.rerender(
			<PlayStage viewport="desktop" view={emptyView} nodes={stageNodes} />,
		);
		await waitFor(() => expectEmptyScene(stage));
	});

	test("tool dock, player popover, and GM floating cards use the shared material", async () => {
		const dock = render(<PlayerActionDock variant="desktop" />);
		expectStageGlass(dock.getByRole("toolbar"));
		fireEvent.click(dock.getByRole("button", { name: "界面显示" }));
		await waitFor(() => {
			expectStageGlass(document.querySelector('[data-slot="popover-content"]'));
		});
		expect(gmFloatingCard.split(" ")).toContain("stage-glass");
	});
});
