import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { installedThemes } from "@/platform/db/schema";
import type {
	StoredThemeMetadata,
	ThemeMetadataRepository,
} from "../application/theme-metadata-repository";

function parseFilesJson(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === "string")
			: [];
	} catch {
		return [];
	}
}

export class DrizzleThemeMetadataRepository implements ThemeMetadataRepository {
	constructor(private readonly db: DbClient) {}

	async listAll(): Promise<StoredThemeMetadata[]> {
		const rows = await this.db.select().from(installedThemes);
		return rows.map((row) => ({
			key: row.key,
			id: row.id,
			version: row.version,
			manifestJson: row.manifestJson,
			digest: row.digest,
			hasPreview: row.hasPreview === 1,
			storageProvider: row.storageProvider === "s3" ? "s3" : "local",
			storagePrefix: row.storagePrefix,
			files: parseFilesJson(row.filesJson),
			installedAt: row.installedAt,
		}));
	}

	async upsert(entry: StoredThemeMetadata): Promise<void> {
		const values = {
			key: entry.key,
			id: entry.id,
			version: entry.version,
			manifestJson: entry.manifestJson,
			digest: entry.digest,
			hasPreview: entry.hasPreview ? 1 : 0,
			storageProvider: entry.storageProvider,
			storagePrefix: entry.storagePrefix,
			filesJson: JSON.stringify(entry.files),
			installedAt: entry.installedAt,
		};
		await this.db
			.insert(installedThemes)
			.values(values)
			.onConflictDoUpdate({
				target: installedThemes.key,
				set: {
					manifestJson: values.manifestJson,
					digest: values.digest,
					hasPreview: values.hasPreview,
					storageProvider: values.storageProvider,
					storagePrefix: values.storagePrefix,
					filesJson: values.filesJson,
					installedAt: values.installedAt,
				},
			});
	}

	async deleteByKey(key: string): Promise<void> {
		await this.db.delete(installedThemes).where(eq(installedThemes.key, key));
	}

	async deleteById(id: string): Promise<void> {
		await this.db.delete(installedThemes).where(eq(installedThemes.id, id));
	}
}
