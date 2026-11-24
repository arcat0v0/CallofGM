import type {
	StorageMigrationErrorItemDto,
	StorageMigrationStatusDto,
} from "@cogm/shared";
import type { MediaStorage } from "@/modules/media";
import { logger } from "@/platform/logging/logger";
import type { Clock } from "@/platform/ports";
import {
	extensionForMimeType,
	joinObjectKey,
} from "@/platform/storage/s3-client";
import { MigrationAlreadyRunningError } from "../domain/errors";
import type { MediaMigrationRepository, ThemeMigrationPort } from "./ports";
import type { SiteSettingsService } from "./site-settings-service";

const MAX_RECORDED_ERRORS = 50;

export class StorageMigrationService {
	private state: StorageMigrationStatusDto = {
		status: "idle",
		jobId: null,
		startedAt: null,
		finishedAt: null,
		media: { total: 0, migrated: 0, skipped: 0, failed: 0 },
		themes: { total: 0, migrated: 0, skipped: 0, failed: 0 },
		errors: [],
	};
	private runningPromise: Promise<void> | null = null;

	constructor(
		private readonly siteSettings: SiteSettingsService,
		private readonly localMediaStorage: MediaStorage,
		private readonly mediaMigrationRepo: MediaMigrationRepository,
		private readonly themeMigrationPort: ThemeMigrationPort,
		private readonly clock: Clock,
	) {}

	getStatus(): StorageMigrationStatusDto {
		return {
			...this.state,
			media: { ...this.state.media },
			themes: { ...this.state.themes },
			errors: [...this.state.errors],
		};
	}

	async startMigration(): Promise<StorageMigrationStatusDto> {
		if (this.runningPromise) {
			throw new MigrationAlreadyRunningError();
		}
		const client = this.siteSettings.requireS3Client();
		const s3Config = this.siteSettings.getStorageConfig().s3;
		const jobId = crypto.randomUUID();
		this.state = {
			status: "running",
			jobId,
			startedAt: this.clock.nowEpochMs(),
			finishedAt: null,
			media: { total: 0, migrated: 0, skipped: 0, failed: 0 },
			themes: { total: 0, migrated: 0, skipped: 0, failed: 0 },
			errors: [],
		};

		const run = async () => {
			try {
				const localAssets = await this.mediaMigrationRepo.listLocalAssets();
				this.state.media.total = localAssets.length;

				for (const asset of localAssets) {
					try {
						const data = await this.localMediaStorage.read(asset.storageKey);
						const ext = extensionForMimeType(asset.mimeType, asset.filename);
						const objectKey = joinObjectKey(
							s3Config.keyPrefix,
							"media",
							`${asset.id}${ext}`,
						);
						await client.putObject(objectKey, data, {
							contentType: asset.mimeType,
							cacheControl: "public, max-age=31536000, immutable",
						});
						await this.mediaMigrationRepo.markAssetMigratedToS3(
							asset.id,
							objectKey,
							s3Config.bucket,
						);
						this.state.media.migrated += 1;
					} catch (error) {
						this.state.media.failed += 1;
						this.pushError({
							kind: "media",
							id: asset.id,
							name: asset.filename,
							message: error instanceof Error ? error.message : String(error),
						});
					}
				}

				const themeResult =
					await this.themeMigrationPort.migrateLocalThemesToS3(
						client,
						(progress) => {
							this.state.themes = { ...progress };
						},
					);
				this.state.themes = {
					total: themeResult.total,
					migrated: themeResult.migrated,
					skipped: themeResult.skipped,
					failed: themeResult.failed,
				};
				for (const err of themeResult.errors) {
					this.pushError({
						kind: "theme",
						id: err.id,
						name: err.name,
						message: err.message,
					});
				}

				const totalFailed =
					this.state.media.failed + this.state.themes.failed;
				this.state.status = totalFailed > 0 ? "failed" : "completed";
				this.state.finishedAt = this.clock.nowEpochMs();
				logger.audit("admin.storage.migration.finished", {
					jobId,
					status: this.state.status,
					media: this.state.media,
					themes: this.state.themes,
				});
			} catch (error) {
				this.state.status = "failed";
				this.state.finishedAt = this.clock.nowEpochMs();
				this.pushError({
					kind: "media",
					id: "job",
					name: "migration",
					message: error instanceof Error ? error.message : String(error),
				});
				logger.error("admin.storage.migration.crashed", { jobId, err: error });
			} finally {
				this.runningPromise = null;
			}
		};

		this.runningPromise = run();
		return this.getStatus();
	}

	async waitForCompletion(): Promise<StorageMigrationStatusDto> {
		if (this.runningPromise) {
			await this.runningPromise;
		}
		return this.getStatus();
	}

	private pushError(item: StorageMigrationErrorItemDto): void {
		if (this.state.errors.length < MAX_RECORDED_ERRORS) {
			this.state.errors.push(item);
		}
	}
}
