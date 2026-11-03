import { create } from "zustand";
import { t } from "@/i18n";
import { errorText } from "@/lib/errors";
import { fetchGmUiSettings, updateGmUiSettings } from "@/themes/themes-api";

type GmSettingsState = {
	loaded: boolean;
	loading: boolean;
	error: string | null;
	gmThemeId: string | null;
	load: () => Promise<void>;
	setGmThemeId: (themeId: string | null) => Promise<void>;
};

export const useGmSettingsStore = create<GmSettingsState>((set, get) => ({
	loaded: false,
	loading: false,
	error: null,
	gmThemeId: null,
	async load() {
		if (get().loading) {
			return;
		}
		set({ loading: true, error: null });
		try {
			const settings = await fetchGmUiSettings();
			set({ loaded: true, loading: false, gmThemeId: settings.gmThemeId });
		} catch (error) {
			set({
				loading: false,
				loaded: true,
				error: errorText(error, "gm.themeControl.loadFailed"),
			});
		}
	},
	async setGmThemeId(themeId) {
		const previous = get().gmThemeId;
		set({ gmThemeId: themeId, error: null });
		try {
			const settings = await updateGmUiSettings(themeId);
			set({ gmThemeId: settings.gmThemeId });
		} catch (error) {
			set({
				gmThemeId: previous,
				error: errorText(error, "gm.themeControl.saveFailed"),
			});
		}
	},
}));
