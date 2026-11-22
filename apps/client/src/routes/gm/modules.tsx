import type {
	ModuleDto,
	ModuleSummaryDto,
	ThemeSummaryDto,
} from "@cogm/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowUpDown,
	LayoutGrid,
	LayoutList,
	Package,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
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
import { CreateModuleDialog } from "@/features/gm-admin/dialogs/create-module-dialog";
import { LibraryNavigation } from "@/features/gm-admin/library-navigation";
import {
	type EnrichedModule,
	enrichModules,
	filterAndSortModules,
	type ModulesSearch,
	type ModulesSort,
	parseModulesSearch,
} from "@/features/gm-modules/module-model";
import {
	ModuleGallery,
	ModuleLedger,
} from "@/features/gm-modules/module-results";
import {
	type ModuleFolderState,
	ModuleFolders,
} from "@/features/gm-modules/module-sidebar";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { listThemes } from "@/themes/themes-api";

export const Route = createFileRoute("/gm/modules")({
	validateSearch: (search: Record<string, unknown>): ModulesSearch =>
		parseModulesSearch(search),
	beforeLoad: requireGmAuth,
	component: GmModulesPage,
});

function isTypingTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

function GmModulesPage() {
	useI18nVersion();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const wide = useMediaQuery("(min-width: 1024px)", true);
	const { rules } = useRuleOptions();
	const ruleIds = useMemo(() => rules.map((rule) => rule.id), [rules]);

	const [modules, setModules] = useState<ModuleDto[]>([]);
	const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
	const [summaries, setSummaries] = useState<ModuleSummaryDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<unknown>(null);

	const [query, setQuery] = useState(search.q ?? "");
	const [createOpen, setCreateOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<EnrichedModule | null>(null);
	const [themeTarget, setThemeTarget] = useState<EnrichedModule | null>(null);
	const [themeDraft, setThemeDraft] = useState<string>("default");
	const [themeSaving, setThemeSaving] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);

	const view = search.view ?? "gallery";
	const currentSort: ModulesSort = search.sort ?? "updated";

	const setSearch = useCallback(
		(patch: Partial<ModulesSearch>, replace = true) =>
			void navigate({
				search: (prev: ModulesSearch) => ({ ...prev, ...patch }),
				replace,
			}),
		[navigate],
	);

	const reload = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const [nextModules, nextSummaries] = await Promise.all([
				fetchAllPages<ModuleDto>("/gm/modules"),
				api<ModuleSummaryDto[]>("/gm/modules/summaries"),
			]);
			setModules(nextModules);
			setSummaries(Array.isArray(nextSummaries) ? nextSummaries : []);
		} catch (error) {
			setLoadError(error);
			toast.error(errorText(error, "gm.modules.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
		void listThemes()
			.then((list) => setThemes(Array.isArray(list) ? list : []))
			.catch(() => undefined);
	}, [reload]);

	// 搜索输入防抖后同步 URL
	useEffect(() => {
		const handle = window.setTimeout(() => {
			const next = query.trim() || undefined;
			if (next !== search.q) setSearch({ q: next });
		}, 180);
		return () => window.clearTimeout(handle);
	}, [query, search.q, setSearch]);

	// 键盘快捷键：/ 聚焦搜索
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (
				event.defaultPrevented ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}
			if (event.key === "/" && !isTypingTarget(event.target)) {
				event.preventDefault();
				searchRef.current?.focus();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const enriched = useMemo(
		() => enrichModules(modules, summaries, themes),
		[modules, summaries, themes],
	);
	const visible = useMemo(
		() => filterAndSortModules(enriched, search),
		[enriched, search],
	);

	const folderState: ModuleFolderState = {
		rule: search.rule,
		status: search.status,
	};
	const activeFilterCount = [search.rule, search.status].filter(Boolean).length;

	// 移动端横向快速筛选芯片数据（与桌面端全分面一致，规则与备团状态以竖线分隔）
	const quickFacets = useMemo(() => {
		const counts = new Map<string, number>();
		for (const entry of enriched) {
			counts.set(
				entry.module.ruleId,
				(counts.get(entry.module.ruleId) ?? 0) + 1,
			);
		}
		const allRules = Array.from(
			new Set([...ruleIds, ...enriched.map((item) => item.module.ruleId)]),
		).map((id) => ({
			id,
			label: getRuleComponent(id).shortName,
			count: counts.get(id) ?? 0,
		}));
		const readyCount = enriched.filter((entry) => entry.assetTotal > 0).length;
		const emptyCount = enriched.filter((entry) => entry.assetTotal === 0).length;
		return { allRules, readyCount, emptyCount };
	}, [enriched, ruleIds]);

	const scopeParts = [
		search.rule ? getRuleComponent(search.rule).shortName : null,
		search.status === "ready"
			? t("gm.modules.statusReady")
			: search.status === "empty"
				? t("gm.modules.statusEmpty")
				: null,
	].filter((part): part is string => Boolean(part));
	const scopeTitle =
		scopeParts.length > 0 ? scopeParts.join(" · ") : t("gm.modules.scopeRoot");

	const clearAll = () => {
		setQuery("");
		setSearch({ rule: undefined, status: undefined, q: undefined });
	};

	const setSortValue = (value: ModulesSort) =>
		setSearch({
			sort: value === "updated" ? undefined : value,
		});

	async function commitTheme() {
		if (!themeTarget) return;
		setThemeSaving(true);
		try {
			await api(`/gm/modules/${encodeURIComponent(themeTarget.module.id)}`, {
				method: "PATCH",
				body: JSON.stringify({
					themeId: themeDraft === "default" ? null : themeDraft,
				}),
			});
			toast.success(t("gm.modules.themeUpdated"));
			setThemeTarget(null);
			await reload();
		} catch (error) {
			toast.error(errorText(error, "gm.modules.themeUpdateFailed"));
		} finally {
			setThemeSaving(false);
		}
	}

	const viewControls = (showSort: boolean) => (
		<>
			{showSort ? (
				<Select
					value={currentSort}
					onValueChange={(value) => setSortValue(value as ModulesSort)}
				>
					<SelectTrigger
						aria-label={t("gm.modules.sortAria")}
						className="h-10 w-auto min-w-0 flex-1 rounded-full px-4 lg:flex-none"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="updated">
							{t("gm.modules.sortUpdated")}
						</SelectItem>
						<SelectItem value="name">{t("gm.modules.sortName")}</SelectItem>
						<SelectItem value="assets">{t("gm.modules.sortAssets")}</SelectItem>
					</SelectContent>
				</Select>
			) : null}
			<SegmentedControl
				aria-label={t("gm.modules.viewAria")}
				value={view}
				onValueChange={(value) =>
					setSearch({ view: value === "ledger" ? "ledger" : undefined })
				}
				itemClassName="whitespace-nowrap px-3"
				options={[
					{
						value: "gallery",
						label: (
							<>
								<LayoutGrid className="size-4" aria-hidden />
								<span className="sr-only lg:not-sr-only lg:whitespace-nowrap">
									{t("gm.modules.viewGallery")}
								</span>
							</>
						),
					},
					{
						value: "ledger",
						label: (
							<>
								<LayoutList className="size-4" aria-hidden />
								<span className="sr-only lg:not-sr-only lg:whitespace-nowrap">
									{t("gm.modules.viewLedger")}
								</span>
							</>
						),
					},
				]}
			/>
		</>
	);

	const header = (
		<div className="flex items-center justify-between gap-3">
			<div className="flex min-w-0 items-baseline gap-2.5">
				<h1 className="truncate text-headline-small-emph text-md-on-surface">
					{scopeTitle}
				</h1>
				{!loading || modules.length > 0 ? (
					<span className="shrink-0 text-label-large tabular-nums text-md-on-surface-variant">
						{t("gm.modules.count", { count: visible.length })}
					</span>
				) : null}
			</div>
			<Button
				type="button"
				variant="primary"
				size="sm"
				onClick={() => setCreateOpen(true)}
			>
				<Plus />
				{wide ? t("gm.modules.new") : t("gm.modules.newShort")}
			</Button>
		</div>
	);

	const toolbar = (
		<div className="flex items-center gap-2">
			<InputGroup className="min-w-0 flex-1 rounded-full border-transparent bg-md-surface-container max-lg:h-11 lg:max-w-lg">
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput
					ref={searchRef}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setQuery("");
					}}
					placeholder={t("gm.modules.searchPlaceholder")}
					aria-label={t("gm.modules.searchAria")}
				/>
				<InputGroupAddon className="hidden lg:flex">
					<kbd className="rounded-sm bg-md-surface-container-high px-2 font-mono text-label-small text-md-on-surface-variant">
						/
					</kbd>
				</InputGroupAddon>
			</InputGroup>
			<div className="flex shrink-0 items-center gap-2 lg:ml-auto">
				{!wide ? (
					<>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							className="size-11"
							aria-label={
								view === "ledger"
									? t("gm.modules.switchToGallery")
									: t("gm.modules.switchToLedger")
							}
							onClick={() =>
								setSearch({
									view: view === "ledger" ? undefined : "ledger",
								})
							}
						>
							{view === "ledger" ? (
								<LayoutGrid className="size-4" />
							) : (
								<LayoutList className="size-4" />
							)}
						</Button>
						<Button
							type="button"
							variant={currentSort !== "updated" ? "tonal" : "outline"}
							size="icon-sm"
							className="size-11"
							onClick={() => setFiltersOpen(true)}
							aria-label={t("gm.modules.sortAndFilter")}
						>
							<ArrowUpDown className="size-4" />
						</Button>
					</>
				) : (
					// 台账模式下列表头即为主排序控件，隐藏顶部重复排序下拉
					viewControls(view !== "ledger")
				)}
			</div>
		</div>
	);

	const mobileQuickStrip =
		!wide && enriched.length > 0 ? (
			<div className="relative -mx-3">
				<div
					role="group"
					aria-label={t("gm.modules.filtersAria")}
					className="flex items-center gap-1.5 overflow-x-auto px-3 pr-10 py-0.5 [scrollbar-width:none]"
				>
					<button
						type="button"
						aria-pressed={!search.rule && !search.status}
						onClick={() => setSearch({ rule: undefined, status: undefined })}
						className={cn(
							"flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label-medium transition-colors",
							!search.rule && !search.status
								? "border-transparent bg-accent-soft text-accent-soft-foreground"
								: "border-md-outline-variant/65 bg-md-surface-container text-md-on-surface-variant",
						)}
					>
						<span>{t("gm.module.filterAll")}</span>
						<span className="font-mono text-label-small tabular-nums opacity-75">
							{enriched.length}
						</span>
					</button>

					<span
						aria-hidden
						className="mx-0.5 h-4 w-px shrink-0 bg-md-outline-variant/75"
					/>

					{quickFacets.allRules.map((rule) => {
						const active = search.rule === rule.id;
						return (
							<button
								key={rule.id}
								type="button"
								aria-pressed={active}
								onClick={() =>
									setSearch({ rule: active ? undefined : rule.id })
								}
								className={cn(
									"flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label-medium transition-colors",
									active
										? "border-transparent bg-accent-soft text-accent-soft-foreground"
										: "border-md-outline-variant/65 bg-md-surface-container text-md-on-surface-variant",
								)}
							>
								<span>{rule.label}</span>
								<span className="font-mono text-label-small tabular-nums opacity-75">
									{rule.count}
								</span>
							</button>
						);
					})}

					<span
						aria-hidden
						className="mx-0.5 h-4 w-px shrink-0 bg-md-outline-variant/75"
					/>

					<button
						type="button"
						aria-pressed={search.status === "ready"}
						onClick={() =>
							setSearch({
								status: search.status === "ready" ? undefined : "ready",
							})
						}
						className={cn(
							"flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label-medium transition-colors",
							search.status === "ready"
								? "border-transparent bg-accent-soft text-accent-soft-foreground"
								: "border-md-outline-variant/65 bg-md-surface-container text-md-on-surface-variant",
						)}
					>
						<span>{t("gm.modules.statusReady")}</span>
						<span className="font-mono text-label-small tabular-nums opacity-75">
							{quickFacets.readyCount}
						</span>
					</button>

					<button
						type="button"
						aria-pressed={search.status === "empty"}
						onClick={() =>
							setSearch({
								status: search.status === "empty" ? undefined : "empty",
							})
						}
						className={cn(
							"flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label-medium transition-colors",
							search.status === "empty"
								? "border-transparent bg-accent-soft text-accent-soft-foreground"
								: "border-md-outline-variant/65 bg-md-surface-container text-md-on-surface-variant",
						)}
					>
						<span>{t("gm.modules.statusEmpty")}</span>
						<span className="font-mono text-label-small tabular-nums opacity-75">
							{quickFacets.emptyCount}
						</span>
					</button>
				</div>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-md-surface to-transparent"
				/>
			</div>
		) : null;

	const results =
		loadError && modules.length === 0 ? (
			<EmptyState
				icon={Package}
				title={errorText(loadError, "gm.modules.loadFailed")}
				action={
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void reload()}
					>
						{t("gm.library.retry")}
					</Button>
				}
				className="bg-md-surface-container-low"
			/>
		) : loading && modules.length === 0 ? (
			<div
				aria-busy
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
			>
				{[0, 1, 2, 3, 4, 5].map((idx) => (
					<div
						key={idx}
						className="h-72 rounded-xl bg-md-surface-container-low motion-safe:animate-pulse"
					/>
				))}
			</div>
		) : modules.length === 0 ? (
			<EmptyState
				icon={Package}
				title={t("gm.modules.empty")}
				description={t("gm.modules.emptyHint")}
				action={
					<Button
						type="button"
						variant="primary"
						size="sm"
						onClick={() => setCreateOpen(true)}
					>
						<Plus />
						{t("gm.modules.new")}
					</Button>
				}
				className="bg-md-surface-container-low"
			/>
		) : visible.length === 0 ? (
			<EmptyState
				icon={Search}
				title={t("gm.modules.noResultsTitle")}
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
						{activeFilterCount > 0 ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={clearAll}
							>
								{t("gm.library.clearFilters")}
							</Button>
						) : null}
					</div>
				}
				className="bg-md-surface-container-low"
			/>
		) : view === "ledger" ? (
			<ModuleLedger
				items={visible}
				sort={currentSort}
				onChangeSort={setSortValue}
				onOpenTheme={(entry) => {
					setThemeTarget(entry);
					setThemeDraft(entry.module.themeId ?? "default");
				}}
				onDelete={(entry) => setDeleteTarget(entry)}
			/>
		) : (
			<ModuleGallery
				items={visible}
				onOpenTheme={(entry) => {
					setThemeTarget(entry);
					setThemeDraft(entry.module.themeId ?? "default");
				}}
				onDelete={(entry) => setDeleteTarget(entry)}
			/>
		);

	return (
		<AdminLayout bleed>
			{wide ? (
				<div className="flex h-full min-h-0 gap-3 bg-md-surface p-3 xl:gap-4 xl:p-4">
					<LibraryNavigation>
						<ModuleFolders
							items={enriched}
							ruleIds={ruleIds}
							state={folderState}
							onChange={(next) => setSearch(next)}
						/>
					</LibraryNavigation>
					<section className="flex min-w-0 flex-1 flex-col gap-3">
						<div className="flex flex-col gap-3 px-1 pt-1">
							{header}
							{toolbar}
						</div>
						<div data-scroll className="min-h-0 flex-1 overflow-y-auto">
							{results}
						</div>
					</section>
				</div>
			) : (
				<div className="flex min-h-full flex-col gap-3 bg-md-surface px-3 pt-3 pb-2">
					<div className="flex flex-col gap-3">
						{header}
						{toolbar}
						{mobileQuickStrip}
					</div>
					<div className="flex-1">{results}</div>
					<Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
						<SheetContent side="bottom" className="max-h-[80vh]">
							<SheetHeader>
								<SheetTitle>{t("gm.modules.sortAndFilter")}</SheetTitle>
							</SheetHeader>
							<SheetBody>
								<div className="flex items-center gap-2 pb-3">
									{viewControls(true)}
								</div>
								<ModuleFolders
									items={enriched}
									ruleIds={ruleIds}
									state={folderState}
									onChange={(next) => {
										setSearch(next);
										setFiltersOpen(false);
									}}
								/>
							</SheetBody>
						</SheetContent>
					</Sheet>
				</div>
			)}

			<CreateModuleDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				themes={themes}
				onCreated={() => void reload()}
			/>

			<Dialog
				open={themeTarget !== null}
				onOpenChange={(open) => !open && setThemeTarget(null)}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t("gm.modules.themeDialogTitle")}</DialogTitle>
						<DialogDescription>
							{t("gm.modules.themeDialogDescription", {
								name: themeTarget?.module.name ?? "",
							})}
						</DialogDescription>
					</DialogHeader>
					<Select value={themeDraft} onValueChange={setThemeDraft}>
						<SelectTrigger
							className="w-full"
							aria-label={t("gm.modules.themeAria", {
								name: themeTarget?.module.name ?? "",
							})}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="default">
								{t("gm.modules.themeDefault")}
							</SelectItem>
							{themes.map((theme) => (
								<SelectItem key={theme.id} value={theme.id}>
									{theme.name} ({theme.version})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DialogFooter>
						<Button
							type="button"
							variant="tertiary"
							onClick={() => setThemeTarget(null)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="button"
							variant="primary"
							disabled={themeSaving}
							onClick={() => void commitTheme()}
						>
							{t("gm.module.save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.modules.deleteTitle")}
				description={t("gm.modules.deleteDescription")}
				confirmLabel={t("gm.modules.deleteConfirm")}
				onConfirm={() => {
					const target = deleteTarget;
					setDeleteTarget(null);
					if (!target) return;
					void api(`/gm/modules/${encodeURIComponent(target.module.id)}`, {
						method: "DELETE",
					})
						.then(() => reload())
						.catch((error) =>
							toast.error(errorText(error, "gm.modules.deleteFailed")),
						);
				}}
			/>
		</AdminLayout>
	);
}
