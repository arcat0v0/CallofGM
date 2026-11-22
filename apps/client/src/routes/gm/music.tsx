import type {
	GmTrackLibraryItemDto,
	ModuleDto,
	ModuleSummaryDto,
	TrackDto,
} from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AudioLines, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import {
	AddTracksDialog,
	type AddTracksTab,
} from "@/features/gm-music/add-tracks-dialog";
import { AuditionBar } from "@/features/gm-music/audition-bar";
import { MusicToolbar } from "@/features/gm-music/music-toolbar";
import {
	ModuleNav,
	ModulePicker,
	type MusicModuleOption,
} from "@/features/gm-music/module-nav";
import {
	ALL_MODULES,
	filterTracks,
	formatTotalDuration,
	type LibraryTrack,
	libraryStats,
	sortTracks,
	type TrackSort,
	type TrackTypeFilter,
} from "@/features/gm-music/music-library-model";
import {
	TrackLedger,
	type LedgerEmpty,
} from "@/features/gm-music/track-ledger";
import type { TrackRowAction } from "@/features/gm-music/track-row";
import { useAudition } from "@/features/gm-music/use-audition";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { readGmMusicModule, writeGmMusicModule } from "@/lib/storage";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type MusicSearch = { module?: string };

export const Route = createFileRoute("/gm/music")({
	validateSearch: (search: Record<string, unknown>): MusicSearch => ({
		module:
			typeof search.module === "string" && search.module
				? search.module
				: undefined,
	}),
	beforeLoad: requireGmAuth,
	component: MusicLibraryPage,
});

type DeleteTarget = { tracks: LibraryTrack[] } | null;

function MusicLibraryPage() {
	useI18nVersion();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const wide = useMediaQuery("(min-width: 1024px)", true);
	const audition = useAudition();

	const [modules, setModules] = useState<ModuleDto[]>([]);
	const [counts, setCounts] = useState<Map<string, number>>(new Map());
	const [modulesReady, setModulesReady] = useState(false);
	const [tracks, setTracks] = useState<LibraryTrack[]>([]);
	const [tracksReady, setTracksReady] = useState(false);

	const [type, setType] = useState<TrackTypeFilter>("all");
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<TrackSort>("added");
	const [selection, setSelection] = useState<Set<string>>(new Set());
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [addTab, setAddTab] = useState<AddTracksTab>("upload");
	const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
	const [dragging, setDragging] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);

	const moduleIds = useMemo(() => modules.map((module) => module.id), [modules]);
	// URL 优先，其次是上次使用的模组，最后落到第一个模组
	const stored = readGmMusicModule();
	const isValid = (id: string | null | undefined): id is string =>
		Boolean(id) && (id === ALL_MODULES || moduleIds.includes(id as string));
	const activeId = !modulesReady
		? ""
		: isValid(search.module)
			? search.module
			: isValid(stored)
				? stored
				: (moduleIds[0] ?? ALL_MODULES);
	const activeModule = modules.find((module) => module.id === activeId);
	const isAllView = activeId === ALL_MODULES;

	useEffect(() => {
		if (activeId) {
			writeGmMusicModule(activeId);
		}
	}, [activeId]);

	const loadCounts = useCallback(async () => {
		try {
			const summaries = await api<ModuleSummaryDto[]>("/gm/modules/summaries");
			setCounts(
				new Map(summaries.map((item) => [item.moduleId, item.trackCount])),
			);
		} catch {
			// 计数只是辅助信息，失败时保留旧值
		}
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				setModules(await fetchAllPages<ModuleDto>("/gm/modules"));
				await loadCounts();
			} catch (error) {
				toast.error(errorText(error, "gm.music.loadModulesFailed"));
			} finally {
				setModulesReady(true);
			}
		})();
	}, [loadCounts]);

	useEffect(() => {
		if (!activeId) {
			return;
		}
		let cancelled = false;
		setTracksReady(false);
		const path = isAllView
			? "/gm/modules/tracks"
			: `/gm/modules/${encodeURIComponent(activeId)}/tracks`;
		void fetchAllPages<GmTrackLibraryItemDto | TrackDto>(path)
			.then((items) => {
				if (cancelled) {
					return;
				}
				const owner = modules.find((module) => module.id === activeId);
				setTracks(
					items.map((item) => ({
						...item,
						moduleName:
							"moduleName" in item ? item.moduleName : owner?.name,
					})),
				);
			})
			.catch((error) => {
				if (!cancelled) {
					setTracks([]);
					toast.error(errorText(error, "gm.music.loadTracksFailed"));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setTracksReady(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [activeId, isAllView, modules]);

	const selectModule = useCallback(
		(id: string) => {
			setSelection(new Set());
			setRenamingId(null);
			setQuery("");
			setType("all");
			void navigate({ search: { module: id }, replace: true });
		},
		[navigate],
	);

	const visible = useMemo(
		() => sortTracks(filterTracks(tracks, { type, query }), sort),
		[tracks, type, query, sort],
	);
	const stats = useMemo(() => libraryStats(tracks), [tracks]);
	const empty: LedgerEmpty = !tracksReady
		? null
		: tracks.length === 0
			? isAllView
				? "all"
				: "module"
			: visible.length === 0
				? "filtered"
				: null;

	const moduleOptions: MusicModuleOption[] = modules.map((module) => ({
		id: module.id,
		name: module.name,
		count: counts.get(module.id) ?? 0,
	}));
	const totalCount = moduleOptions.reduce((sum, item) => sum + item.count, 0);

	function addLocal(track: TrackDto) {
		setTracks((current) =>
			current.some((item) => item.id === track.id)
				? current
				: [...current, { ...track, moduleName: activeModule?.name }],
		);
		void loadCounts();
	}

	function removeLocal(ids: readonly string[]) {
		const gone = new Set(ids);
		setTracks((current) => current.filter((item) => !gone.has(item.id)));
		setSelection((current) => {
			const next = new Set(current);
			for (const id of ids) {
				next.delete(id);
			}
			return next;
		});
		if (audition.track && gone.has(audition.track.id)) {
			audition.stop();
		}
		void loadCounts();
	}

	async function patchTrack(
		track: LibraryTrack,
		patch: { name?: string; type?: TrackDto["type"] },
	) {
		const updated = await api<TrackDto>(
			`/gm/modules/tracks/${encodeURIComponent(track.id)}`,
			{ method: "PATCH", body: JSON.stringify(patch) },
		);
		setTracks((current) =>
			current.map((item) =>
				item.id === track.id ? { ...item, ...updated } : item,
			),
		);
	}

	async function commitRename(track: LibraryTrack, name: string) {
		const trimmed = name.trim();
		setRenamingId(null);
		if (!trimmed || trimmed === track.name) {
			return;
		}
		try {
			await patchTrack(track, { name: trimmed });
		} catch (error) {
			toast.error(
				isApiError(error) ? error.message : t("gm.music.renameFailed"),
			);
		}
	}

	async function runBulk(
		targets: readonly LibraryTrack[],
		job: (track: LibraryTrack) => Promise<void>,
	) {
		let done = 0;
		let failed = 0;
		for (const track of targets) {
			try {
				await job(track);
				done += 1;
			} catch {
				failed += 1;
			}
		}
		if (failed === 0) {
			toast.success(t("gm.music.bulkDone", { count: done }));
		} else {
			toast.error(t("gm.music.bulkPartial", { done, failed }));
		}
	}

	async function retype(targets: readonly LibraryTrack[], next: TrackDto["type"]) {
		const changing = targets.filter((track) => track.type !== next);
		await runBulk(changing, (track) => patchTrack(track, { type: next }));
		setSelection(new Set());
	}

	async function confirmDelete() {
		const target = deleteTarget;
		setDeleteTarget(null);
		if (!target) {
			return;
		}
		const removed: string[] = [];
		await runBulk(target.tracks, async (track) => {
			await api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
				method: "DELETE",
			});
			removed.push(track.id);
		});
		removeLocal(removed);
	}

	function handleAction(track: LibraryTrack, action: TrackRowAction) {
		if (action === "rename") {
			setRenamingId(track.id);
		} else if (action === "retype") {
			void retype([track], track.type === "bgm" ? "se" : "bgm");
		} else if (action === "select") {
			toggleSelect(track);
		} else {
			setDeleteTarget({ tracks: [track] });
		}
	}

	function toggleSelect(track: LibraryTrack) {
		setSelection((current) => {
			const next = new Set(current);
			if (next.has(track.id)) {
				next.delete(track.id);
			} else {
				next.add(track.id);
			}
			return next;
		});
	}

	function openAdd(tab: AddTracksTab = "upload") {
		if (!activeModule) {
			return;
		}
		setAddTab(tab);
		setAddOpen(true);
	}

	const selectedTracks = tracks.filter((track) => selection.has(track.id));

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const target = event.target;
			const typing =
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
			if (event.key === "/" && !typing) {
				event.preventDefault();
				searchRef.current?.focus();
			} else if (event.key === "Escape" && !typing) {
				setSelection((current) => (current.size > 0 ? new Set() : current));
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	function hasFiles(event: React.DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes("Files");
	}

	const stage = (
		<div
			className="relative flex min-h-0 flex-1 flex-col"
			onDragOver={(event) => {
				if (hasFiles(event)) {
					event.preventDefault();
					if (!isAllView) {
						setDragging(true);
					}
				}
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setDragging(false);
				}
			}}
			onDrop={(event) => {
				if (!hasFiles(event)) {
					return;
				}
				event.preventDefault();
				setDragging(false);
				if (isAllView || !activeModule) {
					toast.message(t("gm.music.dropNeedModule"));
					return;
				}
				setDroppedFiles(Array.from(event.dataTransfer.files));
				setAddTab("upload");
				setAddOpen(true);
			}}
		>
			{dragging && activeModule ? (
				<div
					role="status"
					className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-lg border-2 border-dashed border-accent bg-md-surface/85 text-title-medium text-accent"
				>
					{t("gm.music.dropActive", { module: activeModule.name })}
				</div>
			) : null}
			<div className="flex flex-col gap-1 px-4 pt-5 md:px-6">
				<div className="flex min-h-10 items-center gap-3">
					<h1 className="min-w-0 flex-1 truncate text-headline-small-emph text-md-on-surface">
						{isAllView ? t("gm.music.allTracks") : (activeModule?.name ?? "")}
					</h1>
					{!isAllView && activeModule ? (
						<Button type="button" size="sm" onClick={() => openAdd("upload")}>
							<Plus />
							{t("gm.music.add")}
						</Button>
					) : null}
				</div>
				<p
					data-music-stats
					className="min-h-5 text-body-medium tabular-nums text-md-on-surface-variant"
				>
					{tracksReady ? (
						<>
							{t("gm.music.statsCount", { count: stats.count })}
							{stats.count > 0 ? (
								<>
									{" · "}
									<span className="font-mono">
										{formatTotalDuration(stats.totalMs)}
									</span>
								</>
							) : null}
						</>
					) : null}
				</p>
				{isAllView ? (
					<p className="text-body-small text-md-on-surface-variant">
						{t("gm.music.pickModuleHint")}
					</p>
				) : null}
			</div>
			<MusicToolbar
				visible={tracks.length > 0}
				query={query}
				onQueryChange={setQuery}
				type={type}
				onTypeChange={setType}
				sort={sort}
				onSortChange={setSort}
				selectedCount={selection.size}
				onClearSelection={() => setSelection(new Set())}
				onBulkRetype={(next) => void retype(selectedTracks, next)}
				onBulkDelete={() => setDeleteTarget({ tracks: selectedTracks })}
				searchRef={searchRef}
			/>
			<div
				data-scroll
				className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-8 md:px-6")}
			>
				{tracksReady ? (
					<TrackLedger
						tracks={visible}
						groupByModule={isAllView}
						moduleOrder={moduleIds}
						empty={empty}
						auditionId={audition.track?.id ?? null}
						auditionProgress={
							audition.track
								? audition.positionMs / Math.max(1, audition.track.duration)
								: 0
						}
						selection={selection}
						renamingId={renamingId}
						onToggleAudition={audition.toggle}
						onToggleSelect={toggleSelect}
						onAction={handleAction}
						onRenameCommit={(track, name) => void commitRename(track, name)}
						onRenameCancel={() => setRenamingId(null)}
						onClearFilters={() => {
							setQuery("");
							setType("all");
						}}
					/>
				) : (
					<div aria-busy className="flex flex-col">
						{[0, 1, 2, 3].map((row) => (
							<div
								key={row}
								className="h-11 animate-pulse border-b border-md-outline-variant/40"
							/>
						))}
					</div>
				)}
			</div>
			{audition.track ? (
				<AuditionBar
					track={audition.track}
					positionMs={audition.positionMs}
					volume={audition.volume}
					onStop={audition.stop}
					onSeek={audition.seek}
					onVolume={audition.setVolume}
				/>
			) : null}
		</div>
	);

	return (
		<AdminLayout bleed>
			{modulesReady && modules.length === 0 ? (
				<div className="p-6">
					<EmptyState
						icon={AudioLines}
						title={t("gm.music.noModulesTitle")}
						description={t("gm.music.noModulesHint")}
						action={
							<Button asChild variant="tonal" size="sm">
								<Link to="/gm/modules">{t("gm.music.goModules")}</Link>
							</Button>
						}
					/>
				</div>
			) : wide ? (
				<div className="flex h-full min-h-0">
					<aside
						data-scroll
						className="flex w-60 shrink-0 flex-col border-r border-md-outline-variant/60 bg-md-surface xl:w-64"
					>
						<ModuleNav
							modules={moduleOptions}
							totalCount={totalCount}
							activeId={activeId}
							onSelect={selectModule}
						/>
					</aside>
					{stage}
				</div>
			) : (
				<div className="flex h-full min-h-0 flex-col">
					<div className="border-b border-md-outline-variant/60 bg-md-surface px-4 py-3">
						<ModulePicker
							modules={moduleOptions}
							totalCount={totalCount}
							activeId={activeId}
							onSelect={selectModule}
						/>
					</div>
					{stage}
				</div>
			)}
			{activeModule ? (
				<AddTracksDialog
					open={addOpen}
					onOpenChange={setAddOpen}
					moduleId={activeModule.id}
					moduleName={activeModule.name}
					tracks={tracks}
					defaultTab={addTab}
					droppedFiles={droppedFiles}
					onDroppedFilesConsumed={() => setDroppedFiles([])}
					onAdded={addLocal}
				/>
			) : null}
			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				icon={Trash2}
				title={
					deleteTarget && deleteTarget.tracks.length > 1
						? t("gm.music.bulkDeleteTitle", {
								count: deleteTarget.tracks.length,
							})
						: t("gm.music.deleteTitle")
				}
				description={
					deleteTarget && deleteTarget.tracks.length > 1
						? t("gm.music.bulkDeleteDescription", {
								count: deleteTarget.tracks.length,
							})
						: t("gm.music.deleteDescription", {
								name: deleteTarget?.tracks[0]?.name ?? "",
							})
				}
				confirmLabel={t("gm.music.menuDelete")}
				confirmIcon={Trash2}
				onConfirm={() => void confirmDelete()}
			/>
		</AdminLayout>
	);
}
