import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { ChatEmptyState } from "../src/features/chat/chat-empty-state";
import { SceneAudioControl } from "../src/features/session-stage/scene-audio-control";
import { SceneBackdrop } from "../src/features/session-stage/scene-backdrop";
import { usePlayStore } from "../src/stores/play-store";
import { GmConsoleLayout } from "../src/themes/default/slots/gm-console-layout";
import { GmConsoleStage } from "../src/themes/default/slots/gm-console-stage";
import { PlayLayout } from "../src/themes/default/slots/play-layout";

beforeEach(() => {
	usePlayStore.getState().reset();
});

describe("mobile layout adaptations", () => {
	test("player landscape chat bounds empty-state overflow and uses responsive width", () => {
		const empty = render(
			<ChatEmptyState
				title="还没有人开口"
				description="主持人的场景描述与同伴的回应会出现在这里。"
			/>,
		);
		const emptyContainer = empty.getByText("还没有人开口").parentElement;
		expect(emptyContainer?.className).toContain("min-h-0");
		expect(emptyContainer?.className).toContain("overflow-y-auto");
		empty.unmount();

		const layout = render(
			<PlayLayout
				viewport="landscape"
				nodes={{
					stage: <div data-testid="stage" />,
					chat: <div data-testid="chat" />,
					dock: <div data-testid="dock" />,
					composer: <div data-testid="composer" />,
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
		const chatPanel = layout.getByTestId("chat").parentElement;
		expect(chatPanel?.className).toContain("w-[clamp(256px,38vw,320px)]");
		const root = layout.container.firstElementChild as HTMLElement | null;
		expect(root?.style.getPropertyValue("--play-chat-inset")).toContain(
			"clamp(256px, 38vw, 320px)",
		);
	});

	test("player portrait stage shrinks safely for soft keyboards", () => {
		const layout = render(
			<PlayLayout
				viewport="portrait"
				nodes={{
					stage: <div data-testid="stage" />,
					chat: <div data-testid="chat" />,
					dock: <div data-testid="dock" />,
					composer: <div data-testid="composer" />,
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
		const stageBox = layout.getByTestId("stage").parentElement;
		expect(stageBox?.className).toContain("h-[clamp(160px,40dvh,410px)]");
	});

	test("scene backdrop empty state accounts for chat inset without wide landscape audio starves", () => {
		const backdrop = render(<SceneBackdrop src={undefined} alt="" />);
		const surface = backdrop
			.getByText("暂无场景画面")
			.closest(".pointer-events-none.bg-transparent");
		expect(surface?.className).toContain("pr-[var(--play-chat-inset,0px)]");
		backdrop.unmount();

		const audio = render(<SceneAudioControl variant="landscape" />);
		expect(audio.queryByText("未播放")).toBeNull();
		expect(audio.getByRole("button", { name: "本地静音" })).toBeTruthy();
	});

	test("gm console mounts panes once and switches mobile views cleanly", () => {
		const layout = render(
			<GmConsoleLayout
				nodes={{
					topbar: <div data-testid="topbar" />,
					controls: <div data-testid="controls" />,
					stage: <div data-testid="stage" />,
					chat: <div data-testid="chat" />,
					dock: <div data-testid="dock" />,
					overlays: null,
					connection: null,
					endedBanner: null,
				}}
				view={{ sessionId: "s1", status: "active" }}
			/>,
		);

		expect(layout.getAllByTestId("controls")).toHaveLength(1);
		expect(layout.getAllByTestId("chat")).toHaveLength(1);
		expect(layout.getAllByTestId("stage")).toHaveLength(1);
		expect(layout.getAllByTestId("dock")).toHaveLength(1);

		const chatRadio = layout.getByRole("radio", { name: "对话" });
		const controlsRadio = layout.getByRole("radio", { name: "控场" });
		const stageRadio = layout.getByRole("radio", { name: "舞台" });

		expect(chatRadio.getAttribute("aria-checked")).toBe("true");
		expect(layout.getByTestId("controls").parentElement?.className).toContain(
			"max-lg:hidden",
		);
		expect(layout.getByTestId("chat").parentElement?.className).not.toContain(
			"max-lg:hidden",
		);

		fireEvent.click(controlsRadio);
		expect(controlsRadio.getAttribute("aria-checked")).toBe("true");
		expect(
			layout.getByTestId("controls").parentElement?.className,
		).not.toContain("max-lg:hidden");
		expect(layout.getByTestId("chat").parentElement?.className).toContain(
			"max-lg:hidden",
		);

		fireEvent.click(stageRadio);
		expect(stageRadio.getAttribute("aria-checked")).toBe("true");
		expect(layout.getByTestId("stage").parentElement?.className).not.toContain(
			"max-lg:hidden",
		);
	});

	test("gm console stage enables side insets only on desktop breakpoints", () => {
		const stage = render(
			<GmConsoleStage
				view={{
					sceneName: "密室",
					sceneBgUrl: null,
					status: "active",
					phase: "free_discussion",
					hasDialogue: false,
				}}
				nodes={{
					sceneInfo: null,
					portrait: null,
					dialogue: null,
					audio: null,
				}}
			/>,
		);
		const wrapper = stage.container.firstElementChild;
		expect(wrapper?.className).toContain("[--play-chat-inset:0px]");
		expect(wrapper?.className).toContain("lg:[--play-chat-inset:");
	});
});
