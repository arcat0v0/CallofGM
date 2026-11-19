import type { ThemeSummaryDto } from "@cogm/shared";
import { logger } from "@/platform/logging/logger";
import { ThemeInUseError } from "../domain/errors";
import type {
	InstalledTheme,
	ThemeRegistry,
} from "../infrastructure/theme-registry";
import type { ThemeUsageRepository } from "./theme-usage-repository";

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

export class ListThemesUseCase {
	constructor(
		private readonly registry: ThemeRegistry,
		private readonly usageRepo: ThemeUsageRepository,
	) {}

	async execute(): Promise<ThemeSummaryDto[]> {
		await this.registry.ready();
		const { counts, gmThemeId } = await this.usageRepo.getUsage();
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
		private readonly usageRepo: ThemeUsageRepository,
	) {}

	async execute(archive: Uint8Array): Promise<ThemeSummaryDto> {
		const installed = await this.registry.install(archive);
		const { counts, gmThemeId } = await this.usageRepo.getUsage();
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
		private readonly usageRepo: ThemeUsageRepository,
	) {}

	async execute(id: string): Promise<void> {
		await this.registry.ready();
		const theme = this.registry.get(id);
		if (!theme) {
			return;
		}
		const { counts, gmThemeId } = await this.usageRepo.getUsage();
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
		private readonly usageRepo: ThemeUsageRepository,
	) {}

	async execute(): Promise<ThemeSummaryDto[]> {
		await this.registry.rescan();
		const { counts, gmThemeId } = await this.usageRepo.getUsage();
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
