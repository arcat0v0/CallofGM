import type { CatalogHandoutDto, SceneDto, TrackDto } from "@cogm/shared";
import type { PlaySliceCreator } from "../types";

export type CatalogSlice = {
	catalogScenes: SceneDto[];
	catalogTracks: TrackDto[];
	catalogHandouts: CatalogHandoutDto[];
	catalogStatus: "idle" | "loading" | "ready" | "error";
	catalogRevision: number;
	setCatalog: (input: {
		scenes?: SceneDto[];
		tracks?: TrackDto[];
		handouts?: CatalogHandoutDto[];
	}) => void;
	setCatalogStatus: (status: CatalogSlice["catalogStatus"]) => void;
	addCatalogTrack: (track: TrackDto) => void;
	reloadCatalog: () => void;
};

export const catalogDefaults = {
	catalogScenes: [] as SceneDto[],
	catalogTracks: [] as TrackDto[],
	catalogHandouts: [] as CatalogHandoutDto[],
	catalogStatus: "idle" as CatalogSlice["catalogStatus"],
	catalogRevision: 0,
};

export const createCatalogSlice: PlaySliceCreator<CatalogSlice> = (set) => ({
	...catalogDefaults,
	setCatalog: (input) => {
		set((state) => ({
			catalogScenes: input.scenes ?? state.catalogScenes,
			catalogTracks: input.tracks ?? state.catalogTracks,
			catalogHandouts: input.handouts ?? state.catalogHandouts,
			catalogStatus: "ready",
		}));
	},
	setCatalogStatus: (catalogStatus) => set({ catalogStatus }),
	addCatalogTrack: (track) =>
		set((state) => ({
			catalogTracks: state.catalogTracks.some((item) => item.id === track.id)
				? state.catalogTracks.map((item) =>
						item.id === track.id ? track : item,
					)
				: [...state.catalogTracks, track],
		})),
	reloadCatalog: () =>
		set((state) => ({
			catalogRevision: state.catalogRevision + 1,
			catalogStatus: "loading",
		})),
});
