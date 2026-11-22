import type { GmCharacterLibraryItemDto } from "@cogm/shared";
import { UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatUpdated } from "./library-model";
import { PortraitFrame } from "./portrait-frame";

type ResultsProps = {
	items: GmCharacterLibraryItemDto[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onOpen: (id: string) => void;
	hasMore: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
};

const kindLabel = (kind: string) =>
	kind === "npc" ? t("gm.library.kindNpc") : t("gm.library.kindPc");

/** 归属：自己的人物留空（大多数），只突出玩家持有者 */
function OwnerText({
	item,
	short = false,
}: {
	item: GmCharacterLibraryItemDto;
	short?: boolean;
}) {
	if (item.ownedByMe) {
		return <span className="sr-only">{t("gm.library.ownerMe")}</span>;
	}
	const name = item.ownerName ?? "";
	return (
		<span className="inline-flex min-w-0 items-center gap-1 text-md-on-surface">
			<UserRound className="size-3.5 shrink-0" aria-hidden />
			<span className="truncate">
				{short ? name : t("gm.library.ownerPlayer", { name })}
			</span>
		</span>
	);
}

function KindText({ kind }: { kind: string }) {
	return (
		<span
			className={cn(
				"text-label-medium",
				kind === "npc" ? "text-md-on-surface-variant" : "text-md-on-surface",
			)}
		>
			{kindLabel(kind)}
		</span>
	);
}

function ModulesText({
	item,
	max = 2,
}: {
	item: GmCharacterLibraryItemDto;
	max?: number;
}) {
	if (item.modules.length === 0) {
		return (
			<span title={t("gm.library.unlinked")}>
				<span aria-hidden>—</span>
				<span className="sr-only">{t("gm.library.unlinked")}</span>
			</span>
		);
	}
	const shown = item.modules.slice(0, max);
	const rest = item.modules.length - shown.length;
	return (
		<span
			className="truncate"
			title={item.modules.map((module) => module.name).join("、")}
		>
			{shown.map((module) => module.name).join("、")}
			{rest > 0 ? (
				<span className="ml-1 tabular-nums text-md-on-surface-variant">
					{t("gm.library.moreModules", { count: rest })}
				</span>
			) : null}
		</span>
	);
}

/** 名字中的称谓前缀（“警长 露西”）以次要色显示，让名字本身先被看到 */
function NameText({ name }: { name: string }) {
	const space = name.lastIndexOf(" ");
	if (space <= 0) return <>{name}</>;
	return (
		<>
			<span className="text-md-on-surface-variant">
				{name.slice(0, space)}{" "}
			</span>
			{name.slice(space + 1)}
		</>
	);
}

/** 固定含义的副行：类型 · 模组，玩家持有时再追加玩家 */
function MetaLine({ item }: { item: GmCharacterLibraryItemDto }) {
	return (
		<span className="flex min-w-0 items-center gap-1.5 text-body-small text-md-on-surface-variant">
			<KindText kind={item.kind} />
			<span aria-hidden>·</span>
			<ModulesText item={item} max={1} />
			{item.ownedByMe ? null : (
				<>
					<span aria-hidden>·</span>
					<span className="shrink-0">
						<OwnerText item={item} short />
					</span>
				</>
			)}
		</span>
	);
}

/** 列表底部哨兵：进入视口时加载下一页 */
function LoadMoreSentinel({
	hasMore,
	loadingMore,
	onLoadMore,
}: Pick<ResultsProps, "hasMore" | "loadingMore" | "onLoadMore">) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node || !hasMore || typeof IntersectionObserver === "undefined") {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
			},
			{ rootMargin: "400px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [hasMore, onLoadMore]);
	if (!hasMore) return null;
	return (
		<div ref={ref} className="flex justify-center py-4">
			<button
				type="button"
				onClick={onLoadMore}
				disabled={loadingMore}
				className="rounded-xs px-3 py-1.5 text-label-large text-md-on-surface-variant outline-none hover:text-md-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				{loadingMore ? t("gm.library.loadingMore") : t("gm.library.loadMore")}
			</button>
		</div>
	);
}

/** 紧凑台账：一行一人（36px），只含通用字段 */
export function LibraryList(props: ResultsProps) {
	const { items, selectedId, onSelect, onOpen } = props;
	return (
		<div className="isolate overflow-clip rounded-lg-inc bg-md-surface-container-low">
			<table className="w-full table-fixed border-separate border-spacing-0 text-left">
				<thead className="sticky top-0 z-10 bg-md-surface-container-low max-lg:top-13">
					<tr className="text-label-medium text-md-on-surface-variant [&>th]:h-8 [&>th]:border-b [&>th]:border-md-outline-variant/60">
						<th scope="col" className="pl-4">
							{t("gm.library.colName")}
						</th>
						<th scope="col" className="hidden w-1/3 px-3 sm:table-cell xl:w-2/5">
							{t("gm.library.colModules")}
						</th>
						<th scope="col" className="w-24 pr-4 text-right">
							{t("gm.library.colUpdated")}
						</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => {
						const selected = item.id === selectedId;
						return (
							<tr
								key={item.id}
								data-character-id={item.id}
								aria-selected={selected}
								onClick={() => onSelect(item.id)}
								onDoubleClick={() => onOpen(item.id)}
								className="group cursor-pointer align-middle aria-selected:bg-md-surface-container-high hover:bg-md-surface-container focus-within:bg-md-surface-container aria-selected:hover:bg-md-surface-container-high aria-selected:focus-within:bg-md-surface-container-high motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-standard-fast-effects [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-md-outline-variant/35"
							>
								<td className="relative h-9 pr-1 pl-4 max-sm:h-14 group-aria-selected:before:absolute group-aria-selected:before:inset-y-2 group-aria-selected:before:left-1 group-aria-selected:before:w-0.5 group-aria-selected:before:rounded-full group-aria-selected:before:bg-accent">
									<button
										type="button"
										tabIndex={selected ? 0 : -1}
										onClick={(event) => {
											event.stopPropagation();
											onSelect(item.id);
										}}
										className="flex w-full min-w-0 items-center gap-2.5 rounded-xs text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
									>
										<PortraitFrame
											name={item.name}
											src={mediaUrl(item.portraitAssetId)}
											className="size-7 rounded-sm bg-md-surface-container-highest"
										/>
										<span className="flex min-w-0 flex-col">
											<span className="flex min-w-0 items-center gap-1.5">
												<span
													className="truncate text-title-small-emph text-md-on-surface"
													title={item.name}
												>
													<NameText name={item.name} />
												</span>
												<span className="hidden shrink-0 rounded-xs bg-md-surface-container-highest px-1.5 text-label-small text-md-on-surface-variant sm:inline">
													{kindLabel(item.kind)}
												</span>
												<span className="hidden min-w-0 max-w-24 text-body-small sm:flex">
													<OwnerText item={item} short />
												</span>
											</span>
											<span className="sm:hidden">
												<MetaLine item={item} />
											</span>
										</span>
									</button>
								</td>
								<td className="hidden px-3 text-body-medium text-md-on-surface-variant sm:table-cell">
									<div className="flex min-w-0">
										<ModulesText item={item} max={1} />
									</div>
								</td>
								<td className="pr-4 pl-1 text-right text-label-medium whitespace-nowrap tabular-nums text-md-on-surface-variant">
									{formatUpdated(item.updatedAt)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<LoadMoreSentinel {...props} />
		</div>
	);
}

/**
 * 立绘墙：有立绘的人物是 3:4 画框（名字与模组叠在画面底部）；
 * 无立绘的人物收进“无立绘”分组，以紧凑名牌呈现，不再占用整张空画框。
 */
export function LibraryWall(props: ResultsProps) {
	const { items, selectedId, onSelect, onOpen } = props;
	const withArt = items.filter((item) => item.portraitAssetId);
	const withoutArt = items.filter((item) => !item.portraitAssetId);
	const ringClass = (selected: boolean) =>
		selected
			? "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-2 after:ring-inset after:ring-accent"
			: "group-hover:outline-1 group-hover:-outline-offset-1 group-hover:outline-md-outline"
	return (
		<div className="flex flex-col gap-5 px-1 pt-1 pb-3">
			{withArt.length > 0 ? (
				<ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
					{withArt.map((item) => {
						const selected = item.id === selectedId;
						return (
							<li key={item.id} data-character-id={item.id}>
								<button
									type="button"
									aria-pressed={selected}
									onClick={() => onSelect(item.id)}
									onDoubleClick={() => onOpen(item.id)}
									className="group block w-full rounded-lg-inc text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
								>
									<span
										className={cn(
											"relative isolate block aspect-[3/4] w-full overflow-hidden rounded-lg-inc bg-md-surface-container-high",
											ringClass(selected),
										)}
									>
										<PortraitFrame
											name={item.name}
											src={mediaUrl(item.portraitAssetId)}
											size="tile"
											className="absolute inset-0 rounded-none"
										/>
										<span
											aria-hidden
											className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-md-scrim/90 via-md-scrim/50 to-transparent"
										/>
										<span className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
											<KindText kind={item.kind} />
											{item.ownedByMe ? null : (
												<span className="min-w-0 text-label-small">
													<OwnerText item={item} short />
												</span>
											)}
										</span>
										<span className="absolute inset-x-3 bottom-3 flex flex-col gap-0.5">
											<span
												className={cn(
													"line-clamp-2 text-title-small break-words",
													selected ? "text-accent" : "text-md-on-surface",
												)}
											>
												{item.name}
											</span>
											<span className="flex min-w-0 text-body-small text-md-on-surface-variant">
												<ModulesText item={item} max={1} />
											</span>
										</span>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			) : null}
			{withoutArt.length > 0 ? (
				<section className="flex flex-col gap-3">
					{withArt.length > 0 ? (
						<h3 className="flex items-center gap-3 text-label-large text-md-on-surface-variant">
							<span>{t("gm.library.noPortraitGroup")}</span>
							<span className="tabular-nums">{withoutArt.length}</span>
							<span aria-hidden className="h-px flex-1 bg-md-outline-variant/60" />
						</h3>
					) : null}
					<ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
						{withoutArt.map((item) => {
							const selected = item.id === selectedId;
							return (
								<li key={item.id} data-character-id={item.id}>
									<button
										type="button"
										aria-pressed={selected}
										onClick={() => onSelect(item.id)}
										onDoubleClick={() => onOpen(item.id)}
										className="group block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
									>
										<span
											className={cn(
												"relative flex h-14 items-center gap-3 rounded-md px-3",
												item.kind === "npc"
													? "bg-md-surface-container-low"
													: "bg-md-surface-container",
												ringClass(selected),
											)}
										>
											<span className="flex min-w-0 flex-1 flex-col">
												<span
													className={cn(
														"truncate text-label-large",
														selected ? "text-accent" : "text-md-on-surface",
													)}
												>
													{selected ? item.name : <NameText name={item.name} />}
												</span>
												<MetaLine item={item} />
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}
			<LoadMoreSentinel {...props} />
		</div>
	);
}
