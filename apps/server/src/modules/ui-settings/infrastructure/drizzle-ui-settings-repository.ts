import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { uiSettings } from "@/platform/db/schema";
import type { UiSettings, UiSettingsRepository } from "../application/ports";

export class DrizzleUiSettingsRepository implements UiSettingsRepository {
  constructor(private readonly db: DbClient) {}

  async get(): Promise<UiSettings | null> {
    const rows = await this.db
      .select({ gmThemeId: uiSettings.gmThemeId, updatedAt: uiSettings.updatedAt })
      .from(uiSettings)
      .where(eq(uiSettings.id, "singleton"))
      .limit(1);
    return rows[0] ?? null;
  }

  async set(gmThemeId: string | null, updatedAt: number): Promise<void> {
    await this.db
      .insert(uiSettings)
      .values({ id: "singleton", gmThemeId, updatedAt })
      .onConflictDoUpdate({
        target: uiSettings.id,
        set: { gmThemeId, updatedAt },
      });
  }
}