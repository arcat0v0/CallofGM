import { dnd5r } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import { GmPanelShell } from "@/features/gm-console/gm-panel-fields";
import { t } from "@/i18n";
import type { RuleStateEditorProps } from "../types";
import { DndStateActions } from "./runtime-actions";

export function DndStateEditor({ character, onClose }: RuleStateEditorProps) {
	const parsed = dnd5r.SessionState.safeParse(character.state);
	return (
		<GmPanelShell
			title={`${character.name} · ${t("gm.workbench.editState")}`}
			subtitle={t("dnd5r.state.editorDescription")}
			onClose={onClose}
			className="max-h-[calc(100dvh-48px)] shadow-modal"
			footer={
				<div className="flex justify-end">
					<Button type="button" variant="tertiary" onClick={onClose}>
						{t("common.close")}
					</Button>
				</div>
			}
		>
			{parsed.success ? (
				<DndStateActions character={character} state={parsed.data} gm />
			) : (
				<p className="text-body-medium text-foreground-secondary">
					{t("dnd5r.state.unavailable")}
				</p>
			)}
		</GmPanelShell>
	);
}
