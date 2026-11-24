import type { SiteSystemInfoDto } from "@cogm/shared";
import { t } from "@/i18n";

interface SystemInfoPanelProps {
	system: SiteSystemInfoDto;
}

export function SystemInfoPanel({ system }: SystemInfoPanelProps) {
	const rows: Array<{ label: string; value: string; mono?: boolean }> = [
		{
			label: t("admin.settings.system.version"),
			value: system.version,
			mono: true,
		},
		{
			label: t("admin.settings.system.environment"),
			value: system.environment,
			mono: true,
		},
		{
			label: t("admin.settings.system.host"),
			value: system.host ?? t("admin.settings.system.defaultValue"),
			mono: true,
		},
		{
			label: t("admin.settings.system.port"),
			value: String(system.port),
			mono: true,
		},
		{
			label: t("admin.settings.system.databaseUrl"),
			value: system.databaseUrl,
			mono: true,
		},
		{
			label: t("admin.settings.system.backupDir"),
			value: system.backupDir ?? t("admin.settings.system.defaultValue"),
			mono: true,
		},
		{
			label: t("admin.settings.system.mediaDir"),
			value: system.mediaDir,
			mono: true,
		},
		{
			label: t("admin.settings.system.themesDir"),
			value: system.themesDir,
			mono: true,
		},
		{
			label: t("admin.settings.system.secretSource"),
			value: t(
				`admin.settings.system.secretSource.${system.secretsEncryptionSource}`,
			),
		},
		...(system.commit
			? [
					{
						label: t("admin.settings.system.commit"),
						value: system.commit,
						mono: true,
					},
				]
			: []),
		...(system.buildTime
			? [
					{
						label: t("admin.settings.system.buildTime"),
						value: system.buildTime,
						mono: true,
					},
				]
			: []),
	];

	return (
		<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-foreground font-sans text-title-large-emph">
					{t("admin.settings.system.title")}
				</h2>
				<p className="text-md-on-surface-variant text-body-medium">
					{t("admin.settings.system.description")}
				</p>
			</div>

			<dl className="bg-md-surface-container-high divide-separator-secondary/60 divide-y rounded-xl">
				{rows.map((row) => (
					<div
						key={row.label}
						className="grid gap-1 px-4 py-3 md:grid-cols-[220px_1fr] md:items-center"
					>
						<dt className="text-md-on-surface-variant text-label-large">
							{row.label}
						</dt>
						<dd
							className={
								row.mono
									? "text-foreground break-all font-mono text-body-medium"
									: "text-foreground text-body-medium"
							}
						>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
