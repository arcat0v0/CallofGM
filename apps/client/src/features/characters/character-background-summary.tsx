import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";

export function CharacterBackgroundSummary({
	background,
}: {
	background: string;
}) {
	const trimmed = background.trim();
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-md-on-surface-variant text-label-medium">
					{t("characterProfile.backgroundSummary")}
				</span>
				<Badge variant="soft" tone="default" size="sm">
					{t("characterProfile.backgroundAutoSynced")}
				</Badge>
			</div>
			<div className="bg-md-surface-container max-h-72 overflow-y-auto rounded-xl p-4">
				{trimmed ? (
					<p className="whitespace-pre-wrap text-body-medium text-foreground-secondary">
						{trimmed}
					</p>
				) : (
					<p className="text-body-medium text-foreground-tertiary">
						{t("characterProfile.backgroundEmpty")}
					</p>
				)}
			</div>
			<p className="text-body-small text-foreground-tertiary">
				{t("characterProfile.backgroundDerivedHint")}
			</p>
		</div>
	);
}
