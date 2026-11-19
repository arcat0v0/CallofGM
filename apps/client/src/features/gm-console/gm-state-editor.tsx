import type { SnapshotCharacter } from "@cogm/shared";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";
import { GmPanelShell } from "./gm-panel-fields";

export function GmStateEditor({
	character,
	open,
	onOpenChange,
}: {
	character: SnapshotCharacter | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const Editor = getRuleComponent(character?.ruleId).stateEditor;
	const onClose = () => onOpenChange(false);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="border-0! bg-transparent! p-0! shadow-none! rounded-none! w-auto! max-w-none!"
			>
				{character ? (
					<Editor
						key={character.characterId}
						character={character}
						onClose={onClose}
					/>
				) : (
					<GmPanelShell
						title={t("gm.workbench.editState")}
						subtitle={t("gm.workbench.stateScope")}
						onClose={onClose}
						className="max-h-[calc(100dvh-48px)] shadow-modal"
					>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("gm.console.noTarget")}
						</p>
					</GmPanelShell>
				)}
			</DialogContent>
		</Dialog>
	);
}
