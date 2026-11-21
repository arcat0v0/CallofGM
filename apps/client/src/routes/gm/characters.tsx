import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	FileSpreadsheet,
	LayoutGrid,
	List,
	Plus,
	Search,
	SlidersHorizontal,
	UserPlus,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateCharacterDialog } from "@/features/gm-admin/dialogs/create-character-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { CharacterInspector } from "@/features/gm-characters/character-inspector";
import {
	type LibraryFilters,
	type LibrarySearch,
	parseLibrarySearch,
	useCharacterLibrary,
} from "@/features/gm-characters/library-model";
import { LibraryList, LibraryWall } from "@/features/gm-characters/library-results";
import {
	type LibraryFolderState,
	LibraryFolders,
	LibraryRulePicker,
} from "@/features/gm-characters/library-sidebar";
import { t, useI18nVersion } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";
import { readGmLibraryRule, writeGmLibraryRule } from "@/lib/storage";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";

export const Route = createFileRoute("/gm/characters")({
	validateSearch: (search: Record<string, unknown>): LibrarySearch =>
		parseLibrarySearch(search),
	beforeLoad: requireGmAuth,
	component: GmCharactersPage,
});

function isTypingTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

function GmCharactersPage() {
	useI18nVersion();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const wide = useMediaQuery("(min-width: 1024px)", true);
	const { rules } = useRuleOptions();
	const ruleIds = rules.map((rule) => rule.id);
	// URL 优先，其次是上次使用的规则，最后才是列表里的第一个
	const storedRuleId = readGmLibraryRule();
	const ruleId =
		search.rule && ruleIds.includes(search.rule)
			? search.rule
			: storedRuleId && ruleIds.includes(storedRuleId)
				? storedRuleId
				: ruleIds[0];
	useEffect(() => {
		if (ruleId) writeGmLibraryRule(ruleId);
	}, [ruleId]);
	const rule = getRuleComponent(ruleId);
	const view = search.view ?? "list";

	const [query, setQuery] = useState(search.q ?? "");
	const [createOpen, setCreateOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [importTargetId, setImportTargetId] = useState<string | null>(null);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	const setSearch = useCallback(
		(patch: Partial<LibrarySearch>, replace = true) =>
			void navigate({
				search: (prev: LibrarySearch) => ({ ...prev, ...patch }),
				replace,
			}),
		[navigate],
	);

	// 搜索输入防抖后写入 URL
	useEffect(() => {
		const handle = window.setTimeout(() => {
			const next = query.trim() || undefined;
			if (next !== search.q) setSearch({ q: next, sel: undefined });
		}, 200);
		return () => window.clearTimeout(handle);
	}, [query, search.q, setSearch]);

	const filters = useMemo<LibraryFilters | null>(
		() =>
			ruleId
				? {
						ruleId,
						kind: search.kind,
						ownerKind: search.owner,
						moduleId: search.module,
						q: search.q,
						sort: search.sort ?? "updated",
					}
				: null,
		[ruleId, search.kind, search.owner, search.module, search.q, search.sort],
	);
	const library = useCharacterLibrary(filters);
	const { items, facets } = library;

	const ruleCounts = new Map(
		(facets?.rules ?? []).map((entry) => [entry.ruleId, entry.count]),
	);
	const ruleOptions = ruleIds.map((id) => ({
		id,
		count: ruleCounts.get(id) ?? 0,
	}));
	const ruleTotal = ruleId ? (ruleCounts.get(ruleId) ?? 0) : 0;

	const selectedId =
		search.sel ?? (wide && !library.loading ? (items[0]?.id ?? null) : null);
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const folderState: LibraryFolderState = {
		kind: search.kind,
		owner: search.owner,
		module: search.module,
	};
	const activeFolderCount = [search.kind, search.owner, search.module].filter(
		Boolean,
	).length;
	const scopeParts = [
		search.kind === "pc"
			? t("gm.library.kindPc")
			: search.kind === "npc"
				? t("gm.library.kindNpc")
				: null,
		search.owner === "gm"
			? t("gm.library.ownerMine")
			: search.owner === "pl"
				? t("gm.library.ownerPlayers")
				: null,
		search.module === "none"
			? t("gm.library.unlinked")
			: search.module
				? (facets?.modules.find((module) => module.id === search.module)?.name ??
					null)
				: null,
	].filter((part): part is string => Boolean(part));
	const scopeTitle =
		scopeParts.length > 0 ? scopeParts.join(" · ") : t("gm.library.all");

	const select = useCallback(
		(id: string) => setSearch({ sel: id, detail: wide ? undefined : true }),
		[setSearch, wide],
	);
	const openSheet = useCallback(
		(id: string) =>
			void navigate({
				to: "/gm/characters/$characterId",
				params: { characterId: id },
			}),
		[navigate],
	);

	// 选中项变化（含首次加载、从 URL 恢复）时把它滚入可见区域
	const hasItems = items.length > 0;
	useEffect(() => {
		if (!selectedId || !hasItems) return;
		resultsRef.current
			?.querySelector(`[data-character-id="${CSS.escape(selectedId)}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [selectedId, hasItems, view]);

	// 键盘：/ 聚焦搜索；↑↓ 在结果中移动选中
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			if (event.key === "/" && !isTypingTarget(event.target)) {
				event.preventDefault();
				searchRef.current?.focus();
				return;
			}
			if (!wide || isTypingTarget(event.target)) return;
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
			if (document.querySelector("[role=dialog],[role=menu]")) return;
			const index = items.findIndex((item) => item.id === selectedId);
			const nextIndex =
				event.key === "ArrowDown"
					? Math.min(items.length - 1, index + 1)
					: Math.max(0, index - 1);
			const next = items[nextIndex];
			if (!next || next.id === selectedId) return;
			event.preventDefault();
			setSearch({ sel: next.id });
			resultsRef.current
				?.querySelector(`[data-character-id="${CSS.escape(next.id)}"]`)
				?.scrollIntoView({ block: "nearest" });
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [items, selectedId, setSearch, wide]);

	const changeRule = (next: string) =>
		setSearch(
			{
				rule: next,
				kind: undefined,
				owner: undefined,
				module: undefined,
				sel: undefined,
				detail: undefined,
			},
			false,
		);
	const changeFolders = (next: LibraryFolderState) =>
		setSearch({ ...next, sel: undefined });
	const clearAll = () => {
		setQuery("");
		setSearch({
			kind: undefined,
			owner: undefined,
			module: undefined,
			q: undefined,
			sel: undefined,
		});
	};

	const canImport = Boolean(rule.capabilities?.excelImport);
	const resultProps = {
		items,
		selectedId,
		onSelect: select,
		onOpen: openSheet,
		hasMore: library.hasMore,
		loadingMore: library.loadingMore,
		onLoadMore: library.loadMore,
	};

	const results = library.error && items.length === 0 ? (
		<EmptyState
			icon={Users}
			title={errorText(library.error, "gm.library.loadFailed")}
			action={
				<Button type="button" variant="outline" size="sm" onClick={() => void library.reload()}>
					{t("gm.library.retry")}
				</Button>
			}
			className="m-5 bg-transparent"
		/>
	) : library.loading && items.length === 0 ? (
		<div aria-busy className="flex flex-col">
			{Array.from({ length: 8 }, (_, index) => (
				<div
					key={index}
					className="mx-5 h-12 animate-pulse border-b border-md-outline-variant/40"
				/>
			))}
		</div>
	) : library.total === 0 ? (
		activeFolderCount > 0 || search.q ? (
			<EmptyState
				icon={Search}
				title={t("gm.library.noResultsTitle")}
				action={
					<div className="flex gap-2">
						{search.q ? (
							<Button
								type="button"
								variant="text"
								size="sm"
								onClick={() => setQuery("")}
							>
								{t("gm.library.clearSearch")}
							</Button>
						) : null}
						{activeFolderCount > 0 ? (
							<Button type="button" variant="outline" size="sm" onClick={clearAll}>
								{t("gm.library.clearFilters")}
							</Button>
						) : null}
					</div>
				}
				className="m-5 bg-transparent"
			/>
		) : (
			<EmptyState
				icon={UserPlus}
				title={t("gm.library.emptyRuleTitle")}
				description={t("gm.library.emptyRuleHint")}
				action={
					<Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
						<Plus />
						{t("gm.library.create")}
					</Button>
				}
				className="m-5 bg-transparent"
			/>
		)
	) : view === "wall" ? (
		<LibraryWall {...resultProps} />
	) : (
		<LibraryList {...resultProps} />
	);

	const viewControls = (
		<>
			<Select
				value={search.sort ?? "updated"}
				onValueChange={(value) =>
					setSearch({
						sort: value === "name" || value === "portrait" ? value : undefined,
					})
				}
			>
				<SelectTrigger
					aria-label={t("gm.library.sortAria")}
					className="w-auto min-w-0 flex-1 lg:flex-none"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="updated">{t("gm.library.sortUpdated")}</SelectItem>
					<SelectItem value="name">{t("gm.library.sortName")}</SelectItem>
					<SelectItem value="portrait">
						{t("gm.library.sortPortrait")}
					</SelectItem>
				</SelectContent>
			</Select>
			<SegmentedControl
				aria-label={t("gm.library.viewAria")}
				value={view}
				onValueChange={(value) =>
					setSearch({ view: value === "wall" ? "wall" : undefined })
				}
				itemClassName="whitespace-nowrap px-3"
				options={[
					{
						value: "list",
						label: (
							<>
								<List className="size-4" aria-hidden />
								<span className="sr-only lg:not-sr-only lg:whitespace-nowrap">
									{t("gm.library.viewList")}
								</span>
							</>
						),
					},
					{
						value: "wall",
						label: (
							<>
								<LayoutGrid className="size-4" aria-hidden />
								<span className="sr-only lg:not-sr-only lg:whitespace-nowrap">
									{t("gm.library.viewWall")}
								</span>
							</>
						),
					},
				]}
			/>
		</>
	);

	const toolbar = (
		<div className="flex flex-wrap items-center gap-2">
			<InputGroup className="h-10 min-w-0 flex-1 lg:basis-48">
				<InputGroupAddon>
					<Search />
				</InputGroupAddon>
				<InputGroupInput
					ref={searchRef}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setQuery("");
					}}
					placeholder={t("gm.library.searchPlaceholder")}
					aria-label={t("gm.library.searchAria")}
				/>
				<InputGroupAddon className="hidden lg:flex">
					<kbd className="rounded-xs border border-md-outline-variant px-1.5 font-mono text-label-small text-md-on-surface-variant">
						/
					</kbd>
				</InputGroupAddon>
			</InputGroup>
			<div className="flex min-w-0 items-center gap-2">
			{!wide ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"h-10 px-3 text-md-on-surface",
						activeFolderCount > 0 && "border-accent text-accent",
					)}
					onClick={() => setFiltersOpen(true)}
					aria-label={
						activeFolderCount > 0
							? t("gm.library.filtersActive", { count: activeFolderCount })
							: t("gm.library.filters")
					}
				>
					<SlidersHorizontal />
					{activeFolderCount > 0 ? (
						<span className="tabular-nums">{activeFolderCount}</span>
					) : null}
				</Button>
			) : null}
			{wide ? viewControls : null}
			</div>
		</div>
	);

	const inspector = selected ? (
		<CharacterInspector
			key={selected.id}
			item={selected}
			facets={facets}
			onBack={wide ? undefined : () => setSearch({ detail: undefined }, false)}
			onOpenSheet={openSheet}
			onImportUpdate={(id) => {
				setImportTargetId(id);
				setImportOpen(true);
			}}
			onChanged={() => void library.reload()}
			onDeleted={() => {
				setSearch({ sel: undefined, detail: undefined });
				void library.reload();
			}}
		/>
	) : null;

	const header = (
		<div className="flex items-center justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-2">
				<h1 className="truncate text-title-large text-md-on-surface">
					{scopeTitle}
				</h1>
				{activeFolderCount > 0 || search.q ? (
					<span className="shrink-0 text-label-large tabular-nums text-md-on-surface-variant">
						{t("gm.library.count", { count: library.total })}
					</span>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{canImport ? (
					<Button
						type="button"
						variant="text"
						size="sm"
						className="text-md-on-surface"
						onClick={() => {
							setImportTargetId(null);
							setImportOpen(true);
						}}
						aria-label={t("gm.library.import")}
					>
						<FileSpreadsheet />
						<span className="hidden sm:inline">{t("gm.library.import")}</span>
					</Button>
				) : null}
				<Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
					<Plus />
					{wide ? t("gm.library.create") : t("gm.library.createShort")}
				</Button>
			</div>
		</div>
	);

	return (
		<AdminLayout bleed>
			<h2 className="sr-only">{t("gm.library.title")}</h2>
			{wide ? (
				<div className="flex h-full min-h-0">
					<aside
						data-scroll
						className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-md-outline-variant/60 bg-md-surface pb-6 xl:w-64"
					>
						<LibraryRulePicker
							rules={ruleOptions}
							activeRuleId={ruleId ?? ""}
							onSelect={changeRule}
						/>
						<LibraryFolders
							facets={facets}
							ruleTotal={ruleTotal}
							state={folderState}
							onChange={changeFolders}
						/>
					</aside>
					<section className="flex min-w-0 flex-1 flex-col">
						<div className="flex flex-col gap-3 border-b border-md-outline-variant/60 px-5 pt-5 pb-4">
							{header}
							{toolbar}
						</div>
						<div ref={resultsRef} data-scroll className="min-h-0 flex-1 overflow-y-auto">
							{results}
						</div>
					</section>
					<aside
						data-scroll
						className="w-[22rem] shrink-0 overflow-y-auto border-l border-md-outline-variant/60 bg-md-surface-container xl:w-[26rem]"
					>
						{inspector ?? (
							<p className="p-8 text-center text-body-medium text-md-on-surface-variant">
								{items.length > 0 ? t("gm.library.noSelection") : null}
							</p>
						)}
					</aside>
				</div>
			) : search.detail && inspector ? (
				<div className="min-h-full bg-md-surface-container">{inspector}</div>
			) : (
				<div className="flex min-h-full flex-col">
					<div className="flex flex-col gap-3 border-b border-md-outline-variant/60 bg-md-surface px-4 pt-4 pb-3">
						<LibraryRulePicker
							compact
							rules={ruleOptions}
							activeRuleId={ruleId ?? ""}
							onSelect={changeRule}
						/>
						{header}
					</div>
					<div className="sticky top-0 z-20 border-b border-md-outline-variant/60 bg-md-surface-container-low px-4 py-3">
						{toolbar}
					</div>
					<div ref={resultsRef} className={cn("flex-1")}>
						{results}
					</div>
					<Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
						<SheetContent side="bottom" className="max-h-[80vh]">
							<SheetHeader>
								<SheetTitle>{t("gm.library.filters")}</SheetTitle>
							</SheetHeader>
							<SheetBody className="px-0">
								<div className="flex items-center gap-2 px-5 pb-3">
									{viewControls}
								</div>
								<LibraryFolders
									facets={facets}
									ruleTotal={ruleTotal}
									state={folderState}
									onChange={(next) => {
										changeFolders(next);
									}}
								/>
							</SheetBody>
						</SheetContent>
					</Sheet>
				</div>
			)}
			<CreateCharacterDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				fixedRuleId={ruleId}
				defaultKind={search.kind ?? "pc"}
				onCreated={(created) => {
					// 在某个模组的视图里新建，直接归入该模组
					const moduleId =
						search.module && search.module !== "none" ? search.module : null;
					void (
						moduleId
							? api(`/gm/modules/${encodeURIComponent(moduleId)}/characters`, {
									method: "POST",
									body: JSON.stringify({ characterId: created.id }),
								}).catch(() => undefined)
							: Promise.resolve()
					).then(() => openSheet(created.id));
				}}
			/>
			<ImportCharacterSheetDialog
				open={importOpen}
				onOpenChange={(open) => {
					setImportOpen(open);
					if (!open) setImportTargetId(null);
				}}
				onImported={() => void library.reload()}
				updateCharacterId={importTargetId}
				ruleId={ruleId}
			/>
		</AdminLayout>
	);
}
