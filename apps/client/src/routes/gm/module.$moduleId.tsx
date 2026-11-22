import type {
	CatalogHandoutDto,
	CharacterDto,
	ModuleDto,
	SceneDto,
	ThemeSummaryDto,
	TrackDto,
} from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Howl } from "howler";
import {
	ArrowLeftRight,
	Check,
	ChevronLeft,
	Disc3,
	Ellipsis,
	ExternalLink,
	Link2,
	Music2,
	Pause,
	Pencil,
	Play,
	Plus,
	Search,
	Trash2,
	Upload,
	Volume2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FilePicker } from "@/components/shared/file-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { InviteLinksDialog } from "@/features/gm-admin/invite-links-dialog";
import { trackSourceLabel } from "@/features/gm-console/gm-audio";
import { MusicSourcePanel } from "@/features/gm-console/music-source-panel";
import { ModuleCharactersTab } from "@/features/gm-modules/characters-tab";
import { ModuleHandoutsTab } from "@/features/gm-modules/handouts-tab";
import {
	type ModuleDetailSearch,
	type ModuleDetailTab,
	parseModuleDetailSearch,
} from "@/features/gm-modules/module-model";
import { ModuleScenesTab } from "@/features/gm-modules/scenes-tab";
import { ModuleSettingsTab } from "@/features/gm-modules/settings-tab";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, mediaUrl } from "@/lib/api";
import { audioDurationMs } from "@/lib/audio-duration";
import { errorText } from "@/lib/errors";
import { formatDurationMmSs } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";
import { uploadMediaAsset } from "@/lib/media-upload";
import { trackPlaybackFormat } from "@/lib/music-playback";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { listThemes } from "@/themes/themes-api";

export const Route = createFileRoute("/gm/module/$moduleId")({
	validateSearch: (search: Record<string, unknown>): ModuleDetailSearch =>
		parseModuleDetailSearch(search),
	beforeLoad: requireGmAuth,
	component: ModuleDetailPage,
});

function padTrackIndex(index: number) {
	return String(index + 1).padStart(2, "0");
}

function trackPlaybackSrc(track: TrackDto): string | null {
	if (track.source !== "upload") {
		return `/api/v1/music/tracks/${encodeURIComponent(track.id)}/stream`;
	}
	return mediaUrl(track.audioAssetId);
}

function TrackStudioRow({
	track,
	index,
	previewing,
	onTogglePreview,
	onReload,
	onRequestDelete,
}: {
	track: TrackDto;
	index: number;
	previewing: boolean;
	onTogglePreview: () => void;
	onReload: () => Promise<void>;
	onRequestDelete: () => void;
}) {
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(track.name);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setDraftName(track.name);
	}, [track.name]);

	async function commitRename() {
		const trimmed = draftName.trim();
		if (!trimmed || trimmed === track.name) {
			setRenaming(false);
			setDraftName(track.name);
			return;
		}
		setBusy(true);
		try {
			await api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ name: trimmed }),
			});
			setRenaming(false);
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setBusy(false);
		}
	}

	async function toggleType() {
		setBusy(true);
		try {
			await api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ type: track.type === "bgm" ? "se" : "bgm" }),
			});
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setBusy(false);
		}
	}

	// 本地上传且无艺术家时不重复展示“本地上传”噪声副标题，仅展示外部来源或艺术家
	const subtitle = [
		track.source !== "upload" ? trackSourceLabel(track.source) : null,
		track.artists.length > 0 ? track.artists.join(" / ") : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<li
			className={cn(
				"flex items-center gap-3 px-3.5 py-2.5 transition-colors",
				previewing
					? "bg-md-surface-container-high"
					: "hover:bg-md-surface-container-high/50",
			)}
		>
			<span className="w-5 shrink-0 font-mono text-label-small tabular-nums text-md-on-surface-variant">
				{padTrackIndex(index)}
			</span>

			<Button
				type="button"
				variant={previewing ? "accentSoft" : "ghost"}
				size="icon-sm"
				className={cn(
					"size-8 shrink-0 rounded-full border transition-colors",
					previewing
						? "border-accent/45"
						: "border-md-outline-variant/80 bg-md-surface-container-low text-md-on-surface hover:border-accent/60 hover:text-accent",
				)}
				aria-label={
					previewing
						? t("gm.music.previewStopAria", { name: track.name })
						: t("gm.music.previewAria", { name: track.name })
				}
				onClick={onTogglePreview}
			>
				{previewing ? (
					<Pause className="size-3.5 fill-current" />
				) : (
					<Play className="ml-0.5 size-3.5 fill-current" />
				)}
			</Button>

			{renaming ? (
				<form
					className="flex min-w-0 flex-1 items-center gap-1.5"
					onSubmit={(event) => {
						event.preventDefault();
						void commitRename();
					}}
				>
					<Input
						value={draftName}
						autoFocus
						disabled={busy}
						aria-label={t("gm.module.trackAria", { name: track.name })}
						onChange={(event) => setDraftName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								setRenaming(false);
								setDraftName(track.name);
							}
						}}
						className="h-8 min-w-0 flex-1 rounded-sm"
					/>
					<Button
						type="submit"
						variant="primary"
						size="icon-sm"
						disabled={busy || !draftName.trim()}
						aria-label={t("gm.module.save")}
						className="size-8 shrink-0"
					>
						<Check className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={busy}
						aria-label={t("common.cancel")}
						className="size-8 shrink-0"
						onClick={() => {
							setRenaming(false);
							setDraftName(track.name);
						}}
					>
						<X className="size-4" />
					</Button>
				</form>
			) : (
				<div className="flex min-w-0 flex-1 flex-col">
					<span
						className={cn(
							"truncate text-body-medium-emph",
							previewing ? "text-accent" : "text-md-on-surface",
						)}
					>
						{track.name}
					</span>
					{subtitle ? (
						<span className="truncate text-body-small text-md-on-surface-variant">
							{subtitle}
						</span>
					) : null}
				</div>
			)}

			{!renaming ? (
				<div className="flex shrink-0 items-center gap-1">
					<span className="w-12 text-right font-mono text-label-medium tabular-nums text-md-on-surface-variant">
						{formatDurationMmSs(track.duration)}
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								disabled={busy}
								aria-label={t("gm.module.trackActionsAria", {
									name: track.name,
								})}
								className="size-10 rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface sm:size-9"
							>
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setRenaming(true)}>
								<Pencil />
								{t("gm.module.rename")}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => void toggleType()}>
								<ArrowLeftRight />
								{track.type === "bgm"
									? t("gm.module.switchToSe")
									: t("gm.module.switchToBgm")}
							</DropdownMenuItem>
							{track.sourceUrl ? (
								<DropdownMenuItem asChild>
									<a href={track.sourceUrl} target="_blank" rel="noreferrer">
										<ExternalLink />
										{t("gm.module.openSourceLink")}
									</a>
								</DropdownMenuItem>
							) : null}
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={onRequestDelete}>
								<Trash2 />
								{t("gm.module.deleteTrackTitle")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			) : null}
		</li>
	);
}

function ModuleDetailPage() {
	useI18nVersion();
	const { moduleId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const activeTab: ModuleDetailTab = search.tab ?? "scenes";

	const [module, setModule] = useState<ModuleDto | null>(null);
	const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
	const [scenes, setScenes] = useState<SceneDto[]>([]);
	const [tracks, setTracks] = useState<TrackDto[]>([]);
	const [handouts, setHandouts] = useState<CatalogHandoutDto[]>([]);
	const [linkedCount, setLinkedCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<unknown>(null);

	// 音乐上传、拖放、搜索与试听状态
	const [trackQuery, setTrackQuery] = useState("");
	const [trackName, setTrackName] = useState("");
	const [trackFileName, setTrackFileName] = useState("");
	const [droppedFile, setDroppedFile] = useState<File | null>(null);
	const [dropTarget, setDropTarget] = useState<"bgm" | "se" | null>(null);
	const [trackType, setTrackType] = useState<"bgm" | "se">("bgm");
	const [uploadingTrack, setUploadingTrack] = useState(false);
	const [platformOpen, setPlatformOpen] = useState(false);
	const [deleteTrackTarget, setDeleteTrackTarget] = useState<TrackDto | null>(
		null,
	);
	const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
	const previewRef = useRef<Howl | null>(null);
	const audioFormRef = useRef<HTMLFormElement | null>(null);

	const [invitesOpen, setInvitesOpen] = useState(false);

	const setTab = useCallback(
		(tab: ModuleDetailTab) => {
			void navigate({
				search: (prev: ModuleDetailSearch) => ({
					...prev,
					tab: tab === "scenes" ? undefined : tab,
				}),
				replace: true,
			});
		},
		[navigate],
	);

	const stopPreview = useCallback(() => {
		previewRef.current?.unload();
		previewRef.current = null;
		setPreviewTrackId(null);
	}, []);

	useEffect(() => () => stopPreview(), [stopPreview]);
	useEffect(() => {
		if (activeTab !== "music") stopPreview();
	}, [activeTab, stopPreview]);

	const reload = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const [mod, nextScenes, nextTracks, nextHandouts, nextLinked] =
				await Promise.all([
					api<ModuleDto>(`/gm/modules/${encodeURIComponent(moduleId)}`),
					fetchAllPages<SceneDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/scenes`,
					),
					fetchAllPages<TrackDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
					),
					fetchAllPages<CatalogHandoutDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/handouts`,
					),
					fetchAllPages<CharacterDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/characters`,
					),
				]);
			setModule(mod);
			setScenes(nextScenes);
			setTracks(nextTracks);
			setHandouts(nextHandouts);
			setLinkedCount(nextLinked.length);
		} catch (error) {
			setLoadError(error);
			toast.error(errorText(error, "gm.module.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, [moduleId]);

	useEffect(() => {
		void reload();
		void listThemes()
			.then((list) => setThemes(Array.isArray(list) ? list : []))
			.catch(() => undefined);
	}, [reload]);

	function togglePreview(track: TrackDto) {
		if (previewTrackId === track.id) {
			stopPreview();
			return;
		}
		stopPreview();
		const src = trackPlaybackSrc(track);
		if (!src) {
			toast.error(t("gm.music.audioUnavailable"));
			return;
		}
		const howl = new Howl({
			src: [src],
			format: [trackPlaybackFormat(track.source)],
			html5: true,
			xhr: { withCredentials: true },
			volume: 0.8,
			onloaderror: () => {
				toast.error(t("gm.music.audioUnavailable"));
				stopPreview();
			},
			onplayerror: () => {
				toast.error(t("gm.music.audioUnavailable"));
				stopPreview();
			},
		});
		howl.once("end", () => {
			if (previewRef.current === howl) {
				previewRef.current = null;
				setPreviewTrackId(null);
			}
			howl.unload();
		});
		howl.play();
		previewRef.current = howl;
		setPreviewTrackId(track.id);
	}

	function clearPendingAudio() {
		setTrackName("");
		setTrackFileName("");
		setDroppedFile(null);
		const fileInput = audioFormRef.current?.querySelector<HTMLInputElement>(
			'input[name="audio"]',
		);
		if (fileInput) fileInput.value = "";
	}

	function handleDeckDrop(
		event: React.DragEvent<HTMLElement>,
		targetType: "bgm" | "se",
	) {
		event.preventDefault();
		setDropTarget(null);
		const file = event.dataTransfer.files?.[0];
		if (!file) return;
		setTrackType(targetType);
		setDroppedFile(file);
		setTrackFileName(file.name);
	}

	const ruleComponent = module ? getRuleComponent(module.ruleId) : null;
	const activeThemeName = module?.themeId
		? (themes.find((item) => item.id === module.themeId)?.name ??
			module.themeId)
		: null;

	const trackNeedle = trackQuery.trim().toLowerCase();
	const filteredTracks = trackNeedle
		? tracks.filter((track) =>
				[track.name, ...track.artists].some((value) =>
					value.toLowerCase().includes(trackNeedle),
				),
			)
		: tracks;
	const bgmTracks = filteredTracks.filter((track) => track.type === "bgm");
	const seTracks = filteredTracks.filter((track) => track.type === "se");
	const hasAnyArtist = tracks.some((track) => track.artists.length > 0);

	const tabs: Array<{
		id: ModuleDetailTab;
		label: string;
		count?: number;
	}> = [
		{
			id: "scenes",
			label: t("gm.module.tabLabelScenes"),
			count: scenes.length,
		},
		{
			id: "characters",
			label: t("gm.module.tabLabelCharacters"),
			count: linkedCount,
		},
		{
			id: "music",
			label: t("gm.module.tabLabelMusic"),
			count: tracks.length,
		},
		{
			id: "handouts",
			label: t("gm.module.tabLabelHandouts"),
			count: handouts.length,
		},
		{
			id: "settings",
			label: t("gm.module.tabLabelSettings"),
		},
	];

	const inviteButton = (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-9 shrink-0 border-md-outline-variant/80 px-3.5 text-label-medium text-md-on-surface hover:border-md-outline hover:bg-md-on-surface/8 sm:px-4 sm:text-label-large"
			onClick={() => setInvitesOpen(true)}
		>
			<Link2 className="size-4" />
			{t("gm.invites.open")}
		</Button>
	);

	return (
		<AdminLayout bleed>
			<div className="flex min-h-full flex-col">
				{/* 顶部工作台头部：移动端提交链接置于返回栏避免标题拥挤，桌面端与主标题同轴对齐 */}
				<header className="border-b border-md-outline-variant/60 bg-md-surface px-4 pt-3 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between gap-2">
						<Link
							to="/gm/modules"
							className="inline-flex min-h-11 items-center gap-1 rounded-xs py-1 text-label-medium text-md-on-surface-variant transition-colors hover:text-md-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring sm:min-h-9"
						>
							<ChevronLeft className="size-4" aria-hidden />
							<span>{t("gm.module.breadcrumbModules")}</span>
						</Link>
						<div className="sm:hidden">{inviteButton}</div>
					</div>

					<div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<div className="flex min-w-0 flex-wrap items-center gap-2.5">
							<h1 className="text-headline-small-emph text-md-on-surface sm:text-headline-medium-emph">
								{module?.name ?? t("gm.module.moduleFallback")}
							</h1>
							{ruleComponent ? (
								<span className="rounded-xs border border-md-outline-variant/70 bg-md-surface-container-high px-2 py-0.5 font-mono text-label-small tracking-[0.04em] text-md-on-surface-variant">
									{ruleComponent.shortName}
								</span>
							) : null}
							{activeThemeName ? (
								<span className="text-label-medium text-md-on-surface-variant">
									{activeThemeName}
								</span>
							) : null}
						</div>

						<div className="hidden sm:block">{inviteButton}</div>
					</div>

					{module?.description ? (
						<p className="mt-2.5 max-w-[36rem] text-body-medium text-md-on-surface-variant [text-wrap:pretty] select-text">
							{module.description}
						</p>
					) : null}

					{/* 横向可滚下划线页签栏：首项与标题/工具栏严格左缘齐平，44px 触控高度 */}
					<div
						role="tablist"
						aria-label={t("gm.module.tabsAria")}
						className="mt-4 -mb-px flex items-center gap-5 overflow-x-auto sm:gap-7 [scrollbar-width:none]"
					>
						{tabs.map((tab) => {
							const active = activeTab === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setTab(tab.id)}
									className={cn(
										"relative flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-0.5 outline-none transition-colors sm:min-w-0 sm:px-0",
										"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
										active
											? "text-label-large-emph text-md-on-surface"
											: "text-label-large text-md-on-surface-variant hover:text-md-on-surface",
									)}
								>
									<span>{tab.label}</span>
									{tab.count !== undefined ? (
										<span
											className={cn(
												"text-label-medium tabular-nums",
												active ? "text-accent" : "text-md-on-surface-variant",
											)}
										>
											{tab.count}
										</span>
									) : null}
									<span
										aria-hidden
										className={cn(
											"absolute inset-x-0 bottom-0 h-0.5 rounded-t-full transition-colors",
											active ? "bg-accent" : "bg-transparent",
										)}
									/>
								</button>
							);
						})}
					</div>
				</header>

				{/* 主内容画布：100% 宽度给资源工作区 */}
				<div className="flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
					{loadError && !module ? (
						<EmptyState
							icon={Music2}
							title={errorText(loadError, "gm.module.loadFailed")}
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
							className="bg-transparent"
						/>
					) : loading && !module ? (
						<div
							className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
							aria-busy
						>
							{[0, 1, 2].map((idx) => (
								<div
									key={idx}
									className="h-52 animate-pulse rounded-lg bg-md-surface-container"
								/>
							))}
						</div>
					) : activeTab === "scenes" ? (
						<ModuleScenesTab
							moduleId={moduleId}
							scenes={scenes}
							onReload={reload}
						/>
					) : activeTab === "characters" && module ? (
						<ModuleCharactersTab
							moduleId={moduleId}
							ruleId={module.ruleId}
							onCountChange={setLinkedCount}
							onOpenInvites={() => setInvitesOpen(true)}
						/>
					) : activeTab === "music" ? (
						<div className="flex flex-col gap-5">
							{/* 顶栏：胶囊搜索 + 中性平台导入 + 主色上传音频 */}
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex min-w-0 flex-1 items-center gap-3">
									{tracks.length > 0 ? (
										<InputGroup className="h-10 max-w-xs min-w-0 flex-1 rounded-full border-md-outline-variant/80 px-4">
											<InputGroupAddon className="text-md-on-surface-variant">
												<Search aria-hidden />
											</InputGroupAddon>
											<InputGroupInput
												value={trackQuery}
												onChange={(event) => setTrackQuery(event.target.value)}
												placeholder={
													hasAnyArtist
														? t("gm.module.searchTracksPlaceholder")
														: t("gm.module.searchTracksShortPlaceholder")
												}
												aria-label={t("gm.module.searchTracksPlaceholder")}
												className="placeholder:text-md-on-surface-variant/80"
											/>
										</InputGroup>
									) : null}
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="border-md-outline-variant/80 text-md-on-surface hover:border-md-outline hover:bg-md-on-surface/8"
										onClick={() => setPlatformOpen(true)}
									>
										<Plus />
										{t("gm.workbench.addPlatformTracks")}
									</Button>
									<Button
										type="button"
										variant="primary"
										size="sm"
										onClick={() =>
											audioFormRef.current
												?.querySelector<HTMLInputElement>('input[name="audio"]')
												?.click()
										}
									>
										<Upload />
										{t("gm.module.uploadAudioTrigger")}
									</Button>
								</div>
							</div>

							{/* 上传表单容器：有曲目且未选文件时完全静默零表单噪点，仅在选定/拖入文件或空曲库时呈现 */}
							<form
								ref={audioFormRef}
								className={cn(
									trackFileName
										? "flex flex-col gap-3 rounded-lg border border-accent/40 bg-md-surface-container p-4"
										: tracks.length === 0
											? "flex flex-col gap-3"
											: "sr-only",
								)}
								onSubmit={(event) => {
									event.preventDefault();
									const form = event.currentTarget;
									const fileInput = form.elements.namedItem(
										"audio",
									) as HTMLInputElement;
									const file = droppedFile ?? fileInput.files?.[0];
									if (!file) {
										toast.error(t("gm.module.chooseAudio"));
										return;
									}
									setUploadingTrack(true);
									void (async () => {
										try {
											const audioAssetId = await uploadMediaAsset(
												file,
												"audio",
											);
											const duration = await audioDurationMs(file);
											await api(
												`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
												{
													method: "POST",
													body: JSON.stringify({
														name: trackName.trim() || file.name,
														audioAssetId,
														type: trackType,
														duration,
													}),
												},
											);
											clearPendingAudio();
											await reload();
										} catch (error) {
											toast.error(errorText(error, "gm.module.uploadFailed"));
										} finally {
											setUploadingTrack(false);
										}
									})();
								}}
							>
								{tracks.length === 0 && !trackFileName ? (
									<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-md-outline-variant/60 px-6 py-12 text-center">
										<Music2
											className="size-8 text-md-on-surface-variant"
											aria-hidden
										/>
										<div className="flex flex-col gap-1">
											<p className="text-title-medium text-md-on-surface">
												{t("gm.module.emptyTracks")}
											</p>
											<p className="text-body-small text-md-on-surface-variant">
												{t("gm.module.emptyTracksHint")}
											</p>
										</div>
										<div className="mt-1 w-full max-w-xs">
											<FilePicker
												name="audio"
												accept=".mp3,audio/mpeg,.wav,audio/wav,.ogg,audio/ogg,.flac,audio/flac,.m4a,audio/mp4"
												label={t("gm.module.chooseAudio")}
												value={trackFileName}
												className="h-10 w-full max-w-none"
												onChange={(event) => {
													setDroppedFile(null);
													setTrackFileName(event.target.files?.[0]?.name ?? "");
												}}
											/>
										</div>
										<p className="text-body-small text-md-on-surface-variant">
											{t("gm.module.audioFormatHint")}
										</p>
									</div>
								) : (
									<>
										<div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
											<FilePicker
												name="audio"
												accept=".mp3,audio/mpeg,.wav,audio/wav,.ogg,audio/ogg,.flac,audio/flac,.m4a,audio/mp4"
												label={t("gm.module.chooseAudio")}
												value={trackFileName}
												className="h-10 w-full max-w-none lg:w-64 lg:shrink-0"
												onChange={(event) => {
													setDroppedFile(null);
													setTrackFileName(event.target.files?.[0]?.name ?? "");
												}}
											/>
											{trackFileName ? (
												<>
													<Input
														id="track-name"
														value={trackName}
														onChange={(event) =>
															setTrackName(event.target.value)
														}
														placeholder={t("gm.module.trackNamePlaceholder")}
														aria-label={t("gm.module.trackNameLabel")}
														className="h-10 min-w-0 flex-1"
													/>
													<Select
														value={trackType}
														onValueChange={(value) =>
															setTrackType(value as "bgm" | "se")
														}
													>
														<SelectTrigger
															className="h-10 w-full lg:w-28"
															aria-label={t("gm.module.audioTypeAria")}
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="bgm">BGM</SelectItem>
															<SelectItem value="se">SE</SelectItem>
														</SelectContent>
													</Select>
													<div className="flex shrink-0 items-center gap-2">
														<Button
															type="button"
															variant="tertiary"
															size="sm"
															disabled={uploadingTrack}
															onClick={clearPendingAudio}
														>
															{t("common.cancel")}
														</Button>
														<Button
															type="submit"
															variant="primary"
															size="sm"
															disabled={uploadingTrack}
														>
															<Upload />
															{t("gm.module.confirmUpload")}
														</Button>
													</div>
												</>
											) : null}
										</div>
										{trackFileName ? (
											<p className="text-body-small text-md-on-surface-variant">
												{t("gm.module.audioFormatHint")}
											</p>
										) : null}
									</>
								)}
							</form>

							{/* 读优先：纯粹 50/50 双栏 BGM / SE 可试听音轨台（无孤立底部格式说明） */}
							{tracks.length === 0 ? null : filteredTracks.length === 0 ? (
								<EmptyState
									icon={Search}
									title={t("gm.module.noSearchResults")}
									action={
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setTrackQuery("")}
										>
											{t("gm.library.clearSearch")}
										</Button>
									}
									className="bg-transparent py-10"
								/>
							) : (
								<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
									<section
										aria-labelledby="module-deck-bgm"
										onDragOver={(event) => {
											event.preventDefault();
											setDropTarget("bgm");
										}}
										onDragLeave={() => setDropTarget(null)}
										onDrop={(event) => handleDeckDrop(event, "bgm")}
										className={cn(
											"flex flex-col overflow-hidden rounded-lg border bg-md-surface-container transition-colors",
											dropTarget === "bgm"
												? "border-accent"
												: "border-md-outline-variant/55",
										)}
									>
										<header className="flex items-center justify-between gap-2 border-b border-md-outline-variant/45 px-4 py-3">
											<div className="flex items-center gap-2">
												<Disc3
													className="size-4 text-md-on-surface-variant"
													aria-hidden
												/>
												<h2
													id="module-deck-bgm"
													className="text-title-small-emph text-md-on-surface"
												>
													{t("gm.module.musicHeadingBgm")}
												</h2>
												<span className="rounded-xs border border-md-outline-variant/65 bg-md-surface-container-high px-1.5 py-0.5 font-mono text-label-small tracking-[0.04em] text-md-on-surface-variant">
													{t("gm.music.bgm")}
												</span>
											</div>
											<span className="text-label-medium tabular-nums text-md-on-surface-variant">
												{dropTarget === "bgm"
													? t("gm.module.dropToUploadBgm")
													: t("gm.music.bgmCount", {
															count: bgmTracks.length,
														})}
											</span>
										</header>
										{bgmTracks.length === 0 ? (
											<p className="px-4 py-8 text-center text-body-small text-md-on-surface-variant">
												{t("gm.music.noBgm")}
											</p>
										) : (
											<ul className="divide-y divide-md-outline-variant/40">
												{bgmTracks.map((track, idx) => (
													<TrackStudioRow
														key={track.id}
														track={track}
														index={idx}
														previewing={previewTrackId === track.id}
														onTogglePreview={() => togglePreview(track)}
														onReload={reload}
														onRequestDelete={() => setDeleteTrackTarget(track)}
													/>
												))}
											</ul>
										)}
									</section>

									<section
										aria-labelledby="module-deck-se"
										onDragOver={(event) => {
											event.preventDefault();
											setDropTarget("se");
										}}
										onDragLeave={() => setDropTarget(null)}
										onDrop={(event) => handleDeckDrop(event, "se")}
										className={cn(
											"flex flex-col overflow-hidden rounded-lg border bg-md-surface-container transition-colors",
											dropTarget === "se"
												? "border-accent"
												: "border-md-outline-variant/55",
										)}
									>
										<header className="flex items-center justify-between gap-2 border-b border-md-outline-variant/45 px-4 py-3">
											<div className="flex items-center gap-2">
												<Volume2
													className="size-4 text-md-on-surface-variant"
													aria-hidden
												/>
												<h2
													id="module-deck-se"
													className="text-title-small-emph text-md-on-surface"
												>
													{t("gm.module.musicHeadingSe")}
												</h2>
												<span className="rounded-xs border border-md-outline-variant/65 bg-md-surface-container-high px-1.5 py-0.5 font-mono text-label-small tracking-[0.04em] text-md-on-surface-variant">
													{t("gm.music.se")}
												</span>
											</div>
											<span className="text-label-medium tabular-nums text-md-on-surface-variant">
												{dropTarget === "se"
													? t("gm.module.dropToUploadSe")
													: t("gm.music.seCount", {
															count: seTracks.length,
														})}
											</span>
										</header>
										{seTracks.length === 0 ? (
											<p className="px-4 py-8 text-center text-body-small text-md-on-surface-variant">
												{t("gm.music.noSe")}
											</p>
										) : (
											<ul className="divide-y divide-md-outline-variant/40">
												{seTracks.map((track, idx) => (
													<TrackStudioRow
														key={track.id}
														track={track}
														index={idx}
														previewing={previewTrackId === track.id}
														onTogglePreview={() => togglePreview(track)}
														onReload={reload}
														onRequestDelete={() => setDeleteTrackTarget(track)}
													/>
												))}
											</ul>
										)}
									</section>
								</div>
							)}
						</div>
					) : activeTab === "handouts" ? (
						<ModuleHandoutsTab
							moduleId={moduleId}
							handouts={handouts}
							onReload={reload}
						/>
					) : activeTab === "settings" && module ? (
						<ModuleSettingsTab
							module={module}
							themes={themes}
							onSaved={reload}
							onDeleted={() => void navigate({ to: "/gm/modules" })}
						/>
					) : null}
				</div>
			</div>

			{/* 网易云 / QQ 平台曲目与歌单导入弹窗 */}
			<Dialog open={platformOpen} onOpenChange={setPlatformOpen}>
				<DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden">
					<DialogHeader className="shrink-0 pr-8">
						<DialogTitle>{t("gm.workbench.addPlatformTracks")}</DialogTitle>
						<DialogDescription>
							{t("gm.workbench.addPlatformTracksDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-1.5">
						<MusicSourcePanel
							moduleId={moduleId}
							tracks={tracks}
							onAdded={(added) => {
								setTracks((current) =>
									current.some((item) => item.id === added.id)
										? current
										: [...current, added],
								);
							}}
						/>
					</div>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteTrackTarget !== null}
				onOpenChange={(open) => !open && setDeleteTrackTarget(null)}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.module.deleteTrackTitle")}
				description={t("gm.module.deleteTrackDescription", {
					name: deleteTrackTarget?.name ?? "",
				})}
				confirmLabel={t("common.delete")}
				onConfirm={() => {
					const target = deleteTrackTarget;
					setDeleteTrackTarget(null);
					if (!target) return;
					if (previewTrackId === target.id) stopPreview();
					void api(`/gm/modules/tracks/${encodeURIComponent(target.id)}`, {
						method: "DELETE",
					})
						.then(() => reload())
						.catch((error) =>
							toast.error(errorText(error, "gm.module.deleteFailed")),
						);
				}}
			/>

			<InviteLinksDialog
				open={invitesOpen}
				onOpenChange={setInvitesOpen}
				scope="module"
				targetId={moduleId}
				targetName={module?.name ?? ""}
				ruleId={module?.ruleId}
			/>
		</AdminLayout>
	);
}
