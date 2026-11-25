import { Slider } from "@/components/ui/slider";
import { t } from "@/i18n";
import { normalizeLocalVolume } from "@/lib/local-volume";
import { cn } from "@/lib/utils";

function LocalVolumeControl({
	value,
	onChange,
	compact = false,
	className,
}: {
	value: number;
	onChange: (value: number) => void;
	compact?: boolean;
	className?: string;
}) {
	return (
		<div className={cn("flex shrink-0 items-center gap-1.5", className)}>
			<Slider
				size="sm"
				value={[value]}
				min={0}
				max={100}
				step={1}
				thumbLabels={[t("stage.localVolume")]}
				className={cn(
					compact ? "w-14 min-h-6!" : "w-16 min-h-7!",
					"[&_[data-slot=slider-track]]:h-1.5! [&_[data-slot=slider-thumb]]:h-4! [&_[data-slot=slider-thumb]]:w-1! [&_[data-slot=slider-thumb]]:shadow-none!",
				)}
				onValueChange={(next) =>
					onChange(normalizeLocalVolume(next[0] ?? value))
				}
			/>
			<span
				className={cn(
					"text-foreground-secondary shrink-0 text-right text-label-small tabular-nums",
					compact ? "w-7" : "w-8",
				)}
			>
				{value}%
			</span>
		</div>
	);
}

export { LocalVolumeControl };
