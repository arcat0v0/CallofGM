import type { LucideIcon } from "lucide-react";
import {
	Dices,
	Headphones,
	Image as ImageIcon,
	Music2,
	ScrollText,
	Users,
} from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ToolDock, ToolDockButton } from "@/components/shared/tool-dock";
import type { VoiceController } from "@/features/voice/voice-controller";
import { VoicePanelBody } from "@/features/voice/voice-panel";
import { VoiceSpeakerOverlay } from "@/features/voice/voice-speaker-overlay";
import { t } from "@/i18n";
import { usePlayStore } from "@/stores/play-store";
import { AudioPanel } from "./audio-panel";
import { CharactersPanel } from "./characters-panel";
import { CheckPanel } from "./check-panel";
import { GmPanelShell } from "./gm-panel-fields";
import { type GmTool, useGmTool } from "./gm-tool-context";
import { HandoutPanel } from "./handout-panel";
import { ScenePanel } from "./scene-panel";

const TOOLS: Array<{ id: GmTool; labelKey: string; icon: LucideIcon }> = [
	{ id: "scene", labelKey: "gm.workbench.toolScene", icon: ImageIcon },
	{ id: "characters", labelKey: "gm.workbench.toolCharacters", icon: Users },
	{ id: "handouts", labelKey: "gm.workbench.toolHandouts", icon: ScrollText },
	{ id: "check", labelKey: "gm.workbench.toolCheck", icon: Dices },
	{ id: "audio", labelKey: "gm.workbench.toolAudio", icon: Music2 },
	{ id: "voice", labelKey: "voice.title", icon: Headphones },
];

function GmToolDock({ voice }: { voice: VoiceController }) {
	const { activeTool, closeTool, toggleTool } = useGmTool();
	const ended = usePlayStore((state) => state.status === "ended");
	const voiceSnapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
	const voiceJoined = voiceSnapshot.member !== null;

	useEffect(() => {
		if (!activeTool) {
			return;
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && !event.defaultPrevented) {
				closeTool();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [activeTool, closeTool]);

	useEffect(() => {
		if (ended && activeTool) {
			closeTool();
		}
	}, [activeTool, closeTool, ended]);

	const panel =
		activeTool === "scene" ? (
			<ScenePanel onClose={closeTool} />
		) : activeTool === "characters" ? (
			<CharactersPanel onClose={closeTool} />
		) : activeTool === "handouts" ? (
			<HandoutPanel onClose={closeTool} />
		) : activeTool === "check" ? (
			<CheckPanel onClose={closeTool} />
		) : activeTool === "audio" ? (
			<AudioPanel onClose={closeTool} />
		) : activeTool === "voice" ? (
			<GmPanelShell
				title={t("voice.title")}
				subtitle={t("voice.description")}
				onClose={closeTool}
				className="w-[min(880px,calc(100vw-24px))] max-h-[calc(100dvh-176px)] xl:max-h-[calc(100dvh-112px)] [&>div]:[scrollbar-width:thin] [&>div]:[scrollbar-color:var(--color-scrollbar)_transparent]"
			>
				<VoicePanelBody voice={voice} snapshot={voiceSnapshot} />
			</GmPanelShell>
		) : null;

	return (
		<>
			{activeTool && typeof document !== "undefined"
				? createPortal(
						<div
							aria-hidden
							className="bg-md-scrim/25 animate-in fade-in fixed inset-0 z-[35] duration-200"
							onClick={closeTool}
						/>,
						document.body,
					)
				: null}
			<div className="relative z-30">
				<ToolDock
					label={t("gm.workbench.tools")}
					className="shadow-overlay p-1.5"
				>
					{TOOLS.map((tool) => {
						const active =
							activeTool === tool.id ||
							(tool.id === "voice" && voiceJoined);
						const label = t(tool.labelKey);
						return (
							<ToolDockButton
								key={tool.id}
								icon={tool.icon}
								label={label}
								active={active}
								disabled={ended}
								wideOnlyLabel
								onClick={() => toggleTool(tool.id)}
							/>
						);
					})}
				</ToolDock>
				{panel ? (
					<div className="absolute top-[calc(100%_+_12px)] left-1/2 z-30 -translate-x-1/2">
						{panel}
					</div>
				) : null}
			</div>
			<VoiceSpeakerOverlay
				voice={voice}
				panelOpen={activeTool === "voice"}
				placement="gm"
			/>
		</>
	);
}

export { GmToolDock };
