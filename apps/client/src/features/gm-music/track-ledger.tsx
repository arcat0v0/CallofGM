import type { TrackDto } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { type LibraryTrack, splitSections } from "./music-library-model";
import { LEDGER_GRID, TrackRow, type TrackRowAction } from "./track-row";

export type LedgerEmpty = "module" | "all" | "filtered" | null;

export type TrackLedgerProps = {
	tracks: readonly LibraryTrack[];
	/** 全部曲目视图：每幕内按模组分组，编号按组重置。 */
	groupByModule: boolean;
	/** 分组的顺序：与侧栏的模组顺序一致 */
	moduleOrder: readonly string[];
	empty: LedgerEmpty;
	auditionId: string | null;
	auditionProgress: number;
	selection: ReadonlySet<string>;
	renamingId: string | null;
	onToggleAudition: (track: LibraryTrack) => void;
	onToggleSelect: (track: LibraryTrack) => void;
	onAction: (track: LibraryTrack, action: TrackRowAction) => void;
	onRenameCommit: (track: LibraryTrack, name: string) => void;
	onRenameCancel: () => void;
	onClearFilters: () => void;
};

function SectionRule({
	type,
	count,
}: {
	type: TrackDto["type"];
	count: number;
}) {
	return (
		<div
			role="presentation"
			className="flex h-9 items-center gap-3 border-b-2 border-md-outline"
		>
			<h2 className="font-mono text-label-large-emph tracking-widest text-md-on-surface">
				{t(type === "bgm" ? "gm.music.sectionBgm" : "gm.music.sectionSe")}
			</h2>
			<span className="font-mono text-label-large tabular-nums text-md-on-surface-variant">
				{count}
			</span>
			<span className="ml-auto font-mono text-label-medium text-md-on-surface-variant">
				{t(
					type === "bgm"
						? "gm.music.sectionBgmHint"
						: "gm.music.sectionSeHint",
				)}
			</span>
		</div>
	);
}

function GroupRule({ label, count }: { label: string; count: number }) {
	return (
		<div className="mt-1 flex h-9 items-end gap-2 border-t border-md-outline-variant/40 pb-1 font-mono text-label-medium text-md-on-surface-variant first:mt-0 first:border-t-0">
			<span className="truncate">{label}</span>
			<span className="tabular-nums">{count}</span>
		</div>
	);
}

function groupByModuleId(
	tracks: readonly LibraryTrack[],
	order: readonly string[],
) {
	const groups = new Map<string, { label: string; tracks: LibraryTrack[] }>();
	for (const track of tracks) {
		const bucket = groups.get(track.moduleId);
		if (bucket) {
			bucket.tracks.push(track);
		} else {
			groups.set(track.moduleId, {
				label: track.moduleName ?? track.moduleId,
				tracks: [track],
			});
		}
	}
	const rank = (id: string) => {
		const index = order.indexOf(id);
		return index === -1 ? order.length : index;
	};
	return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

/** 空模组：画出一张空白的提示单，说明与入口放在它上面。 */
function BlankSheet() {
	return (
		<div aria-hidden className="select-none">
			{(["bgm", "se"] as const).map((type) => (
				<div key={type} className="not-first:mt-8">
					<SectionRule type={type} count={0} />
					{[1, 2].map((row) => (
						<div
							key={row}
							className={cn(
								LEDGER_GRID,
								"h-11 border-b border-md-outline-variant/30 text-md-on-surface-variant/60",
							)}
						>
							<span className="font-mono text-label-medium tabular-nums">
								{String(row).padStart(2, "0")}
							</span>
							<span />
							<span className="font-mono text-body-medium md:hidden">--:--</span>
							<span className="hidden md:block" />
							<span className="hidden md:block" />
							<span className="hidden text-right font-mono text-body-medium md:block">
								--:--
							</span>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function EmptyMessage({
	title,
	hint,
	action,
}: {
	title: string;
	hint: string;
	action?: { label: string; onClick: () => void };
}) {
	return (
		<div className="flex flex-col items-start gap-1 pb-6">
			<h3 className="text-title-medium-emph text-md-on-surface">{title}</h3>
			<p className="max-w-prose text-body-medium text-md-on-surface-variant">
				{hint}
			</p>
			{action ? (
				<Button
					type="button"
					variant="text"
					size="sm"
					className="-ml-4"
					onClick={action.onClick}
				>
					{action.label}
				</Button>
			) : null}
		</div>
	);
}

export function TrackLedger(props: TrackLedgerProps) {
	const { tracks, groupByModule, empty } = props;

	if (empty === "filtered") {
		return (
			<EmptyMessage
				title={t("gm.music.noMatchTitle")}
				hint={t("gm.music.noMatchHint")}
				action={{
					label: t("gm.music.clearFilters"),
					onClick: props.onClearFilters,
				}}
			/>
		);
	}
	if (empty === "all") {
		return (
			<EmptyMessage
				title={t("gm.music.emptyAllTitle")}
				hint={t("gm.music.emptyAllHint")}
			/>
		);
	}
	if (empty === "module") {
		return (
			<div>
				<EmptyMessage
					title={t("gm.music.emptyTitle")}
					hint={t("gm.music.emptyHint")}
				/>
				<BlankSheet />
			</div>
		);
	}

	const sections = splitSections(tracks);
	const selecting = props.selection.size > 0;

	const renderRow = (track: LibraryTrack, number: number) => {
		const active = props.auditionId === track.id;
		return (
			<TrackRow
				key={track.id}
				track={track}
				number={number}
				active={active}
				progress={active ? props.auditionProgress : 0}
				selected={props.selection.has(track.id)}
				selecting={selecting}
				renaming={props.renamingId === track.id}
				onToggleAudition={() => props.onToggleAudition(track)}
				onToggleSelect={() => props.onToggleSelect(track)}
				onAction={(action) => props.onAction(track, action)}
				onRenameCommit={(name) => props.onRenameCommit(track, name)}
				onRenameCancel={props.onRenameCancel}
			/>
		);
	};

	return (
		<div>
			{(["bgm", "se"] as const).map((type) => {
				const list = sections[type];
				if (list.length === 0) {
					return null;
				}
				return (
					<section
						key={type}
						aria-label={type.toUpperCase()}
						className="not-first:mt-8"
					>
						<SectionRule type={type} count={list.length} />
						{groupByModule
							? groupByModuleId(list, props.moduleOrder).map(
									([moduleId, group]) => (
										<div key={moduleId}>
											<GroupRule label={group.label} count={group.tracks.length} />
											{group.tracks.map((track, index) =>
												renderRow(track, index + 1),
											)}
										</div>
									),
								)
							: list.map((track, index) => renderRow(track, index + 1))}
					</section>
				);
			})}
		</div>
	);
}
