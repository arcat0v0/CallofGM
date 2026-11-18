import {
	Check,
	ChevronDown,
	ListMusic,
	LoaderCircle,
	Play,
	Plus,
	Search,
	Zap,
} from "lucide-react";
import { Collapsible } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { trackSourceLabel } from "./gm-audio";
import { MusicSourcePanel } from "./music-source-panel";

function AudioLibrary({
	currentTrackId,
	controlsDisabled,
	playTrack,
}: {
	currentTrackId: string | null;
	controlsDisabled: boolean;
	playTrack: (trackId: string, restart?: boolean) => void;
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

	return (
		<div className="flex min-w-0 flex-col gap-4">
			{catalogStatus === "error" ? (
				<div
					role="alert"
					className="flex items-center justify-between gap-3 rounded-xl bg-md-error-container p-3 text-md-on-error-container"
				>
					<span className="text-body-medium">
						{t("gm.workbench.catalogLoadFailed")}
					</span>
					<Button
						type="button"
						variant="tertiary"
						size="xs"
						onClick={reloadCatalog}
					>
						{t("gm.workbench.retryCatalog")}
					</Button>
				</div>
			) : loading ? (
				<p
					role="status"
					className="text-md-on-surface-variant flex items-center gap-2 py-3 text-body-medium"
				>
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					{t("gm.workbench.catalogLoading")}
				</p>
			) : (
				<>
					{tracks.length > 0 ? (
						<InputGroup>
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
					{search && filtered.length === 0 ? (
						<div role="status" className="flex flex-col items-start gap-2 py-4">
							<p className="text-md-on-surface-variant text-body-medium">
								{t("gm.workbench.libraryNoResults")}
							</p>
							<Button
								type="button"
								variant="text"
								size="sm"
								onClick={() => setQuery("")}
							>
								{t("gm.workbench.libraryClearSearch")}
							</Button>
						</div>
					) : (
						<>
							{!search || bgmTracks.length > 0 ? (
								<section
									aria-label={t("gm.workbench.backgroundMusic")}
									className="flex min-w-0 flex-col gap-2"
								>
									<div className="flex items-center justify-between gap-2">
										<h3 className="text-md-on-surface text-title-small-emph">
											{t("gm.workbench.backgroundMusic")}
										</h3>
										<span className="text-md-on-surface-variant text-label-small tabular-nums">
											{t("gm.workbench.bgmTrackCount", {
												count: bgmTracks.length,
											})}
										</span>
									</div>
									{bgmTracks.length === 0 ? (
										<p className="text-md-on-surface-variant flex items-center gap-2 py-3 text-body-medium">
											<ListMusic
												className="size-4 shrink-0"
												aria-hidden="true"
											/>
											{t("gm.workbench.noBgmTracks")}
										</p>
									) : (
										<ul className="flex max-h-52 flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--color-scrollbar)_transparent]">
											{bgmTracks.map((track) => {
												const active = track.id === currentTrackId;
												return (
													<li key={track.id}>
														<Button
															type="button"
															variant={active ? "secondary" : "ghost"}
															size="sm"
															className="h-auto min-h-12 w-full justify-start px-3 py-2"
															aria-label={t(
																active
																	? "gm.workbench.restartTrack"
																	: "gm.workbench.playTrack",
																{ name: track.name },
															)}
															title={t(
																active
																	? "gm.workbench.restartTrack"
																	: "gm.workbench.playTrack",
																{ name: track.name },
															)}
															aria-current={active ? "true" : undefined}
															disabled={controlsDisabled}
															onClick={() => playTrack(track.id, active)}
														>
															{active ? (
																<Check data-icon="inline-start" />
															) : (
																<Play data-icon="inline-start" />
															)}
															<span className="flex min-w-0 flex-1 flex-col text-left">
																<span className="truncate">{track.name}</span>
																<span className="truncate text-label-small opacity-70">
																	{trackSourceLabel(track.source)}
																	{track.artists.length
																		? ` · ${track.artists.join(" / ")}`
																		: ""}
																</span>
															</span>
															<span className="shrink-0 font-mono text-label-small tabular-nums">
																{formatDurationMmSs(track.duration)}
															</span>
														</Button>
													</li>
												);
											})}
										</ul>
									)}
								</section>
							) : null}
							{!search || soundEffects.length > 0 ? (
								<section
									aria-label={t("gm.workbench.soundEffects")}
									className="flex min-w-0 flex-col gap-2"
								>
									<div className="flex items-center justify-between gap-2">
										<h3 className="text-md-on-surface text-title-small-emph">
											{t("gm.workbench.soundEffects")}
										</h3>
										<span className="text-md-on-surface-variant text-label-small">
											{t("gm.workbench.soundEffectsHint")}
										</span>
									</div>
									{soundEffects.length === 0 ? (
										<p className="text-md-on-surface-variant py-3 text-body-medium">
											{t("gm.workbench.noSoundEffects")}
										</p>
									) : (
										<div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--color-scrollbar)_transparent]">
											{soundEffects.map((effect) => (
												<Button
													key={effect.id}
													type="button"
													variant="tertiary"
													size="sm"
													className="min-h-11 min-w-0 justify-start px-3"
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
													<Zap data-icon="inline-start" />
													<span className="truncate">{effect.name}</span>
												</Button>
											))}
										</div>
									)}
								</section>
							) : null}
						</>
					)}
				</>
			)}
			<Collapsible.Root
				open={addingOpen}
				onOpenChange={setAddingOpen}
				className="flex flex-col gap-2"
			>
				<Collapsible.Trigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="min-h-11 w-full justify-start"
					>
						<Plus data-icon="inline-start" />
						<span className="flex-1 text-left">
							{t("gm.workbench.addPlatformTracks")}
						</span>
						<ChevronDown
							data-icon="inline-end"
							className={addingOpen ? "rotate-180" : undefined}
						/>
					</Button>
				</Collapsible.Trigger>
				<Collapsible.Content
					forceMount
					hidden={!addingOpen}
					className="data-[state=closed]:hidden"
				>
					<MusicSourcePanel
						moduleId={moduleId}
						tracks={tracks}
						onAdded={addCatalogTrack}
					/>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	);
}

export { AudioLibrary };
