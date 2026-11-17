import type { MusicProvider, MusicTrackDto, TrackDto } from "@cogm/shared";
import { ExternalLink, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { GmSelectField } from "./gm-panel-fields";
import { addExternalTrack, resolveMusic, searchMusic } from "./music-source";

function availabilityLabel(availability: MusicTrackDto["availability"]) {
	if (availability === "available") {
		return t("gm.workbench.musicAvailable");
	}
	if (availability === "unavailable") {
		return t("gm.workbench.musicUnavailable");
	}
	return t("gm.workbench.musicAvailabilityUnknown");
}

function MusicCandidate({
	candidate,
	added,
	adding,
	disabled,
	onAdd,
}: {
	candidate: MusicTrackDto;
	added: boolean;
	adding: boolean;
	disabled: boolean;
	onAdd: () => void;
}) {
	return (
		<article className="bg-md-surface-container-low flex flex-col gap-2 rounded-xl p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h5 className="text-md-on-surface truncate text-label-large-emph">
						{candidate.name}
					</h5>
					<p className="text-md-on-surface-variant truncate text-body-small">
						{candidate.artists.join(" / ") || t("gm.workbench.unknownArtist")}
					</p>
				</div>
				<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
					{formatDurationMmSs(candidate.durationMs)}
				</span>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-md-on-surface-variant text-label-small">
					{availabilityLabel(candidate.availability)}
				</span>
				<div className="flex items-center gap-1">
					<Button
						asChild
						type="button"
						variant="text"
						size="xs"
						className="min-h-11"
					>
						<a
							href={candidate.sourceUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={t("gm.workbench.openOfficialTrack", {
								name: candidate.name,
							})}
						>
							<ExternalLink data-icon="inline-start" />
							{t("gm.workbench.officialDetails")}
						</a>
					</Button>
					<Button
						type="button"
						variant="tonal"
						size="xs"
						className="min-h-11"
						aria-label={t("gm.workbench.addMusicTrack", {
							name: candidate.name,
						})}
						disabled={
							disabled || added || candidate.availability === "unavailable"
						}
						onClick={onAdd}
					>
						{added
							? t("gm.workbench.musicAddedShort")
							: adding
								? t("gm.workbench.musicAdding")
								: t("gm.workbench.musicAdd")}
					</Button>
				</div>
			</div>
		</article>
	);
}

function MusicSourcePanel({
	moduleId,
	tracks,
	onAdded,
}: {
	moduleId: string | null;
	tracks: TrackDto[];
	onAdded: (track: TrackDto) => void;
}) {
	const [provider, setProvider] = useState<MusicProvider>("netease");
	const [type, setType] = useState<TrackDto["type"]>("bgm");
	const [query, setQuery] = useState("");
	const [reference, setReference] = useState("");
	const [results, setResults] = useState<MusicTrackDto[]>([]);
	const [resolved, setResolved] = useState<MusicTrackDto | null>(null);
	const [searched, setSearched] = useState(false);
	const [loading, setLoading] = useState<"search" | "resolve" | null>(null);
	const [addingKey, setAddingKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function showError(reason: unknown) {
		setError(
			reason instanceof Error
				? reason.message
				: t("gm.workbench.musicRequestFailed"),
		);
	}

	function changeProvider(value: string) {
		setProvider(value === "qq" ? "qq" : "netease");
		setResults([]);
		setResolved(null);
		setSearched(false);
		setError(null);
	}

	async function search() {
		const trimmed = query.trim();
		if (!trimmed || loading || addingKey) {
			return;
		}
		setLoading("search");
		setSearched(true);
		setError(null);
		try {
			setResults(await searchMusic(provider, trimmed));
		} catch (reason) {
			setResults([]);
			showError(reason);
		} finally {
			setLoading(null);
		}
	}

	async function resolve() {
		const trimmed = reference.trim();
		if (!trimmed || loading || addingKey) {
			return;
		}
		setLoading("resolve");
		setResolved(null);
		setError(null);
		try {
			setResolved(await resolveMusic(provider, trimmed));
		} catch (reason) {
			showError(reason);
		} finally {
			setLoading(null);
		}
	}

	async function add(referenceValue: string, key: string) {
		if (!moduleId || addingKey || !referenceValue.trim()) {
			return;
		}
		setAddingKey(key);
		setError(null);
		try {
			const added = await addExternalTrack(
				moduleId,
				provider,
				referenceValue.trim(),
				type,
			);
			onAdded(added);
			toast.success(t("gm.workbench.musicAdded", { name: added.name }));
		} catch (reason) {
			showError(reason);
		} finally {
			setAddingKey(null);
		}
	}

	function isAdded(candidate: MusicTrackDto) {
		return tracks.some(
			(track) =>
				track.source === candidate.provider &&
				track.externalId === candidate.externalId,
		);
	}

	function renderCandidate(candidate: MusicTrackDto) {
		const key = `${candidate.provider}:${candidate.externalId}`;
		return (
			<MusicCandidate
				key={key}
				candidate={candidate}
				added={isAdded(candidate)}
				adding={addingKey === key}
				disabled={!moduleId || addingKey !== null}
				onAdd={() => void add(candidate.externalId, key)}
			/>
		);
	}

	return (
		<section
			aria-label={t("gm.workbench.addPlatformTracks")}
			className="flex flex-col gap-3 rounded-xl bg-md-surface-container-low p-3"
		>
			<h4 className="text-md-on-surface text-label-large-emph">
				{t("gm.workbench.addPlatformTracks")}
			</h4>
			<div className="grid grid-cols-2 gap-2">
				<GmSelectField
					label={t("gm.workbench.musicProvider")}
					value={provider}
					onValueChange={changeProvider}
					disabled={loading !== null || addingKey !== null}
				>
					<SelectItem value="netease">
						{t("gm.workbench.providerNetease")}
					</SelectItem>
					<SelectItem value="qq">{t("gm.workbench.providerQq")}</SelectItem>
				</GmSelectField>
				<GmSelectField
					label={t("gm.workbench.musicTrackType")}
					value={type}
					onValueChange={(value) => setType(value === "se" ? "se" : "bgm")}
					disabled={loading !== null || addingKey !== null}
				>
					<SelectItem value="bgm">{t("gm.workbench.typeBgm")}</SelectItem>
					<SelectItem value="se">{t("gm.workbench.typeSe")}</SelectItem>
				</GmSelectField>
			</div>
			<Tabs defaultValue="search" onValueChange={() => setError(null)}>
				<TabsList className="h-auto min-h-11 w-full">
					<TabsTrigger value="search" className="min-h-10">
						{t("gm.workbench.musicSearchTab")}
					</TabsTrigger>
					<TabsTrigger value="reference" className="min-h-10">
						{t("gm.workbench.musicReferenceTab")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="search">
					<form
						className="flex items-center gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void search();
						}}
					>
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							aria-label={t("gm.workbench.musicQuery")}
							placeholder={t("gm.workbench.musicQueryPlaceholder")}
							disabled={loading !== null || addingKey !== null}
						/>
						<Button
							type="submit"
							variant="tonal"
							size="sm"
							className="min-h-11 shrink-0 px-3"
							disabled={!query.trim() || loading !== null || addingKey !== null}
						>
							<Search data-icon="inline-start" />
							{t("gm.workbench.musicSearch")}
						</Button>
					</form>
				</TabsContent>
				<TabsContent value="reference" className="flex flex-col gap-2">
					<Input
						value={reference}
						onChange={(event) => setReference(event.target.value)}
						aria-label={t("gm.workbench.musicReference")}
						placeholder={t("gm.workbench.musicReferencePlaceholder")}
						disabled={loading !== null || addingKey !== null}
					/>
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							type="button"
							variant="text"
							className="min-h-11"
							disabled={
								!reference.trim() || loading !== null || addingKey !== null
							}
							onClick={() => void resolve()}
						>
							{t("gm.workbench.musicResolve")}
						</Button>
						<Button
							type="button"
							variant="tonal"
							className="min-h-11"
							disabled={
								!moduleId ||
								!reference.trim() ||
								loading !== null ||
								addingKey !== null
							}
							onClick={() =>
								void add(reference, `reference:${provider}:${reference}`)
							}
						>
							{addingKey?.startsWith("reference:")
								? t("gm.workbench.musicAdding")
								: t("gm.workbench.musicAddDirect")}
						</Button>
					</div>
				</TabsContent>
			</Tabs>
			{error ? (
				<p role="alert" className="text-danger text-body-medium">
					{error}
				</p>
			) : null}
			{loading ? (
				<p
					role="status"
					className="text-md-on-surface-variant flex items-center gap-2 text-body-medium"
				>
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					{loading === "search"
						? t("gm.workbench.musicSearching")
						: t("gm.workbench.musicResolving")}
				</p>
			) : null}
			{addingKey ? (
				<p
					role="status"
					className="text-md-on-surface-variant text-body-medium"
				>
					{t("gm.workbench.musicVerifyingAdd")}
				</p>
			) : null}
			{resolved ? renderCandidate(resolved) : null}
			{!loading && searched && results.length === 0 && !error ? (
				<p className="text-md-on-surface-variant text-body-medium">
					{t("gm.workbench.musicSearchEmpty")}
				</p>
			) : null}
			<div className="flex flex-col gap-2">{results.map(renderCandidate)}</div>
		</section>
	);
}

export { MusicSourcePanel };
