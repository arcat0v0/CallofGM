import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
	TrackDto,
} from "@cogm/shared";

export type PlaylistImportFailure = {
	candidate: MusicTrackDto;
	message: string;
};

export type PlaylistImportProgress = {
	completed: number;
	total: number;
	current: MusicTrackDto | null;
	added: number;
	existing: number;
	failed: number;
};

export type PlaylistImportResult = {
	added: TrackDto[];
	existing: MusicTrackDto[];
	failures: PlaylistImportFailure[];
	completed: number;
	total: number;
	stopped: boolean;
};

type PlaylistImportOptions = {
	moduleId: string;
	provider: MusicProvider;
	type: TrackDto["type"];
	candidates: MusicTrackDto[];
	existingTracks: Array<Pick<TrackDto, "source" | "externalId">>;
	addTrack: (
		moduleId: string,
		provider: MusicProvider,
		externalId: string,
		type: TrackDto["type"],
	) => Promise<TrackDto>;
	formatError: (reason: unknown) => string;
	onAdded?: (track: TrackDto) => void;
	onProgress?: (progress: PlaylistImportProgress) => void;
};

export function playlistTrackKey(provider: MusicProvider, externalId: string) {
	return `${provider}:${externalId}`;
}

function uniqueProviderCandidates(
	candidates: MusicTrackDto[],
	provider: MusicProvider,
) {
	const unique = new Map<string, MusicTrackDto>();
	for (const candidate of candidates) {
		if (candidate.provider !== provider) {
			continue;
		}
		const key = playlistTrackKey(provider, candidate.externalId);
		if (!unique.has(key)) {
			unique.set(key, candidate);
		}
	}
	return [...unique.values()];
}

export function mergePlaylistItems(
	current: MusicTrackDto[],
	incoming: MusicPlaylistDto["items"],
	provider: MusicProvider,
) {
	const items = uniqueProviderCandidates([...current, ...incoming], provider);
	const currentKeys = new Set(
		uniqueProviderCandidates(current, provider).map((candidate) =>
			playlistTrackKey(provider, candidate.externalId),
		),
	);
	return {
		items,
		added: items.filter(
			(candidate) =>
				!currentKeys.has(playlistTrackKey(provider, candidate.externalId)),
		),
	};
}

export async function runPlaylistImport(
	options: PlaylistImportOptions,
	shouldStop: () => boolean = () => false,
): Promise<PlaylistImportResult> {
	const queue = uniqueProviderCandidates(options.candidates, options.provider);
	const existingKeys = new Set(
		options.existingTracks
			.filter((track) => track.source === options.provider && track.externalId)
			.map((track) =>
				playlistTrackKey(options.provider, track.externalId ?? ""),
			),
	);
	const added: TrackDto[] = [];
	const existing: MusicTrackDto[] = [];
	const failures: PlaylistImportFailure[] = [];
	let completed = 0;
	const report = (current: MusicTrackDto | null) => {
		options.onProgress?.({
			completed,
			total: queue.length,
			current,
			added: added.length,
			existing: existing.length,
			failed: failures.length,
		});
	};
	report(null);
	for (const candidate of queue) {
		if (shouldStop()) {
			break;
		}
		report(candidate);
		if (
			existingKeys.has(playlistTrackKey(options.provider, candidate.externalId))
		) {
			existing.push(candidate);
		} else {
			try {
				const addedTrack = await options.addTrack(
					options.moduleId,
					options.provider,
					candidate.externalId,
					options.type,
				);
				added.push(addedTrack);
				options.onAdded?.(addedTrack);
			} catch (reason) {
				failures.push({
					candidate,
					message: options.formatError(reason),
				});
			}
		}
		completed += 1;
		report(candidate);
	}
	report(null);
	return {
		added,
		existing,
		failures,
		completed,
		total: queue.length,
		stopped: completed < queue.length,
	};
}

export function createPlaylistImportRunner() {
	let active = false;
	let stopRequested = false;
	return {
		requestStop() {
			if (active) {
				stopRequested = true;
			}
		},
		async run(options: PlaylistImportOptions) {
			if (active) {
				return null;
			}
			active = true;
			stopRequested = false;
			try {
				return await runPlaylistImport(options, () => stopRequested);
			} finally {
				active = false;
			}
		},
	};
}
