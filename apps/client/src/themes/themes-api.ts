import type {
	ThemeListResponse,
	ThemeSummaryDto,
	UiSettingsDto,
} from "@cogm/shared";
import { api } from "@/lib/api";

export async function listThemes(): Promise<ThemeSummaryDto[]> {
	const result = await api<ThemeListResponse>("/admin/themes");
	return result.items;
}

export async function fetchGmUiSettings(): Promise<UiSettingsDto> {
	return api<UiSettingsDto>("/public/ui-settings");
}

export async function updateGmUiSettings(
	gmThemeId: string | null,
): Promise<UiSettingsDto> {
	return api<UiSettingsDto>("/admin/ui-settings", {
		method: "PUT",
		body: JSON.stringify({ gmThemeId }),
	});
}

export async function uploadTheme(file: File): Promise<ThemeSummaryDto> {
	const body = new FormData();
	body.set("file", file, file.name);
	return api<ThemeSummaryDto>("/admin/themes", {
		method: "POST",
		body,
	});
}

export async function deleteTheme(id: string): Promise<void> {
	await api(`/admin/themes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function rescanThemes(): Promise<ThemeSummaryDto[]> {
	const result = await api<ThemeListResponse>("/admin/themes/rescan", {
		method: "POST",
	});
	return result.items;
}
