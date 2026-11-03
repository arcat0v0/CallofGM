import type { ThemeSummaryDto } from "@cogm/shared";
import { eq, isNotNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { modules, uiSettings } from "@/platform/db/schema";
import { logger } from "@/platform/logging/logger";
import { ThemeInUseError } from "../domain/errors";
import type {
	InstalledTheme,
	ThemeRegistry,
} from "../infrastructure/theme-registry";

function toSummary(
	theme: InstalledTheme,
	usedByModules: number,
	usedByGmUi: boolean,
): ThemeSummaryDto {
	const { manifest } = theme;
	return {
		id: manifest.id,
		name: manifest.name,
		version: manifest.version,
		apiVersion: manifest.apiVersion,
		description: manifest.description ?? null,
		author: manifest.author ?? null,
		repository: manifest.repository ?? null,
		colorScheme: manifest.colorScheme ?? null,
		slots: manifest.slots ?? null,
		previewUrl: theme.hasPreview
			? `/api/v1/themes/${encodeURIComponent(manifest.id)}/versions/${encodeURIComponent(manifest.version)}/preview.png`
			: null,
		digest: theme.digest,
		installedAt: theme.installedAt,
		usedByModules,
		usedByGmUi,
	};
}

async function usage(
	db: DbClient,
): Promise<{ counts: Map<string, number>; gmThemeId: string | null }> {
	const rows = await db
		.select({ themeId: modules.themeId })
		.from(modules)
		.where(isNotNull(modules.themeId));
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (row.themeId) {
			counts.set(row.themeId, (counts.get(row.themeId) ?? 0) + 1);
		}
	}
	const settings = await db
		.select({ gmThemeId: uiSettings.gmThemeId })
		.from(uiSettings)
		.where(eq(uiSettings.id, "singleton"))
		.limit(1);
	return { counts, gmThemeId: settings[0]?.gmThemeId ?? null };
}

export class ListThemesUseCase {
	constructor(
		private readonly registry: ThemeRegistry,
		private readonly db: DbClient,
	) {}

	async execute(): Promise<ThemeSummaryDto[]> {
		await this.registry.ready();
		const { counts, gmThemeId } = await usage(this.db);
		return this.registry
			.list()
			.map((theme) =>
				toSummary(
					theme,
					counts.get(theme.manifest.id) ?? 0,
					theme.manifest.id === gmThemeId,
				),
			);
	}
}

export class InstallThemeUseCase {
	constructor(
		private readonly registry: ThemeRegistry,
		private readonly db: DbClient,
	) {}

	async execute(archive: Uint8Array): Promise<ThemeSummaryDto> {
		const installed = await this.registry.install(archive);
		const { counts, gmThemeId } = await usage(this.db);
		logger.audit("theme.install", {
			themeId: installed.manifest.id,
			version: installed.manifest.version,
			digest: installed.digest,
		});
		return toSummary(
			installed,
			counts.get(installed.manifest.id) ?? 0,
			installed.manifest.id === gmThemeId,
		);
	}
}

export class DeleteThemeUseCase {
	constructor(
		private readonly registry: ThemeRegistry,
		private readonly db: DbClient,
	) {}

	async execute(id: string): Promise<void> {
		await this.registry.ready();
		const theme = this.registry.get(id);
		if (!theme) {
			return;
		}
		const { counts, gmThemeId } = await usage(this.db);
		const usedByModules = counts.get(id) ?? 0;
		if (usedByModules > 0 || gmThemeId === id) {
			throw new ThemeInUseError("主题仍被模组或 GM 界面引用", {
				usedByModules,
				usedByGmUi: gmThemeId === id,
			});
		}
		await this.registry.remove(id);
		logger.audit("theme.delete", {
			themeId: id,
			version: theme.manifest.version,
		});
	}
}

export class RescanThemesUseCase {
	constructor(
		private readonly registry: ThemeRegistry,
		private readonly db: DbClient,
	) {}

	async execute(): Promise<ThemeSummaryDto[]> {
		await this.registry.rescan();
		const { counts, gmThemeId } = await usage(this.db);
		return this.registry
			.list()
			.map((theme) =>
				toSummary(
					theme,
					counts.get(theme.manifest.id) ?? 0,
					theme.manifest.id === gmThemeId,
				),
			);
	}
}
