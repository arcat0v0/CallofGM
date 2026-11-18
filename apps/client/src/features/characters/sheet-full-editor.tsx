import type { CharacterSheetContextResponse } from "@cogm/shared";
import type { ReactNode } from "react";
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
	onChange: (sheet: unknown) => void;
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
	const CreationEditor = getRuleComponent(ruleId).creationEditor;
	return (
		<CreationEditor
			sheet={sheet}
			onChange={onChange}
			showValidation={showValidation}
			onValidityChange={onValidityChange}
			onWarningsChange={onWarningsChange}
			characterName={characterName}
			onCharacterNameChange={onCharacterNameChange}
			background={background}
			onBackgroundChange={onBackgroundChange}
			portraitPreviewUrl={portraitPreviewUrl}
			portraitPending={portraitPending}
			onPickPortraitFile={onPickPortraitFile}
			onClearPendingPortrait={onClearPendingPortrait}
			onManageExpressions={onManageExpressions}
			sheetContext={sheetContext}
			onSubmitAction={onSubmitAction}
			submitLabel={submitLabel}
			submitPending={submitPending}
			identityHeaderSlot={identityHeaderSlot}
		/>
	);
}
