import type { CharacterSheetContextResponse, coc7e } from "@cogm/shared";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";

export function SheetFullEditor({
	ruleId,
	sheet,
	onChange,
	showValidation,
	onValidityChange,
	onWarningsChange,
	characterName,
	onCharacterNameChange,
	background,
	onBackgroundChange,
	portraitPreviewUrl,
	portraitPending,
	onPickPortraitFile,
	onClearPendingPortrait,
	onManageExpressions,
	sheetContext,
	onSubmitAction,
	submitLabel,
	submitPending,
	identityHeaderSlot,
}: {
	ruleId: string;
	sheet: unknown;
	onChange: (sheet: coc7e.Coc7eCharacterSheet) => void;
	showValidation: boolean;
	onValidityChange: (valid: boolean) => void;
	onWarningsChange?: (count: number) => void;
	characterName?: string;
	onCharacterNameChange?: (name: string) => void;
	background?: string;
	onBackgroundChange?: (background: string) => void;
	portraitPreviewUrl?: string | null;
	portraitPending?: boolean;
	onPickPortraitFile?: (file: File) => void;
	onClearPendingPortrait?: () => void;
	onManageExpressions?: () => void;
	sheetContext?: CharacterSheetContextResponse | null;
	onSubmitAction?: () => void;
	submitLabel?: string;
	submitPending?: boolean;
	identityHeaderSlot?: ReactNode;
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
		onWarningsChange,
		characterName,
		onCharacterNameChange,
		background,
		onBackgroundChange,
		portraitPreviewUrl,
		portraitPending,
		onPickPortraitFile,
		onClearPendingPortrait,
		onManageExpressions,
		sheetContext,
		onSubmitAction,
		submitLabel,
		submitPending,
		identityHeaderSlot,
	});
}
