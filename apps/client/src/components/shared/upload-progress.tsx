import { Progress } from "@/components/ui/progress";
import { t } from "@/i18n";
import type { UploadProgress } from "@/lib/api";
import { formatByteSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 上传进度指示条：展示传输百分比、字节进度与服务端处理态。 */
export function UploadProgressBar({
	progress,
	label,
	compact = false,
	className,
}: {
	progress: UploadProgress | null | undefined;
	label?: string;
	compact?: boolean;
	className?: string;
}) {
	const processing = progress?.phase === "processing";
	const percent =
		progress && progress.percent !== null
			? Math.max(0, Math.min(100, progress.percent))
			: null;
	const statusLabel =
		label ?? (processing ? t("upload.processing") : t("upload.uploading"));
	const detail =
		progress && progress.total > 0 && percent !== null
			? compact
				? `${percent}%`
				: `${formatByteSize(progress.loaded)} / ${formatByteSize(progress.total)} · ${percent}%`
			: progress && progress.loaded > 0
				? formatByteSize(progress.loaded)
				: percent !== null
					? `${percent}%`
					: null;

	return (
		<div
			role="status"
			aria-live="polite"
			data-slot="upload-progress"
			className={cn(
				"flex flex-col gap-1.5",
				!compact && "bg-md-surface-container-low rounded-lg px-3.5 py-2.5",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-2 text-label-small">
				<span className="text-md-on-surface truncate">{statusLabel}</span>
				{detail ? (
					<span className="text-md-on-surface-variant shrink-0 font-mono tabular-nums">
						{detail}
					</span>
				) : null}
			</div>
			<Progress value={percent ?? undefined} aria-label={statusLabel} />
		</div>
	);
}
