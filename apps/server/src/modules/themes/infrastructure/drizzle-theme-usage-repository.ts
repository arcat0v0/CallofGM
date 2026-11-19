import { eq, isNotNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { modules, uiSettings } from "@/platform/db/schema";
import type { ThemeUsageRepository } from "../application/theme-usage-repository";

export class DrizzleThemeUsageRepository implements ThemeUsageRepository {
	constructor(private readonly db: DbClient) {}

	async getUsage() {
		const rows = await this.db
			.select({ themeId: modules.themeId })
			.from(modules)
			.where(isNotNull(modules.themeId));
		const counts = new Map<string, number>();
		for (const row of rows) {
			if (row.themeId) {
				counts.set(row.themeId, (counts.get(row.themeId) ?? 0) + 1);
			}
		}
		const settings = await this.db
			.select({ gmThemeId: uiSettings.gmThemeId })
			.from(uiSettings)
			.where(eq(uiSettings.id, "singleton"))
			.limit(1);
		return { counts, gmThemeId: settings[0]?.gmThemeId ?? null };
	}
}
