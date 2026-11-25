import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";

export function CharacterBackgroundSummary({
	ruleId,
	sheet,
}: {
	ruleId: string;
	sheet: unknown;
}) {
	const SummaryView =
		getRuleComponent(ruleId).capabilities?.sheetBackground?.renderSummary;
	if (!SummaryView) {
		return null;
	}
	return (
		<div className="flex flex-col gap-2.5">
			<span className="text-md-on-surface-variant text-label-medium">
				{t("characterProfile.backgroundStructuredTitle")}
			</span>
			<SummaryView sheet={sheet} />
		</div>
	);
}
