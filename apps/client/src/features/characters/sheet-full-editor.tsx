import type { coc7e } from "@cogm/shared";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";

export function SheetFullEditor({
	ruleId,
	sheet,
	onChange,
	showValidation,
	onValidityChange,
}: {
	ruleId: string;
	sheet: unknown;
	onChange: (sheet: coc7e.Coc7eCharacterSheet) => void;
	showValidation: boolean;
	onValidityChange: (valid: boolean) => void;
}) {
	const rule = getRuleComponent(ruleId);
	const parsed = rule.parseSheet(sheet);
	if (!parsed) {
		return (
			<p role="alert" className="text-body-medium text-danger">
				{t("characterCreation.ruleValidationSummary")}
			</p>
		);
	}
	return rule.creationEditor({
		sheet: parsed as coc7e.Coc7eCharacterSheet,
		onChange,
		showValidation,
		onValidityChange,
	});
}
