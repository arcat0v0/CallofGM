import { Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUpRight,
	Ellipsis,
	Palette,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUpdated } from "@/features/gm-characters/library-model";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EnrichedModule, ModulesSort } from "./module-model";

type ModuleResultsProps = {
	items: EnrichedModule[];
	onOpenTheme: (entry: EnrichedModule) => void;
	onDelete: (entry: EnrichedModule) => void;
};

type ModuleLedgerProps = ModuleResultsProps & {
	sort: ModulesSort;
	onChangeSort: (sort: ModulesSort) => void;
};

function CoverPlate({
	entry,
	compact = false,
}: {
	entry: EnrichedModule;
	compact?: boolean;
}) {
	const cover = entry.summary?.coverAssetId
		? mediaUrl(entry.summary.coverAssetId)
		: null;

	if (cover) {
		return (
			<img
				src={cover}
				alt={t("gm.modules.coverAlt", { name: entry.module.name })}
				loading="lazy"
				decoding="async"
				className="size-full object-cover"
			/>
		);
	}

	if (compact) {
		return (
			<div className="relative flex size-full items-center justify-center bg-md-surface-container-lowest">
				<span
					aria-hidden
					className="pointer-events-none absolute top-1.5 left-1.5 size-1.5 border-t border-l border-md-outline/75"
				/>
				<span
					aria-hidden
					className="pointer-events-none absolute top-1.5 right-1.5 size-1.5 border-t border-r border-md-outline/75"
				/>
				<span
					aria-hidden
					className="pointer-events-none absolute bottom-1.5 left-1.5 size-1.5 border-b border-l border-md-outline/75"
				/>
				<span
					aria-hidden
					className="pointer-events-none absolute right-1.5 bottom-1.5 size-1.5 border-r border-b border-md-outline/75"
				/>
				<span
					aria-hidden
					className="size-2 rounded-full bg-md-outline-variant"
				/>
			</div>
		);
	}

	// 全铺深橄榄场记底板：对称四角取景框刻度 + 纯排版标识，零 stock 占位图
	return (
		<div className="relative flex size-full flex-col items-center justify-center gap-1 bg-md-surface-container-lowest">
			<span
				aria-hidden
				className="pointer-events-none absolute top-3.5 left-3.5 size-3 border-t border-l border-md-outline/75"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute top-3.5 right-3.5 size-3 border-t border-r border-md-outline/75"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-3.5 left-3.5 size-3 border-b border-l border-md-outline/75"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute right-3.5 bottom-3.5 size-3 border-r border-b border-md-outline/75"
			/>
			<span className="font-mono text-label-small tracking-[0.14em] text-md-on-surface-variant/80">
				16:9
			</span>
			<span className="text-label-medium text-md-on-surface-variant">
				{t("gm.modules.noCoverScene")}
			</span>
		</div>
	);
}

function ResourceCounts({ entry }: { entry: EnrichedModule }) {
	const summary = entry.summary;
	if (!summary) return null;
	if (entry.assetTotal === 0) {
		return (
			<span className="text-body-small text-md-on-surface-variant">
				{t("gm.modules.noAssetsYet")}
			</span>
		);
	}
	// 画廊仅展示非零资源类别，让完整备团模组与单场景草稿在 0.5 秒内自然拉开层次
	const stats = [
		{ label: t("gm.modules.statScenes"), count: summary.sceneCount },
		{ label: t("gm.modules.statCharacters"), count: summary.characterCount },
		{ label: t("gm.modules.statHandouts"), count: summary.handoutCount },
		{ label: t("gm.modules.statTracks"), count: summary.trackCount },
	].filter((stat) => stat.count > 0);

	return (
		<div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-body-small tabular-nums">
			{stats.map((stat, index) => (
				<span key={stat.label} className="inline-flex items-baseline gap-1">
					{index > 0 ? (
						<span aria-hidden className="mr-1.5 text-md-on-surface-variant/60">
							·
						</span>
					) : null}
					<span className="text-label-medium-emph text-md-on-surface">
						{stat.count}
					</span>
					<span className="text-md-on-surface-variant">{stat.label}</span>
				</span>
			))}
		</div>
	);
}

function ModuleActionsMenu({
	entry,
	onOpenTheme,
	onDelete,
	triggerClassName,
}: {
	entry: EnrichedModule;
	onOpenTheme: (entry: EnrichedModule) => void;
	onDelete: (entry: EnrichedModule) => void;
	triggerClassName?: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={(event) => event.stopPropagation()}
					className={cn(
						"size-11 shrink-0 rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface sm:size-9",
						triggerClassName,
					)}
					aria-label={t("gm.modules.moreActions", { name: entry.module.name })}
				>
					<Ellipsis className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				onClick={(event) => event.stopPropagation()}
			>
				<DropdownMenuItem asChild>
					<Link
						to="/gm/module/$moduleId"
						params={{ moduleId: entry.module.id }}
					>
						<ArrowUpRight />
						{t("gm.modules.openWorkspace")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onOpenTheme(entry)}>
					<Palette />
					{t("gm.modules.changeTheme")}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onClick={() => onDelete(entry)}
				>
					<Trash2 />
					{t("gm.modules.deleteTitle")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ModuleGallery({
	items,
	onOpenTheme,
	onDelete,
}: ModuleResultsProps) {
	return (
		<ul className="grid grid-cols-1 gap-3 pb-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
			{items.map((entry) => (
				<li key={entry.module.id} className="min-w-0">
					<article className="group flex h-full flex-col overflow-hidden rounded-xl bg-md-surface-container-low transition-colors duration-150 ease-standard-fast-effects hover:bg-md-surface-container focus-within:bg-md-surface-container motion-reduce:transition-none">
						<Link
							to="/gm/module/$moduleId"
							params={{ moduleId: entry.module.id }}
							className="flex flex-1 flex-col rounded-t-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
						>
							<div className="relative mx-1.5 mt-1.5 aspect-[16/9] overflow-hidden rounded-lg-inc bg-md-surface-container-lowest">
								<CoverPlate entry={entry} />
							</div>

							<div className="flex flex-1 flex-col gap-1 px-4 pt-2.5 pb-1">
								<div className="flex items-center justify-between gap-2">
									<span className="flex min-w-0 items-center gap-1.5 truncate">
										<span className="shrink-0 rounded-full bg-md-surface-container-high px-2 py-0.5 text-label-small text-md-on-surface-variant">
											{entry.ruleShortName}
										</span>
										{entry.themeName ? (
											<>
												<span
													aria-hidden
													className="text-label-small text-md-on-surface-variant/65"
												>
													·
												</span>
												<span className="truncate text-label-small text-md-on-surface-variant">
													{entry.themeName}
												</span>
											</>
										) : null}
									</span>
									<span className="shrink-0 text-label-small tabular-nums text-md-on-surface-variant">
										{formatUpdated(entry.updatedAt)}
									</span>
								</div>

								<h2 className="truncate text-title-medium-emph text-md-on-surface">
									{entry.module.name}
								</h2>

								<p className="line-clamp-2 min-h-[2.125rem] overflow-hidden text-body-small text-md-on-surface-variant">
									{entry.module.description || t("gm.modules.noDescription")}
								</p>
							</div>
						</Link>

						<div className="mt-auto flex items-center justify-between gap-2 pr-2 pb-1.5 pl-4">
							<Link
								to="/gm/module/$moduleId"
								params={{ moduleId: entry.module.id }}
								className="min-w-0 flex-1 rounded-sm py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
							>
								<ResourceCounts entry={entry} />
							</Link>
							<ModuleActionsMenu
								entry={entry}
								onOpenTheme={onOpenTheme}
								onDelete={onDelete}
							/>
						</div>
					</article>
				</li>
			))}
		</ul>
	);
}

function LedgerStatCell({ count }: { count: number }) {
	return (
		<td className="hidden w-14 pr-3 text-right tabular-nums lg:table-cell">
			{count > 0 ? (
				<span className="text-label-large-emph text-md-on-surface">
					{count}
				</span>
			) : (
				<span className="text-label-medium text-md-on-surface-variant/80">
					–
				</span>
			)}
		</td>
	);
}

export function ModuleLedger({
	items,
	sort,
	onChangeSort,
	onOpenTheme,
	onDelete,
}: ModuleLedgerProps) {
	return (
		<div className="isolate overflow-clip rounded-xl bg-md-surface-container-low">
			<table className="w-full table-fixed border-separate border-spacing-0 text-left">
				<thead className="sticky top-0 z-10 bg-md-surface-container">
					<tr className="text-label-medium-emph text-md-on-surface-variant [&>th]:h-10">
						<th scope="col" className="pl-3">
							<button
								type="button"
								onClick={() => onChangeSort("name")}
								className={cn(
									"inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-md-on-surface",
									sort === "name" && "text-md-on-surface",
								)}
							>
								<span>{t("gm.modules.colName")}</span>
								{sort === "name" ? (
									<ArrowDown className="size-3 text-accent" aria-hidden />
								) : null}
							</button>
						</th>
						<th scope="col" className="hidden w-24 sm:table-cell">
							{t("gm.modules.colRule")}
						</th>
						<th
							scope="col"
							className="hidden w-14 pr-3 text-right lg:table-cell"
						>
							<button
								type="button"
								onClick={() => onChangeSort("assets")}
								className={cn(
									"inline-flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-md-on-surface",
									sort === "assets" && "text-md-on-surface",
								)}
							>
								<span>{t("gm.modules.statScenes")}</span>
								{sort === "assets" ? (
									<ArrowDown className="size-3 text-accent" aria-hidden />
								) : null}
							</button>
						</th>
						<th
							scope="col"
							className="hidden w-14 pr-3 text-right lg:table-cell"
						>
							{t("gm.modules.statCharacters")}
						</th>
						<th
							scope="col"
							className="hidden w-14 pr-3 text-right lg:table-cell"
						>
							{t("gm.modules.statHandouts")}
						</th>
						<th
							scope="col"
							className="hidden w-14 pr-3 text-right lg:table-cell"
						>
							{t("gm.modules.statTracks")}
						</th>
						<th scope="col" className="hidden w-28 pl-8 xl:table-cell">
							{t("gm.modules.colTheme")}
						</th>
						<th scope="col" className="w-24 pr-3 text-right">
							<button
								type="button"
								onClick={() => onChangeSort("updated")}
								className={cn(
									"inline-flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-md-on-surface",
									sort === "updated" && "text-md-on-surface",
								)}
							>
								<span>{t("gm.modules.colUpdated")}</span>
								{sort === "updated" ? (
									<ArrowDown className="size-3 text-accent" aria-hidden />
								) : null}
							</button>
						</th>
						<th
							scope="col"
							className="w-14 pr-4"
							aria-label={t("gm.dashboard.actions")}
						/>
					</tr>
				</thead>
				<tbody>
					{items.map((entry) => (
						<tr
							key={entry.module.id}
							className="group align-middle [&>td]:transition-colors [&>td]:duration-150 [&>td]:ease-standard-fast-effects motion-reduce:[&>td]:transition-none hover:[&>td]:bg-md-surface-container focus-within:[&>td]:bg-md-surface-container [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md"
						>
							<td className="py-2.5 pr-3 pl-3">
								<Link
									to="/gm/module/$moduleId"
									params={{ moduleId: entry.module.id }}
									className="flex min-w-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
								>
									<div className="h-10 w-[4.5rem] shrink-0 overflow-hidden rounded-sm bg-md-surface-container-lowest">
										<CoverPlate entry={entry} compact />
									</div>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-title-small-emph text-md-on-surface">
											{entry.module.name}
										</span>
										<span className="truncate text-body-small text-md-on-surface-variant">
											<span className="sm:hidden">
												{entry.ruleShortName} ·{" "}
											</span>
											{entry.module.description ||
												t("gm.modules.noDescription")}
										</span>
									</div>
								</Link>
							</td>
							<td className="hidden text-label-medium text-md-on-surface-variant sm:table-cell">
								{entry.ruleShortName}
							</td>
							<LedgerStatCell count={entry.summary?.sceneCount ?? 0} />
							<LedgerStatCell count={entry.summary?.characterCount ?? 0} />
							<LedgerStatCell count={entry.summary?.handoutCount ?? 0} />
							<LedgerStatCell count={entry.summary?.trackCount ?? 0} />
							<td className="hidden truncate pr-2 pl-8 text-body-small text-md-on-surface-variant xl:table-cell">
								{entry.themeName ?? "–"}
							</td>
							<td className="pr-3 text-right text-label-small tabular-nums text-md-on-surface-variant">
								{formatUpdated(entry.updatedAt)}
							</td>
							<td className="pr-4 text-right">
								<ModuleActionsMenu
									entry={entry}
									onOpenTheme={onOpenTheme}
									onDelete={onDelete}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
