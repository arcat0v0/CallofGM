import type { TrackDto } from "@cogm/shared";
import { Check, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MusicSourcePanel } from "@/features/gm-console/music-source-panel";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type UploadItem, useUploadQueue } from "./use-upload-queue";

export type AddTracksTab = "upload" | "platform";

function UploadRow({
	item,
	disabled,
	onRename,
	onRetype,
	onRemove,
}: {
	item: UploadItem;
	disabled: boolean;
	onRename: (name: string) => void;
	onRetype: (type: TrackDto["type"]) => void;
	onRemove: () => void;
}) {
	const locked = disabled || item.status === "uploading" || item.status === "done";
	return (
		<li className="flex flex-col gap-1 border-b border-md-outline-variant/30 py-2 last:border-b-0">
			<div className="flex items-center gap-2">
				<Input
					value={item.name}
					disabled={locked}
					aria-label={t("gm.music.uploadNameAria")}
					onInput={(event) => onRename(event.currentTarget.value)}
					className="h-9 min-w-0 flex-1"
				/>
				<SegmentedControl
					value={item.type}
					aria-label={t("gm.music.uploadTypeAria", { name: item.name })}
					onValueChange={onRetype}
					className="shrink-0"
					itemClassName="h-7 px-3"
					options={[
						{ value: "bgm", label: t("gm.music.bgm"), disabled: locked },
						{ value: "se", label: t("gm.music.se"), disabled: locked },
					]}
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("gm.music.uploadRemoveAria", { name: item.name })}
					disabled={item.status === "uploading"}
					onClick={onRemove}
					className="shrink-0"
				>
					<X />
				</Button>
			</div>
			<p
				className={cn(
					"flex items-center gap-1.5 text-label-medium tabular-nums",
					item.status === "failed"
						? "text-danger"
						: item.status === "done"
							? "text-accent"
							: "text-md-on-surface-variant",
				)}
			>
				{item.status === "uploading" ? (
					<LoaderCircle className="size-3.5 animate-spin" aria-hidden />
				) : null}
				{item.status === "done" ? (
					<Check className="size-3.5" aria-hidden />
				) : null}
				<span>
					{item.status === "uploading"
						? t("gm.music.uploadUploading")
						: item.status === "done"
							? t("gm.music.uploadDone")
							: item.status === "failed"
								? (item.error ?? t("gm.music.uploadFailed"))
								: item.durationMs > 0
									? formatDurationMmSs(item.durationMs)
									: item.file.name}
				</span>
			</p>
		</li>
	);
}

export function AddTracksDialog({
	open,
	onOpenChange,
	moduleId,
	moduleName,
	tracks,
	defaultTab = "upload",
	droppedFiles,
	onDroppedFilesConsumed,
	onAdded,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	moduleId: string;
	moduleName: string;
	/** 本模组已有曲目，用于在平台搜索里标出“已添加” */
	tracks: readonly TrackDto[];
	defaultTab?: AddTracksTab;
	/** 从页面拖进来的文件：对话框打开后直接进入队列 */
	droppedFiles: readonly File[];
	onDroppedFilesConsumed: () => void;
	onAdded: (track: TrackDto) => void;
}) {
	const [tab, setTab] = useState<AddTracksTab>(defaultTab);
	const queue = useUploadQueue({ moduleId, onAdded });
	const inputRef = useRef<HTMLInputElement>(null);
	const { addFiles, reset } = queue;

	useEffect(() => {
		if (open) {
			setTab(defaultTab);
		}
	}, [open, defaultTab]);

	useEffect(() => {
		if (!open || droppedFiles.length === 0) {
			return;
		}
		setTab("upload");
		const { rejected } = addFiles(droppedFiles);
		if (rejected > 0) {
			toast.error(t("gm.music.dropNotAudio"));
		}
		onDroppedFilesConsumed();
	}, [open, droppedFiles, addFiles, onDroppedFilesConsumed]);

	const finished = queue.items.length > 0 && queue.pendingCount === 0;

	function handleOpenChange(next: boolean) {
		if (!next && queue.busy) {
			return;
		}
		if (!next) {
			reset();
		}
		onOpenChange(next);
	}

	function pickFiles(files: FileList | null) {
		if (!files || files.length === 0) {
			return;
		}
		const { rejected } = addFiles(Array.from(files));
		if (rejected > 0) {
			toast.error(t("gm.music.dropNotAudio"));
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{t("gm.music.addDialogTitle")}</DialogTitle>
					<DialogDescription>
						{t("gm.music.addDialogTarget", { module: moduleName })}
					</DialogDescription>
				</DialogHeader>
				<Tabs value={tab} onValueChange={(value) => setTab(value as AddTracksTab)}>
					<TabsList className="w-full">
						<TabsTrigger value="upload" className="min-h-11 flex-1">
							{t("gm.music.addTabUpload")}
						</TabsTrigger>
						<TabsTrigger value="platform" className="min-h-11 flex-1">
							{t("gm.music.addTabPlatform")}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="upload" className="flex flex-col gap-3 pt-3">
						<input
							ref={inputRef}
							type="file"
							accept="audio/*"
							multiple
							hidden
							data-testid="music-file-input"
							onChange={(event) => {
								pickFiles(event.currentTarget.files);
								event.currentTarget.value = "";
							}}
						/>
						<button
							type="button"
							disabled={queue.busy}
							onClick={() => inputRef.current?.click()}
							className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-md-outline-variant px-6 py-7 text-center outline-none transition-colors hover:border-md-outline hover:bg-md-on-surface/4 focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
						>
							<Upload className="size-6 text-md-on-surface" aria-hidden />
							<span className="text-title-small text-md-on-surface">
								{t("gm.music.uploadDropTitle")}
							</span>
							<span className="text-body-medium text-md-on-surface-variant">
								{t("gm.music.uploadDropHint")}
							</span>
						</button>
						{queue.items.length > 0 ? (
							<ul className="flex max-h-72 flex-col overflow-y-auto">
								{queue.items.map((item) => (
									<UploadRow
										key={item.id}
										item={item}
										disabled={queue.busy}
										onRename={(name) => queue.rename(item.id, name)}
										onRetype={(type) => queue.retype(item.id, type)}
										onRemove={() => queue.remove(item.id)}
									/>
								))}
							</ul>
						) : null}
						<DialogFooter className="items-center sm:justify-between">
							<p className="text-body-small text-md-on-surface-variant">
								{t("gm.music.uploadGuessHint")}
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="tertiary"
									size="sm"
									disabled={queue.busy}
									onClick={() => handleOpenChange(false)}
								>
									{finished
										? t("gm.music.uploadClose")
										: t("common.cancel")}
								</Button>
								{queue.pendingCount > 0 ? (
									<Button
										type="button"
										size="sm"
										disabled={queue.busy}
										onClick={() => void queue.submit()}
									>
										{t("gm.music.uploadSubmit", { count: queue.pendingCount })}
									</Button>
								) : null}
							</div>
						</DialogFooter>
					</TabsContent>
					<TabsContent value="platform">
						<MusicSourcePanel
							moduleId={moduleId}
							tracks={[...tracks]}
							onAdded={onAdded}
						/>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
