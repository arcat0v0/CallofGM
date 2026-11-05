import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { gmFloatingCard } from "../src/features/gm-console/gm-styles";
import { PlayerActionDock } from "../src/features/play/player-action-dock";
import { DialogueBox } from "../src/features/session-stage/dialogue-box";
import { SceneAudioStatus } from "../src/features/session-stage/scene-audio-status";
import { usePlayStore } from "../src/stores/play-store";
import { PlayLayout } from "../src/themes/default/slots/play-layout";
import { PlayStage } from "../src/themes/default/slots/play-stage";

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
