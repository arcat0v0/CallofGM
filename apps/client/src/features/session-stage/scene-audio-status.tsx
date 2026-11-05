import { Music2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LocalVolumeControl } from "@/features/session-stage/local-volume-control";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function SceneAudioStatus({
	trackName,
	volume = 64,
	showProgress = true,
	compact = false,
	muted = false,
	onMuteToggle,
	localVolume,
	onLocalVolumeChange,
	className,
}: {
	trackName: string;
	volume?: number;
	showProgress?: boolean;
	compact?: boolean;
	muted?: boolean;
	onMuteToggle?: () => void;
	localVolume?: number;
	onLocalVolumeChange?: (value: number) => void;
	className?: string;
}) {
	const showLocalVolume =
		localVolume !== undefined && onLocalVolumeChange !== undefined;
	return (
		<div
			className={cn(
				"stage-glass flex items-center rounded-full",
				compact
					? "h-10 max-w-[min(288px,52%)] min-w-0 gap-2 px-2.5"
					: showLocalVolume
						? "h-12 w-[320px] gap-2.5 px-3.5"
						: "h-10 w-[306px] gap-2.5 px-3.5",
				className,
			)}
		>
			<Music2
				className={cn(
					"shrink-0 text-accent-hover",
					compact ? "size-3.5" : "size-[15px]",
				)}
			/>
			<span
				className={cn(
					"text-foreground min-w-0 flex-1 truncate font-sans",
					compact ? "text-label-small" : "text-label-medium",
				)}
			>
				{trackName}
			</span>
			{showProgress && !compact && !showLocalVolume ? (
				<Progress
					value={muted ? 0 : volume}
					className="w-16 bg-foreground/15"
					aria-label={t("stage.volume", { value: volume })}
				/>
			) : null}
			{showLocalVolume ? (
				<LocalVolumeControl
					value={localVolume}
					onChange={onLocalVolumeChange}
					compact={compact}
				/>
			) : null}
			{onMuteToggle ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={muted ? t("stage.unmute") : t("stage.mute")}
					className={cn(
						"text-foreground-secondary",
						compact ? "size-6" : "size-7",
					)}
					onClick={onMuteToggle}
				>
					{muted ? (
						<VolumeX className="size-[15px]" />
					) : (
						<Volume2 className="size-[15px]" />
					)}
				</Button>
			) : null}
		</div>
	);
}

export { SceneAudioStatus };
