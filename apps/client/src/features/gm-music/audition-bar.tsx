import { Pause, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import type { LibraryTrack } from "./music-library-model";

/** 试听条：贴边通栏。列与台账对齐——暂停键对着播放列，总时长对着时长列。 */
export function AuditionBar({
	track,
	positionMs,
	volume,
	onStop,
	onSeek,
	onVolume,
}: {
	track: LibraryTrack;
	positionMs: number;
	volume: number;
	onStop: () => void;
	onSeek: (ratio: number) => void;
	onVolume: (volume: number) => void;
}) {
	const ratio = Math.min(1, positionMs / Math.max(1, track.duration));
	const elapsed = formatDurationMmSs(positionMs);
	const total = formatDurationMmSs(track.duration);
	const kind = t(
		track.type === "bgm" ? "gm.music.dockLoop" : "gm.music.dockOnce",
	);

	return (
		<section
			aria-label={t("gm.music.dockAria")}
			className="relative grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-x-3 overflow-clip rounded-xl bg-md-surface-container-high px-4 py-2.5 md:h-16 md:grid-cols-[1.75rem_2rem_13rem_minmax(0,1fr)_7rem_2.5rem] md:px-6 md:py-0"
		>
			<div aria-hidden className="absolute inset-x-0 top-0 h-0.5 md:hidden">
				<div
					className="h-full bg-accent"
					style={{ width: `${ratio * 100}%` }}
				/>
			</div>
			<span className="hidden text-label-medium text-md-on-surface-variant md:block">
				{track.type === "bgm"
					? t("gm.music.sectionBgm")
					: t("gm.music.sectionSe")}
			</span>
			<Button
				type="button"
				variant="primary"
				size="icon-sm"
				aria-label={t("gm.music.previewStopAria", { name: track.name })}
				onClick={onStop}
				className="size-9 justify-self-center md:size-8 [&_svg]:size-4"
			>
				<Pause fill="currentColor" />
			</Button>
			<div className="flex min-w-0 flex-col">
				<span className="truncate text-body-large-emph text-md-on-surface">
					{track.name}
				</span>
				<span className="truncate text-label-small text-md-on-surface-variant">
					<span className="hidden md:inline">{kind}</span>
					<span className="tabular-nums md:hidden">
						{track.type === "bgm"
							? t("gm.music.sectionBgm")
							: t("gm.music.sectionSe")}{" "}
						· {elapsed} / {total}
					</span>
				</span>
			</div>
			<div className="hidden min-w-0 items-center gap-3 md:flex">
				<span className="text-label-medium tabular-nums text-md-on-surface-variant">
					{elapsed}
				</span>
				<Slider
					size="sm"
					min={0}
					max={1000}
					value={[Math.round(ratio * 1000)]}
					onValueChange={([value]) => onSeek((value ?? 0) / 1000)}
					aria-label={t("gm.music.dockSeekAria")}
					className="min-w-24 flex-1"
				/>
				<span className="text-label-medium tabular-nums text-md-on-surface-variant">
					{total}
				</span>
			</div>
			<div className="hidden items-center gap-2 md:flex">
				<Volume2
					aria-hidden
					className="size-4 shrink-0 text-md-on-surface-variant"
				/>
				<Slider
					size="sm"
					min={0}
					max={100}
					value={[Math.round(volume * 100)]}
					onValueChange={([value]) => onVolume((value ?? 0) / 100)}
					aria-label={t("gm.music.dockVolumeAria")}
					className="flex-1"
				/>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label={t("gm.music.dockStop")}
				onClick={onStop}
				className="size-9 justify-self-end md:size-10"
			>
				<X />
			</Button>
		</section>
	);
}
