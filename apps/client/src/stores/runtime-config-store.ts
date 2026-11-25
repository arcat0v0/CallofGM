import {
	DEFAULT_MAX_THEME_UPLOAD_MB,
	MAX_MEDIA_UPLOAD_BYTES,
	type PublicRuntimeConfigDto,
	type StorageMode,
} from "@cogm/shared";
import { create } from "zustand";
import { api } from "@/lib/api";

const DEFAULT_MAX_THEME_BYTES = DEFAULT_MAX_THEME_UPLOAD_MB * 1024 * 1024;

interface RuntimeConfigState {
	storageMode: StorageMode;
	maxMediaUploadBytes: number;
	maxThemeUploadBytes: number;
	diceAssetBaseUrl: string | null;
	loaded: boolean;
	load: (force?: boolean) => Promise<void>;
	apply: (config: Partial<PublicRuntimeConfigDto>) => void;
}

let inflight: Promise<void> | null = null;

export const useRuntimeConfigStore = create<RuntimeConfigState>((set, get) => ({
	storageMode: "local",
	maxMediaUploadBytes: MAX_MEDIA_UPLOAD_BYTES,
	maxThemeUploadBytes: DEFAULT_MAX_THEME_BYTES,
	diceAssetBaseUrl: null,
	loaded: false,
	apply: (config) =>
		set((prev) => ({
			storageMode: config.storageMode ?? prev.storageMode,
			maxMediaUploadBytes:
				config.maxMediaUploadBytes ?? prev.maxMediaUploadBytes,
			maxThemeUploadBytes:
				config.maxThemeUploadBytes ?? prev.maxThemeUploadBytes,
			diceAssetBaseUrl:
				config.diceAssetBaseUrl !== undefined
					? config.diceAssetBaseUrl
					: prev.diceAssetBaseUrl,
			loaded: true,
		})),
	load: async (force = false) => {
		if (get().loaded && !force) {
			return;
		}
		if (inflight && !force) {
			return inflight;
		}
		inflight = api<PublicRuntimeConfigDto>("/public/runtime-config", {
			cache: "no-store",
		})
			.then((data) => {
				if (data && typeof data === "object" && "storageMode" in data) {
					set({
						storageMode: data.storageMode,
						maxMediaUploadBytes: data.maxMediaUploadBytes,
						maxThemeUploadBytes: data.maxThemeUploadBytes,
						diceAssetBaseUrl: data.diceAssetBaseUrl ?? null,
						loaded: true,
					});
				}
			})
			.catch(() => undefined)
			.finally(() => {
				inflight = null;
			});
		return inflight;
	},
}));
