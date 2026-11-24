import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { mediaAssets, siteSettings } from "@/platform/db/schema";
import type {
	LocalMediaMigrationItem,
	MediaMigrationRepository,
	SiteSettingsRepository,
	StoredSiteSettingsRow,
} from "../application/ports";

export class DrizzleSiteSettingsRepository
	implements SiteSettingsRepository, MediaMigrationRepository
{
	constructor(private readonly db: DbClient) {}

	async listAll(): Promise<StoredSiteSettingsRow[]> {
		return this.db
			.select({
				section: siteSettings.section,
				valueJson: siteSettings.valueJson,
				updatedAt: siteSettings.updatedAt,
			})
			.from(siteSettings);
	}

	async upsert(
		section: string,
		valueJson: string,
		updatedAt: number,
	): Promise<void> {
		await this.db
			.insert(siteSettings)
			.values({ section, valueJson, updatedAt })
			.onConflictDoUpdate({
				target: siteSettings.section,
				set: { valueJson, updatedAt },
			});
	}

	async deleteSection(section: string): Promise<void> {
		await this.db.delete(siteSettings).where(eq(siteSettings.section, section));
	}

	async deleteAll(): Promise<void> {
		await this.db.delete(siteSettings);
	}

	async listLocalAssets(): Promise<LocalMediaMigrationItem[]> {
		return this.db
			.select({
				id: mediaAssets.id,
				storageKey: mediaAssets.storageKey,
				filename: mediaAssets.filename,
				mimeType: mediaAssets.mimeType,
				size: mediaAssets.size,
			})
			.from(mediaAssets)
			.where(eq(mediaAssets.storageProvider, "local"));
	}

	async markAssetMigratedToS3(
		id: string,
		storageKey: string,
		bucket: string,
	): Promise<void> {
		await this.db
			.update(mediaAssets)
			.set({
				storageProvider: "s3",
				storageKey,
				storageBucket: bucket,
			})
			.where(eq(mediaAssets.id, id));
	}
}
