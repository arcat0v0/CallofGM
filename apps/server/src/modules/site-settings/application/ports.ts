import type { S3CompatibleClient } from "@/platform/storage/s3-client";

export interface StoredSiteSettingsRow {
	section: string;
	valueJson: string;
	updatedAt: number;
}

export interface SiteSettingsRepository {
	listAll(): Promise<StoredSiteSettingsRow[]>;
	upsert(section: string, valueJson: string, updatedAt: number): Promise<void>;
	deleteSection(section: string): Promise<void>;
	deleteAll(): Promise<void>;
}

export interface LocalMediaMigrationItem {
	id: string;
	storageKey: string;
	filename: string;
	mimeType: string;
	size: number;
}

export interface MediaMigrationRepository {
	listLocalAssets(): Promise<LocalMediaMigrationItem[]>;
	markAssetMigratedToS3(
		id: string,
		storageKey: string,
		bucket: string,
	): Promise<void>;
}

export interface ThemeMigrationResult {
	total: number;
	migrated: number;
	skipped: number;
	failed: number;
	errors: Array<{ id: string; name: string; message: string }>;
}

export interface ThemeMigrationPort {
	migrateLocalThemesToS3(
		client: S3CompatibleClient,
		onProgress?: (progress: {
			total: number;
			migrated: number;
			skipped: number;
			failed: number;
		}) => void,
	): Promise<ThemeMigrationResult>;
}

export interface UiThemeSettingsPort {
	getGmThemeId(): Promise<string | null>;
	setGmThemeId(gmThemeId: string | null): Promise<string | null>;
}
