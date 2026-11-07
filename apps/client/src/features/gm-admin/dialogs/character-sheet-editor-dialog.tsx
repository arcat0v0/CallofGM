import type { CharacterDetailDto } from "@cogm/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SheetFullEditor } from "@/features/characters/sheet-full-editor";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { FALLBACK_RULE_ID, getRuleComponent } from "@/rules/registry";

function CharacterSheetEditorDialog({
	open,
	onOpenChange,
	characterId,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	characterId: string | null;
	onSaved?: () => void;
}) {
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"pc" | "npc">("pc");
	const [ruleId, setRuleId] = useState(FALLBACK_RULE_ID);
	const [version, setVersion] = useState(0);
	const [sheet, setSheet] = useState<unknown>(null);
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const rule = getRuleComponent(ruleId);

	useEffect(() => {
		if (!open || !characterId) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		void api<CharacterDetailDto>(
			`/gm/characters/${encodeURIComponent(characterId)}`,
		)
			.then((row) => {
				if (cancelled) {
					return;
				}
				const rowRule = getRuleComponent(row.ruleId);
				setRuleId(row.ruleId);
				setName(row.name);
				setKind(row.kind);
				setVersion(row.version);
				setSheet(rowRule.parseSheetJson(row.sheetJson) ?? rowRule.createEmptySheet());
				setShowValidation(false);
			})
			.catch((error) => {
				if (!cancelled) {
					toast.error(errorText(error, "gm.editSheet.loadFailed"));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open, characterId]);

	async function save() {
		if (!characterId || pending) {
			return;
		}
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error(t("gm.editSheet.nameRequired"));
			return;
		}
		const sheetData = rule.parseSheet(sheet);
		if (!sheetData || !sheetValid) {
			setShowValidation(true);
			toast.error(t("characterCreation.ruleValidationSummary"));
			return;
		}
		setPending(true);
		try {
			await api(`/gm/characters/${encodeURIComponent(characterId)}`, {
				method: "PATCH",
				body: JSON.stringify({
					name: trimmed,
					kind,
					sheetData,
					expectedVersion: version,
				}),
			});
			toast.success(t("gm.editSheet.saved"));
			onOpenChange(false);
			onSaved?.();
		} catch (error) {
			toast.error(errorText(error, "gm.editSheet.saveFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="border-separator-secondary/50 shrink-0 border-b px-6 pt-6 pb-4">
					<DialogTitle>{t("gm.editSheet.title")}</DialogTitle>
					<DialogDescription>{t("gm.editSheet.description")}</DialogDescription>
				</DialogHeader>

				{loading ? (
					<div className="flex min-h-56 items-center justify-center">
						<LoadingIndicator label={t("common.loading")} />
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<Label htmlFor="character-sheet-name">
									{t("gm.editSheet.name")}
								</Label>
								<Input
									id="character-sheet-name"
									value={name}
									maxLength={100}
									onChange={(event) => setName(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.editSheet.kind")}
								</span>
								<SegmentedControl
									value={kind}
									options={[
										{ value: "pc", label: t("common.pc") },
										{ value: "npc", label: t("common.npc") },
									]}
									onValueChange={(value) => setKind(value as "pc" | "npc")}
								/>
							</div>
						</div>
						<SheetFullEditor
							ruleId={ruleId}
							sheet={sheet}
							onChange={setSheet}
							showValidation={showValidation}
							onValidityChange={setSheetValid}
						/>
					</div>
				)}

				<DialogFooter className="border-separator-secondary/50 shrink-0 border-t px-6 py-4">
					<Button
						type="button"
						variant="tertiary"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={loading || pending}
						onClick={() => void save()}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { CharacterSheetEditorDialog };
