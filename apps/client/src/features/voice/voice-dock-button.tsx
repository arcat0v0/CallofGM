import { Headphones, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { PanelHeading } from "@/components/shared/panel-heading";
import { ToolDockButton } from "@/components/shared/tool-dock";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { t, useI18nVersion } from "@/i18n";
import type { VoiceController } from "./voice-controller";
import { VoicePanelBody } from "./voice-panel";
import { VoiceSpeakerOverlay } from "./voice-speaker-overlay";

export function VoiceDockButton({
	voice,
	showLabel,
	wideOnlyLabel,
	compact = false,
	onOpen,
}: {
	voice: VoiceController;
	showLabel?: boolean;
	wideOnlyLabel?: boolean;
	compact?: boolean;
	onOpen?: () => void;
}) {
	useI18nVersion();
	const [open, setOpen] = useState(false);
	const snapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
	const { member } = snapshot;

	function handleOpenChange(next: boolean) {
		if (next) onOpen?.();
		setOpen(next);
	}

	const trigger = (
		<ToolDockButton
			icon={Headphones}
			label={t("voice.title")}
			active={open || member !== null}
			showLabel={showLabel}
			wideOnlyLabel={wideOnlyLabel}
		/>
	);

	return (
		<>
			{compact ? (
				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogTrigger asChild>{trigger}</DialogTrigger>
					<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
						<DialogHeader>
							<DialogTitle>{t("voice.title")}</DialogTitle>
							<DialogDescription>{t("voice.description")}</DialogDescription>
						</DialogHeader>
						<VoicePanelBody voice={voice} snapshot={snapshot} />
					</DialogContent>
				</Dialog>
			) : (
				<Popover open={open} onOpenChange={handleOpenChange}>
					<PopoverTrigger asChild>{trigger}</PopoverTrigger>
					<PopoverContent
						align="center"
						side="bottom"
						sideOffset={12}
						collisionPadding={12}
						className="stage-glass shadow-overlay flex max-h-[calc(100dvh-120px)] w-[min(820px,calc(100vw-24px))] flex-col gap-4 overflow-hidden rounded-xl p-5"
					>
						<header className="shrink-0">
							<PanelHeading
								title={t("voice.title")}
								description={t("voice.description")}
								actions={
									<Button
										type="button"
										variant="tertiary"
										size="icon-sm"
										className="bg-md-surface-container-highest size-10 shrink-0"
										aria-label={t("common.close")}
										onClick={() => setOpen(false)}
									>
										<X />
									</Button>
								}
							/>
						</header>
						<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
							<VoicePanelBody voice={voice} snapshot={snapshot} />
						</div>
					</PopoverContent>
				</Popover>
			)}
			<VoiceSpeakerOverlay
				voice={voice}
				panelOpen={open}
				placement="player"
				compact={compact}
			/>
		</>
	);
}
