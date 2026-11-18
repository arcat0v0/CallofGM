import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
	TrackDto,
} from "@cogm/shared";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { t } from "@/i18n";
import { errorText } from "@/lib/errors";
import { formatDurationMmSs } from "@/lib/format";
import { addExternalTrack, resolveMusicPlaylist } from "./music-source";
import {
	createPlaylistImportRunner,
	mergePlaylistItems,
	type PlaylistImportProgress,
	type PlaylistImportResult,
	playlistTrackKey,
} from "./playlist-import";

function PlaylistSourcePanel({
	moduleId,
	provider,
	type,
	tracks,
	onAdded,
	disabled,
	onBusyChange,
}: {
	moduleId: string | null;
	provider: MusicProvider;
	type: TrackDto["type"];
	tracks: TrackDto[];
	onAdded: (track: TrackDto) => void;
	disabled: boolean;
	onBusyChange: (busy: boolean) => void;
}) {
	const [reference, setReference] = useState("");
	const [playlist, setPlaylist] = useState<MusicPlaylistDto | null>(null);
	const [items, setItems] = useState<MusicTrackDto[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState<"resolve" | "more" | null>(null);
	const [importing, setImporting] = useState(false);
	const [stopRequested, setStopRequested] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<PlaylistImportProgress | null>(null);
	const [result, setResult] = useState<PlaylistImportResult | null>(null);
	const [runner] = useState(createPlaylistImportRunner);
	const itemsRef = useRef<MusicTrackDto[]>([]);
	const importingRef = useRef(false);
	const busy = disabled || loading !== null || importing;
	const existingKeys = useMemo(
		() =>
			new Set(
				tracks
					.filter((track) => track.source === provider && track.externalId)
					.map((track) => playlistTrackKey(provider, track.externalId ?? "")),
			),
		[provider, tracks],
	);
	const existingKeysRef = useRef(existingKeys);
	existingKeysRef.current = existingKeys;
	const availableItems = useMemo(
		() =>
			items.filter(
				(candidate) =>
					!existingKeys.has(playlistTrackKey(provider, candidate.externalId)),
			),
		[existingKeys, items, provider],
	);
	const selectedCandidates = availableItems.filter((candidate) =>
		selected.has(playlistTrackKey(provider, candidate.externalId)),
	);

	function applyPage(page: MusicPlaylistDto, append: boolean) {
		const merged = mergePlaylistItems(
			append ? itemsRef.current : [],
			page.items,
			provider,
		);
		itemsRef.current = merged.items;
		setPlaylist(page);
		setItems(merged.items);
		setSelected((current) => {
			const next = append ? new Set(current) : new Set<string>();
			for (const candidate of merged.added) {
				const key = playlistTrackKey(provider, candidate.externalId);
				if (!existingKeysRef.current.has(key)) {
					next.add(key);
				}
			}
			return next;
		});
	}

	async function resolveFirstPage() {
		const trimmed = reference.trim();
		if (!moduleId || !trimmed || busy) {
			return;
		}
		setLoading("resolve");
		onBusyChange(true);
		setError(null);
		setResult(null);
		setProgress(null);
		setPlaylist(null);
		setItems([]);
		setSelected(new Set());
		itemsRef.current = [];
		try {
			applyPage(await resolveMusicPlaylist(provider, trimmed), false);
		} catch (reason) {
			setError(errorText(reason, "gm.workbench.playlistRequestFailed"));
		} finally {
			setLoading(null);
			onBusyChange(false);
		}
	}

	async function loadMore() {
		if (!playlist || playlist.nextOffset === null || busy) {
			return;
		}
		setLoading("more");
		onBusyChange(true);
		setError(null);
		setResult(null);
		try {
			applyPage(
				await resolveMusicPlaylist(
					provider,
					playlist.playlistId,
					playlist.nextOffset,
				),
				true,
			);
		} catch (reason) {
			setError(errorText(reason, "gm.workbench.playlistRequestFailed"));
		} finally {
			setLoading(null);
			onBusyChange(false);
		}
	}

	async function importSelected() {
		if (
			!moduleId ||
			importingRef.current ||
			busy ||
			selectedCandidates.length === 0
		) {
			return;
		}
		importingRef.current = true;
		setImporting(true);
		setStopRequested(false);
		onBusyChange(true);
		setError(null);
		setResult(null);
		try {
			const completed = await runner.run({
				moduleId,
				provider,
				type,
				candidates: selectedCandidates,
				existingTracks: tracks,
				addTrack: addExternalTrack,
				formatError: (reason) =>
					errorText(reason, "gm.workbench.musicRequestFailed"),
				onAdded,
				onProgress: setProgress,
			});
			if (!completed) {
				return;
			}
			setResult(completed);
			setSelected((current) => {
				const next = new Set(current);
				for (const track of completed.added) {
					if (track.externalId) {
						next.delete(playlistTrackKey(provider, track.externalId));
					}
				}
				for (const candidate of completed.existing) {
					next.delete(playlistTrackKey(provider, candidate.externalId));
				}
				return next;
			});
			const summary = t("gm.workbench.playlistImportSummary", {
				added: completed.added.length,
				existing: completed.existing.length,
				failed: completed.failures.length,
			});
			if (completed.added.length > 0) {
				if (completed.failures.length > 0 || completed.stopped) {
					toast.warning(summary);
				} else {
					toast.success(summary);
				}
			} else if (completed.failures.length > 0) {
				toast.error(summary);
			}
		} finally {
			importingRef.current = false;
			setImporting(false);
			setStopRequested(false);
			onBusyChange(false);
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<form
				className="flex flex-col gap-2 sm:flex-row"
				onSubmit={(event) => {
					event.preventDefault();
					void resolveFirstPage();
				}}
			>
				<Input
					value={reference}
					onChange={(event) => setReference(event.target.value)}
					aria-label={t("gm.workbench.playlistReference")}
					placeholder={t("gm.workbench.playlistReferencePlaceholder")}
					disabled={busy || !moduleId}
					className="min-h-11"
				/>
				<Button
					type="submit"
					variant="tonal"
					size="sm"
					className="min-h-11 shrink-0 px-4"
					disabled={!moduleId || !reference.trim() || busy}
				>
					{t("gm.workbench.playlistResolve")}
				</Button>
			</form>
			<p className="text-md-on-surface-variant text-body-small">
				{t("gm.workbench.playlistScopeHint")}
			</p>
			{!moduleId ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>
							{t("gm.workbench.playlistNoModule")}
						</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}
			{error ? (
				<Alert variant="danger">
					<AlertContent>
						<AlertDescription>{error}</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}
			{loading ? (
				<p
					role="status"
					className="text-md-on-surface-variant flex min-h-11 items-center gap-2 text-body-medium"
				>
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					{loading === "resolve"
						? t("gm.workbench.playlistResolving")
						: t("gm.workbench.playlistLoadingMore")}
				</p>
			) : null}
			{playlist ? (
				<section className="bg-md-surface-container-high flex flex-col gap-3 rounded-xl p-3">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<h5 className="text-md-on-surface break-words text-title-medium-emph">
								{playlist.name}
							</h5>
							<p className="text-md-on-surface-variant text-body-small">
								{playlist.totalCount === null
									? t("gm.workbench.playlistTotalUnknown")
									: t("gm.workbench.playlistTotal", {
											count: playlist.totalCount,
										})}
								{" · "}
								{t("gm.workbench.playlistLoaded", { count: items.length })}
							</p>
						</div>
						<Button
							asChild
							type="button"
							variant="text"
							size="xs"
							className="min-h-11"
						>
							<a
								href={playlist.sourceUrl}
								target="_blank"
								rel="noreferrer"
								aria-label={t("gm.workbench.playlistOpenOfficial", {
									name: playlist.name,
								})}
							>
								<ExternalLink data-icon="inline-start" />
								{t("gm.workbench.officialDetails")}
							</a>
						</Button>
					</div>
					{items.length === 0 && !loading ? (
						<p className="text-md-on-surface-variant text-body-medium">
							{t("gm.workbench.playlistEmpty")}
						</p>
					) : (
						<ul className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain">
							{items.map((candidate) => {
								const key = playlistTrackKey(provider, candidate.externalId);
								const exists = existingKeys.has(key);
								return (
									<li
										key={key}
										className="bg-md-surface-container-low flex min-h-16 items-start gap-3 rounded-lg p-3"
									>
										<Checkbox
											id={`playlist-${key}`}
											checked={selected.has(key)}
											disabled={exists || busy}
											onCheckedChange={(checked) => {
												setSelected((current) => {
													const next = new Set(current);
													if (checked === true) {
														next.add(key);
													} else {
														next.delete(key);
													}
													return next;
												});
											}}
											aria-label={t("gm.workbench.playlistSelectTrack", {
												name: candidate.name,
											})}
											className="mt-1"
										/>
										<label
											htmlFor={`playlist-${key}`}
											className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
										>
											<span className="text-md-on-surface break-words text-label-large-emph">
												{candidate.name}
											</span>
											<span className="text-md-on-surface-variant break-words text-body-small">
												{candidate.artists.join(" / ") ||
													t("gm.workbench.unknownArtist")}
											</span>
										</label>
										<div className="flex shrink-0 flex-col items-end gap-1">
											<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
												{formatDurationMmSs(candidate.durationMs)}
											</span>
											{exists ? (
												<Badge tone="default" variant="soft" size="sm">
													{t("gm.workbench.playlistAlreadyInModule")}
												</Badge>
											) : null}
										</div>
									</li>
								);
							})}
						</ul>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="text"
							size="xs"
							className="min-h-11"
							disabled={busy || availableItems.length === 0}
							onClick={() =>
								setSelected(
									new Set(
										availableItems.map((candidate) =>
											playlistTrackKey(provider, candidate.externalId),
										),
									),
								)
							}
						>
							{t("gm.workbench.playlistSelectAll")}
						</Button>
						<Button
							type="button"
							variant="text"
							size="xs"
							className="min-h-11"
							disabled={busy || selectedCandidates.length === 0}
							onClick={() => setSelected(new Set())}
						>
							{t("gm.workbench.playlistClearSelection")}
						</Button>
						<span className="text-md-on-surface-variant text-label-medium">
							{t("gm.workbench.playlistSelected", {
								count: selectedCandidates.length,
							})}
						</span>
					</div>
					{playlist.nextOffset !== null ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="min-h-11 w-full"
							disabled={busy}
							onClick={() => void loadMore()}
						>
							{t("gm.workbench.playlistLoadMore")}
						</Button>
					) : items.length > 0 ? (
						<p className="text-md-on-surface-variant text-body-small">
							{t("gm.workbench.playlistNoMore")}
						</p>
					) : null}
					<Button
						type="button"
						variant="tonal"
						size="sm"
						className="min-h-11 w-full"
						disabled={!moduleId || busy || selectedCandidates.length === 0}
						onClick={() => void importSelected()}
					>
						{t("gm.workbench.playlistImportSelected")}
					</Button>
					{importing ? (
						<Button
							type="button"
							variant="text"
							size="sm"
							className="min-h-11 w-full"
							disabled={stopRequested}
							onClick={() => {
								runner.requestStop();
								setStopRequested(true);
							}}
						>
							{stopRequested
								? t("gm.workbench.playlistStopPending")
								: t("gm.workbench.playlistStopAfterCurrent")}
						</Button>
					) : null}
				</section>
			) : null}
			{importing && progress ? (
				<div className="flex flex-col gap-2" role="status">
					<div className="text-md-on-surface-variant flex flex-wrap justify-between gap-2 text-body-small">
						<span>
							{t("gm.workbench.playlistProgress", {
								completed: progress.completed,
								total: progress.total,
							})}
						</span>
						{progress.current ? (
							<span className="min-w-0 break-words">
								{t("gm.workbench.playlistCurrent", {
									name: progress.current.name,
								})}
							</span>
						) : null}
					</div>
					<Progress
						value={progress.completed}
						max={Math.max(1, progress.total)}
						aria-label={t("gm.workbench.playlistProgress", {
							completed: progress.completed,
							total: progress.total,
						})}
					/>
				</div>
			) : null}
			{result ? (
				<Alert
					variant={
						result.failures.length > 0
							? result.added.length > 0
								? "warning"
								: "danger"
							: result.stopped
								? "warning"
								: "success"
					}
				>
					<AlertContent>
						<AlertTitle>
							{result.failures.length > 0
								? result.added.length > 0
									? t("gm.workbench.playlistPartialTitle")
									: t("gm.workbench.playlistFailedTitle")
								: result.stopped
									? t("gm.workbench.playlistPartialTitle")
									: t("gm.workbench.playlistCompleteTitle")}
						</AlertTitle>
						<AlertDescription>
							<p>
								{t("gm.workbench.playlistImportSummary", {
									added: result.added.length,
									existing: result.existing.length,
									failed: result.failures.length,
								})}
							</p>
							{result.stopped ? (
								<p>{t("gm.workbench.playlistStopped")}</p>
							) : null}
							{result.failures.length > 0 ? (
								<details>
									<summary className="flex min-h-11 cursor-pointer items-center text-label-large-emph">
										{t("gm.workbench.playlistFailureDetails", {
											count: result.failures.length,
										})}
									</summary>
									<ul className="flex flex-col gap-2 pb-2">
										{result.failures.map((failure) => (
											<li
												key={playlistTrackKey(
													provider,
													failure.candidate.externalId,
												)}
												className="break-words"
											>
												{failure.candidate.name}：{failure.message}
											</li>
										))}
									</ul>
								</details>
							) : null}
						</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}
		</div>
	);
}

export { PlaylistSourcePanel };
