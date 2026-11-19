export interface ThemeUsageRepository {
	getUsage(): Promise<{
		counts: Map<string, number>;
		gmThemeId: string | null;
	}>;
}
