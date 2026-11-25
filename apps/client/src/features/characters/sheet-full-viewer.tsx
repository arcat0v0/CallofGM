import type {
	CharacterHistoryResponse,
	CharacterSheetContextResponse,
} from "@cogm/shared";
import { getRuleComponent } from "@/rules/registry";

export function SheetFullViewer({
	ruleId,
	sheet,
	background,
	sheetContext,
	history,
}: {
	ruleId: string;
	sheet: unknown;
	background: string;
	sheetContext?: CharacterSheetContextResponse | null;
	history?: CharacterHistoryResponse | null;
}) {
	const Viewer = getRuleComponent(ruleId).sheetViewer;
	return (
		<Viewer
			sheet={sheet}
			background={background}
			sheetContext={sheetContext}
			history={history}
		/>
	);
}
