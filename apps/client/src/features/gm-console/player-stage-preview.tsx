import { MonitorPlay, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { usePlayStore } from "@/stores/play-store";
import { type LoadedTheme, loadTheme } from "@/themes/runtime/loader";
import { ThemeContext } from "@/themes/runtime/theme-context";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

function PlayerStagePreview() {
	const status = usePlayStore((state) => state.status);
	const phase = usePlayStore((state) => state.phase);
	const scene = usePlayStore((state) => state.scene);
	const messages = usePlayStore((state) => state.messages);
	const themeId = usePlayStore((state) => state.themeId);
	const [open, setOpen] = useState(false);
	const [playerTheme, setPlayerTheme] = useState<LoadedTheme | null>(null);
	const previewThemeId =
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).get("theme") === "default"
			? null
			: themeId;

	useEffect(() => {
		if (!open || !previewThemeId) {
			setPlayerTheme(null);
			return;
		}
		let cancelled = false;
		void loadTheme(previewThemeId)
			.then((loadedTheme) => {
				if (!cancelled) {
					setPlayerTheme(loadedTheme);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setPlayerTheme(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open, previewThemeId]);

	const latest = [...messages]
		.reverse()
		.find((message) => message.tone !== "ooc");
	const dialogue = latest ? (
		<DialogueBox
			speaker={latest.speakerName}
			roleLabel={latest.speakerRoleLabel || undefined}
			expressionLabel={latest.expressionLabel}
			text={latest.body}
			size="md"
		/>
	) : null;

	const stage = (
		<ThemeSlot
			key={previewThemeId ?? "default"}
			name="play.stage"
			ctx={{
				viewport: "desktop",
				view: {
					sceneName: scene?.name ?? t("play.currentScene"),
					sceneBgUrl: mediaUrl(scene?.bgAssetId),
					status,
					phase,
					hasDialogue: Boolean(latest),
				},
				nodes: {
					sceneInfo: (
						<ThemeSlot name="play.scene-info" ctx={{ variant: "desktop" }} />
					),
					portrait: <PortraitLayer audience="player" />,
					dialogue,
					audio: <SceneAudioControl variant="desktop" />,
				},
			}}
		/>
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="tertiary"
					size="icon-sm"
					aria-label={t("gm.workbench.playerStagePreview")}
					className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-10"
				>
					<MonitorPlay />
				</Button>
			</DialogTrigger>
			<DialogContent
				showCloseButton={false}
				className="bg-background h-[min(86dvh,900px)] w-[min(96vw,1600px)] max-w-none gap-0 overflow-hidden rounded-2xl p-0"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{t("gm.workbench.playerStagePreview")}</DialogTitle>
					<DialogDescription>
						{t("gm.workbench.playerStagePreviewHint")}
					</DialogDescription>
				</DialogHeader>
				<div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-linear-to-b from-md-surface-container-lowest/90 to-transparent px-4 py-3">
					<span className="text-md-on-surface text-label-large-emph">
						{t("gm.workbench.playerStagePreview")}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("common.close")}
						onClick={() => setOpen(false)}
					>
						<X />
					</Button>
				</div>
				<ThemeContext.Provider
					value={{ theme: playerTheme, error: null, loading: false }}
				>
					<div className="relative h-full w-full">{stage}</div>
				</ThemeContext.Provider>
			</DialogContent>
		</Dialog>
	);
}

export { PlayerStagePreview };
