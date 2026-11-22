import {
	CheckSquare,
	ExternalLink,
	MoreVertical,
	Pause,
	Pencil,
	Play,
	Repeat,
	Trash2,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	type LibraryTrack,
	trackDurationText,
	trackMetaParts,
	trackSourceTag,
	trackSourceText,
} from "./music-library-model";

/**
 * 提示单的列：序号（悬停/选择时换成复选框）· 试听 · 曲目与说明 · 来源 · 时长 · 菜单。
 * 桌面与移动端各一套；空白提示单共用，保证左缘是一条脊。
 */
export const LEDGER_GRID =
	"grid grid-cols-[1.375rem_2.25rem_minmax(0,1fr)_2.25rem] items-center gap-x-1.5 md:grid-cols-[1.75rem_2rem_minmax(0,1fr)_4.5rem_4.5rem_2.5rem] md:gap-x-3";

export type TrackRowAction = "rename" | "retype" | "select" | "delete";

export function TrackRow({
	track,
	number,
	active,
	progress,
	selected,
	selecting,
	renaming,
	onToggleAudition,
	onToggleSelect,
	onAction,
	onRenameCommit,
	onRenameCancel,
}: {
	track: LibraryTrack;
	/** 幕内（或模组分组内）从 1 开始的序号 */
	number: number;
	active: boolean;
	/** 试听进度 0–1，仅 active 时有意义 */
	progress: number;
	selected: boolean;
	/** 已有选中项：所有行都露出复选框 */
	selecting: boolean;
	renaming: boolean;
	onToggleAudition: () => void;
	onToggleSelect: () => void;
	onAction: (action: TrackRowAction) => void;
	onRenameCommit: (name: string) => void;
	onRenameCancel: () => void;
}) {
	const [name, setName] = useState(track.name);
	// 从菜单进入改名：等菜单完全关闭后再显示输入框，否则菜单的焦点管理会让它立刻失焦并提交
	const renameRequested = useRef(false);
	useEffect(() => {
		setName(track.name);
	}, [track.name, renaming]);

	const meta = trackMetaParts(track).join(" · ");
	const sourceTag = trackSourceTag(track);
	const duration = trackDurationText(track);
	const label = t(
		active ? "gm.music.previewStopAria" : "gm.music.previewAria",
		{
			name: track.name,
		},
	);
	const serial = String(number).padStart(2, "0");
	const nextType = track.type === "bgm" ? "se" : "bgm";
	const showCheckbox = selecting || selected;

	return (
		<div
			data-track-id={track.id}
			data-active={active || undefined}
			className={cn(
				LEDGER_GRID,
				"group/row relative min-h-14 border-b border-md-outline-variant/30 px-3 transition-colors duration-150 ease-standard-fast-effects hover:bg-md-surface-container motion-reduce:transition-none md:h-11 md:min-h-0",
				selected &&
					"bg-md-surface-container-high before:absolute before:inset-y-2 before:left-1.5 before:w-0.5 before:rounded-full before:bg-accent hover:bg-md-surface-container-high",
			)}
		>
			<div className="group/cell relative flex items-center">
				<span
					className={cn(
						"text-label-medium tabular-nums",
						active ? "text-accent" : "text-md-on-surface-variant",
						showCheckbox && "invisible",
						"group-hover/row:invisible group-has-focus-visible/cell:invisible",
					)}
				>
					{serial}
				</span>
				<Checkbox
					checked={selected}
					onCheckedChange={onToggleSelect}
					aria-label={t("gm.music.selectAria", { name: track.name })}
					className={cn(
						"absolute left-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
						"data-checked:border-md-on-surface data-checked:bg-md-on-surface",
						showCheckbox && "opacity-100",
					)}
				/>
			</div>
			<Button
				type="button"
				variant={active ? "primary" : "ghost"}
				size="icon-sm"
				aria-label={label}
				aria-pressed={active}
				onClick={onToggleAudition}
				className={cn(
					"size-9 justify-self-center border border-transparent md:size-8 [&_svg]:size-4",
					!active &&
						"text-md-on-surface/70 group-hover/row:border-md-outline/70 group-hover/row:text-md-on-surface",
				)}
			>
				{active ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
			</Button>
			<div className="flex min-w-0 flex-col justify-center py-1.5 md:flex-row md:items-baseline md:justify-start md:gap-2.5 md:py-0">
				{renaming ? (
					<Input
						value={name}
						autoFocus
						aria-label={t("gm.music.renameAria", { name: track.name })}
						onInput={(event) => setName(event.currentTarget.value)}
						onBlur={() => onRenameCommit(name)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								onRenameCommit(name);
							}
							if (event.key === "Escape") {
								onRenameCancel();
							}
						}}
						className="h-8 text-body-large"
					/>
				) : (
					<button
						type="button"
						onClick={onToggleAudition}
						tabIndex={-1}
						className="min-w-0 max-w-full truncate text-left text-body-large-emph text-md-on-surface outline-none md:max-w-[70%]"
					>
						{track.name}
					</button>
				)}
				<span className="hidden min-w-0 truncate text-body-small text-md-on-surface-variant md:block">
					{meta}
				</span>
				<span className="truncate text-body-small text-md-on-surface-variant md:hidden">
					<span className="tabular-nums">{duration}</span>
					{meta ? ` · ${meta}` : ""}
					{sourceTag ? ` · ${sourceTag}` : ""}
				</span>
			</div>
			<span className="hidden truncate text-right text-label-medium text-md-on-surface-variant md:block">
				{sourceTag}
			</span>
			<span className="hidden text-right text-body-medium tabular-nums text-md-on-surface-variant md:block">
				{duration}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("gm.music.moreAria", { name: track.name })}
						className="size-9 justify-self-end text-md-on-surface-variant/70 hover:text-md-on-surface data-[state=open]:text-md-on-surface md:size-10"
					>
						<MoreVertical />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="min-w-48"
					onCloseAutoFocus={(event) => {
						if (renameRequested.current) {
							event.preventDefault();
							renameRequested.current = false;
							onAction("rename");
						}
					}}
				>
					<DropdownMenuItem
						onSelect={() => {
							renameRequested.current = true;
						}}
					>
						<Pencil />
						{t("gm.music.menuRename")}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onAction("retype")}>
						{nextType === "bgm" ? <Repeat /> : <Zap />}
						{t(nextType === "bgm" ? "gm.music.menuToBgm" : "gm.music.menuToSe")}
					</DropdownMenuItem>
					{track.sourceUrl ? (
						<DropdownMenuItem asChild>
							<a href={track.sourceUrl} target="_blank" rel="noreferrer">
								<ExternalLink />
								{t("gm.music.menuOpenSource", {
									source: trackSourceText(track.source),
								})}
							</a>
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem onSelect={() => onAction("select")}>
						<CheckSquare />
						{t("gm.music.menuSelect")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => onAction("delete")}
					>
						<Trash2 />
						{t("gm.music.menuDelete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{active ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-md-outline-variant/60"
				>
					<div
						className="h-full bg-accent"
						style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
					/>
				</div>
			) : null}
		</div>
	);
}
