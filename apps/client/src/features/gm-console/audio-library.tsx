import {
	AudioLines,
	LibraryBig,
	LoaderCircle,
	Play,
	Plus,
	RotateCcw,
	Search,
	Zap,
} from "lucide-react";
import { Activity, type ReactNode, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import {
	Alert,
	AlertAction,
	AlertContent,
	AlertDescription,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { trackSourceLabel } from "./gm-audio";
import { MusicSourcePanel } from "./music-source-panel";

const SCROLL_BASE =
	"overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--color-scrollbar)_transparent]";
const SCROLL_AREA = `${SCROLL_BASE} md:mask-b-from-[calc(100%-2rem)]`;

function LibrarySection({
	label,
	meta,
	children,
	className,
}: {
	label: string;
	meta: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			aria-label={label}
			className={cn("flex min-w-0 flex-col gap-2 md:min-h-0", className)}
		>
			<div className="flex items-baseline justify-between gap-2 px-1">
				<h3 className="text-md-on-surface text-title-small-emph">{label}</h3>
				<span className="text-md-on-surface-variant text-label-small tabular-nums">
					{meta}
				</span>
			</div>
			{children}
		</section>
	);
}

function SectionEmpty({ children }: { children: ReactNode }) {
	return (
		<p className="text-md-on-surface-variant border-md-outline-variant/60 rounded-lg border border-dashed px-4 py-6 text-center text-body-medium">
			{children}
		</p>
	);
}

function AudioLibrary({
	currentTrackId,
	playing,
	controlsDisabled,
	commandPending = false,
	playTrack,
	togglePlay,
}: {
	currentTrackId: string | null;
	playing: boolean;
	controlsDisabled: boolean;
	commandPending?: boolean;
	playTrack: (trackId: string, restart?: boolean) => void;
	togglePlay: () => void;
}) {
	const tracks = usePlayStore((state) => state.catalogTracks);
	const catalogStatus = usePlayStore((state) => state.catalogStatus);
	const reloadCatalog = usePlayStore((state) => state.reloadCatalog);
	const moduleId = usePlayStore((state) => state.moduleId);
	const addCatalogTrack = usePlayStore((state) => state.addCatalogTrack);
	const connected = usePlayStore((state) => state.connected);
	const snapshotReady = usePlayStore((state) => state.snapshotReady);
	const [query, setQuery] = useState("");
	const [addingOpen, setAddingOpen] = useState(false);
	const search = query.trim().toLocaleLowerCase();
	const filtered = tracks.filter((track) =>
		[track.name, ...track.artists].some((value) =>
			value.toLocaleLowerCase().includes(search),
		),
	);
	const bgmTracks = filtered.filter((track) => track.type === "bgm");
	const soundEffects = filtered.filter((track) => track.type === "se");
	const loading = catalogStatus === "idle" || catalogStatus === "loading";
	const ready = catalogStatus === "ready";
	const emptyCatalog = ready && tracks.length === 0;

	const addTrigger = (variant: "outline" | "primary") => (
		<DialogTrigger asChild>
			<Button type="button" variant={variant} size="sm" className="shrink-0">
				<Plus data-icon="inline-start" />
				{t("gm.workbench.addPlatformTracks")}
			</Button>
		</DialogTrigger>
	);

	return (
		<Dialog open={addingOpen} onOpenChange={setAddingOpen}>
			<section
				aria-label={t("gm.workbench.trackLibrary")}
				className="flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1"
			>
				<div className="flex min-w-0 flex-wrap items-center gap-3">
					<h3 className="text-md-on-surface mr-auto px-1 text-title-medium-emph">
						{t("gm.workbench.trackLibrary")}
					</h3>
					{ready && tracks.length > 0 ? (
						<InputGroup className="order-last w-full @xl:order-none @xl:w-64">
							<InputGroupAddon>
								<Search aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								type="search"
								value={query}
								onInput={(event) => setQuery(event.currentTarget.value)}
								aria-label={t("gm.workbench.librarySearch")}
								placeholder={t("gm.workbench.librarySearchPlaceholder")}
							/>
						</InputGroup>
					) : null}
					{emptyCatalog ? null : addTrigger("outline")}
				</div>

				{catalogStatus === "error" ? (
					<Alert variant="danger" className="shadow-none">
						<AlertContent>
							<AlertDescription>
								{t("gm.workbench.catalogLoadFailed")}
							</AlertDescription>
						</AlertContent>
						<AlertAction>
							<Button
								type="button"
								variant="dangerSoft"
								size="xs"
								onClick={reloadCatalog}
							>
								<RotateCcw data-icon="inline-start" />
								{t("gm.workbench.retryCatalog")}
							</Button>
						</AlertAction>
					</Alert>
				) : loading ? (
					<p
						role="status"
						className="text-md-on-surface-variant flex items-center gap-2 px-1 py-3 text-body-medium"
					>
						<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
						{t("gm.workbench.catalogLoading")}
					</p>
				) : emptyCatalog ? (
					<EmptyState
						icon={LibraryBig}
						title={t("gm.workbench.libraryEmptyTitle")}
						description={t("gm.workbench.libraryEmptyHint")}
						action={addTrigger("primary")}
						className="py-10"
					/>
				) : search && filtered.length === 0 ? (
					<div
						role="status"
						className="flex flex-col items-center gap-2 rounded-xl bg-md-surface-container px-4 py-8 text-center"
					>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("gm.workbench.libraryNoResults")}
						</p>
						<Button
							type="button"
							variant="text"
							size="xs"
							onClick={() => setQuery("")}
						>
							{t("gm.workbench.libraryClearSearch")}
						</Button>
					</div>
				) : (
					<div className="grid min-w-0 items-start gap-5 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-stretch">
						{!search || bgmTracks.length > 0 ? (
							<LibrarySection
								label={t("gm.workbench.backgroundMusic")}
								meta={t("gm.workbench.bgmTrackCount", {
									count: bgmTracks.length,
								})}
							>
								{bgmTracks.length === 0 ? (
									<SectionEmpty>{t("gm.workbench.noBgmTracks")}</SectionEmpty>
								) : (
									<ul
										className={cn(
											"bg-md-surface-container flex flex-col gap-0.5 rounded-xl p-1.5 md:min-h-0 md:flex-1",
											SCROLL_AREA,
										)}
									>
										{bgmTracks.map((track) => {
											const active = track.id === currentTrackId;
											const label = t(
												!active
													? "gm.workbench.playTrack"
													: playing
														? "gm.workbench.pauseTrack"
														: "gm.workbench.resumeTrack",
												{ name: track.name },
											);
											const restartLabel = t("gm.workbench.restartTrack", {
												name: track.name,
											});
											return (
												<li key={track.id} className="relative">
													<Button
														type="button"
														variant={active ? "accentSoft" : "ghost"}
														size="sm"
														shape="square"
														className={cn(
															"group h-auto min-h-12 w-full justify-start gap-3 rounded-lg px-3 py-2 text-left disabled:opacity-60",
														active && "pr-14",
															active
																? "disabled:bg-accent-soft! disabled:text-accent-soft-foreground!"
																: "text-md-on-surface hover:bg-md-on-surface/8 disabled:bg-transparent! disabled:text-md-on-surface!",
														)}
														aria-label={label}
														title={label}
														aria-current={active ? "true" : undefined}
														aria-disabled={commandPending || undefined}
														disabled={controlsDisabled}
														onClick={() =>
															active ? togglePlay() : playTrack(track.id)
														}
													>
														<span className="grid size-5 shrink-0 place-items-center">
															{active && playing ? (
																<AudioLines
																	className="size-5 motion-safe:animate-pulse"
																	aria-hidden="true"
																/>
															) : active ? (
																<Play className="size-5" aria-hidden="true" />
															) : (
																<Play
																	className="text-md-on-surface-variant group-hover:text-accent size-5"
																	aria-hidden="true"
																/>
															)}
														</span>
														<span className="flex min-w-0 flex-1 flex-col">
															<span
																className={cn(
																	"truncate text-label-large",
																	active && "font-semibold",
																)}
															>
																{track.name}
															</span>
															<span
																className={cn(
																	"truncate text-body-small",
																	!active && "text-md-on-surface-variant",
																)}
															>
																{trackSourceLabel(track.source)}
																{track.artists.length
																	? ` · ${track.artists.join(" / ")}`
																	: ""}
															</span>
														</span>
														<span
															className={cn(
																"shrink-0 font-mono text-label-medium tabular-nums",
																!active && "text-md-on-surface-variant",
															)}
														>
															{formatDurationMmSs(track.duration)}
														</span>
													</Button>
													{active ? (
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															className="text-accent-soft-foreground hover:bg-md-on-surface/8 absolute! top-1/2 right-1.5 size-9 -translate-y-1/2 disabled:bg-transparent! disabled:opacity-60"
															aria-label={restartLabel}
															title={restartLabel}
															aria-disabled={commandPending || undefined}
															disabled={controlsDisabled}
															onClick={() => playTrack(track.id, true)}
														>
															<RotateCcw />
														</Button>
													) : null}
												</li>
											);
										})}
									</ul>
								)}
							</LibrarySection>
						) : null}
						{!search || soundEffects.length > 0 ? (
							<LibrarySection
								className="order-first md:order-none"
								label={t("gm.workbench.soundEffects")}
								meta={t("gm.workbench.soundEffectsHint")}
							>
								{soundEffects.length === 0 ? (
									<SectionEmpty>
										{t("gm.workbench.noSoundEffects")}
									</SectionEmpty>
								) : (
									<div
										className={cn(
											"grid grid-cols-2 content-start gap-2 md:min-h-0 md:flex-1",
											SCROLL_AREA,
										)}
									>
										{soundEffects.map((effect) => (
											<Button
												key={effect.id}
												type="button"
												variant="tertiary"
												size="sm"
												shape="square"
												className="min-h-12 min-w-0 justify-start rounded-lg px-3 disabled:bg-default! disabled:text-default-foreground! disabled:opacity-50"
												aria-label={t("gm.workbench.playSoundEffect", {
													name: effect.name,
												})}
												title={effect.name}
												disabled={!connected || !snapshotReady}
												onClick={() =>
													sendSessionCommand("audio:se", {
														trackId: effect.id,
													})
												}
											>
												<Zap
													data-icon="inline-start"
													className="text-accent"
												/>
												<span className="truncate">{effect.name}</span>
											</Button>
										))}
									</div>
								)}
							</LibrarySection>
						) : null}
					</div>
				)}
			</section>
			<Activity mode={addingOpen ? "visible" : "hidden"}>
				<DialogContent
					forceMount
					className="flex w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden"
				>
					<DialogHeader className="shrink-0 pr-8">
						<DialogTitle>{t("gm.workbench.addPlatformTracks")}</DialogTitle>
						<DialogDescription>
							{t("gm.workbench.addPlatformTracksDescription")}
						</DialogDescription>
					</DialogHeader>
					<div
						className={cn("min-h-0 pb-1.5 pr-1", SCROLL_BASE)}
					>
						<MusicSourcePanel
							moduleId={moduleId}
							tracks={tracks}
							onAdded={addCatalogTrack}
						/>
					</div>
				</DialogContent>
			</Activity>
		</Dialog>
	);
}

export { AudioLibrary };
