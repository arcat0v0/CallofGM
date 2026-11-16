import { coc7e } from "@cogm/shared";
import { AlertTriangle, ListChecks, Plus, Trash2 } from "lucide-react";
import {
	NumericField,
	SelectField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import { Coc7eOccupationChoiceEditor } from "../occupation-choice-editor";
import { Coc7eOccupationReferenceTable } from "../occupation-reference-table";

type Sheet = coc7e.Coc7eCharacterSheet;
type AttributeKey = coc7e.Coc7eAttributeKey;

const ATTRIBUTE_OPTIONS: Array<{ value: AttributeKey; label: string }> = (
	["str", "con", "siz", "dex", "app", "int", "pow", "edu", "luck"] as const
).map((key) => ({
	value: key,
	label: `${coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? key} ${coc7e.COC7E_ATTRIBUTE_LABELS[key]?.abbr ?? key.toUpperCase()}`,
}));

export function Coc7eOccupationTab({
	sheet,
	onChange,
	showValidation,
	reportError,
	customMode,
	setCustomMode,
	referenceOpen,
	setReferenceOpen,
	eraNotice,
	onJumpToAssets,
	onAddSkillKey,
}: {
	sheet: Sheet;
	onChange: (patch: Partial<Sheet>) => void;
	showValidation: boolean;
	reportError: (key: string, message: string | null) => void;
	customMode: boolean;
	setCustomMode: (value: boolean) => void;
	referenceOpen: boolean;
	setReferenceOpen: (value: boolean) => void;
	eraNotice: boolean;
	onJumpToAssets: () => void;
	onAddSkillKey: (key: string, base: number) => void;
}) {
	const derived = coc7e.deriveCoc7eSheetStats(sheet);
	const occupation = coc7e.coc7eOccupation(sheet.occupation.presetId);
	const referenceCount = coc7e.COC7E_OCCUPATIONS.length;
	const customActive =
		sheet.occupation.presetId === null &&
		(customMode ||
			sheet.occupation.name.trim() !== "" ||
			sheet.occupation.skillPointFormula.length > 0 ||
			sheet.occupation.skillKeys.length > 0);
	const credit = coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0;
	const creditOutOfRange =
		credit < sheet.occupation.creditMin || credit > sheet.occupation.creditMax;

	function updateOccupation(patch: Partial<Sheet["occupation"]>) {
		onChange({ occupation: { ...sheet.occupation, ...patch } });
	}

	function applyOccupation(definition: coc7e.Coc7eOccupationDefinition) {
		const next = coc7e.coc7eOccupationFromDefinition(definition.id);
		if (!next) {
			return;
		}
		setCustomMode(false);
		onChange({ occupation: next });
	}

	function selectCustomOccupation() {
		setCustomMode(true);
		updateOccupation(coc7e.coc7eClearOccupation());
	}

	function cancelCustomOccupation() {
		setCustomMode(false);
		onChange({ occupation: coc7e.coc7eClearOccupation() });
	}

	return (
		<SheetSection
			title={t("characterCreation.tabOccupation")}
			description={t("characterCreation.occupationPageHint")}
		>
			{creditOutOfRange ? (
				<div
					role="status"
					className="bg-warning-soft text-warning-soft-foreground flex flex-col gap-2 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex items-start gap-2.5">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div className="flex flex-col gap-0.5">
							<span className="text-label-large-emph">
								{t("characterCreation.creditAlertTitle", {
									value: credit,
									min: sheet.occupation.creditMin,
									max: sheet.occupation.creditMax,
								})}
							</span>
							<span className="text-body-small opacity-90">
								{t("characterCreation.creditAlertBody")}
							</span>
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={onJumpToAssets}
					>
						{t("characterCreation.goToAssetsTab")}
					</Button>
				</div>
			) : null}

			{occupation ? (
				<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-4 rounded-2xl border p-4">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-serif text-title-large-emph text-foreground">
							{sheet.occupation.name}
						</h3>
						<Badge variant="soft" tone="accent" size="sm">
							{t("characterCreation.occupationSelected")}
						</Badge>
						<Badge variant="soft" tone="default" size="sm">
							{t("occupation.creditRange", {
								min: occupation.creditMin,
								max: occupation.creditMax,
							})}
						</Badge>
						<div className="ms-auto flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setReferenceOpen(true)}
							>
								<ListChecks className="size-4" />
								{t("characterCreation.changeOccupation")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={selectCustomOccupation}
							>
								{t("characterCreation.customOccupation")}
							</Button>
						</div>
					</div>

					<div className="border-md-outline-variant/30 bg-md-surface-container-high flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5">
						<span className="font-mono text-body-medium text-foreground">
							{t("characterCreation.occupationPointsReady", {
								points: derived.occupationSkillPoints,
							})}
						</span>
						<span className="font-mono text-label-small text-foreground-secondary">
							{t("characterCreation.occupationCreditRangeTag", {
								min: sheet.occupation.creditMin,
								max: sheet.occupation.creditMax,
							})}
						</span>
					</div>

					<SelectField
						label={t("characterCreation.occupationFormula")}
						value={String(
							Math.max(
								0,
								occupation.skillPointOptions.findIndex(
									(formula) =>
										JSON.stringify(formula) ===
										JSON.stringify(sheet.occupation.skillPointFormula),
								),
							),
						)}
						options={occupation.skillPointOptions.map((formula, index) => ({
							value: String(index),
							label: formula
								.map(
									(part) =>
										`${coc7e.COC7E_ATTRIBUTE_LABELS[part.attribute]?.abbr ?? part.attribute}×${part.multiplier}`,
								)
								.join(" + "),
						}))}
						onChange={(value) => {
							const formula = occupation.skillPointOptions[Number(value)];
							if (formula) {
								updateOccupation({ skillPointFormula: [...formula] });
							}
						}}
					/>
					<Coc7eOccupationChoiceEditor
						sheet={sheet}
						onChange={(next) => onChange({ occupation: next })}
						onAddSkill={onAddSkillKey}
					/>
				</div>
			) : customActive ? (
				<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-4 rounded-2xl border border-dashed p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-title-medium-emph text-foreground">
							{t("characterCreation.customOccupation")}
						</h3>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setReferenceOpen(true)}
							>
								<ListChecks className="size-4" />
								{t("characterCreation.pickFromReference")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-danger"
								onClick={cancelCustomOccupation}
							>
								{t("characterCreation.cancelCustomOccupation")}
							</Button>
						</div>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<TextField
							label={t("characterCreation.occupationName")}
							value={sheet.occupation.name}
							showValidation={showValidation}
							onChange={(name) => updateOccupation({ name })}
						/>
						<div className="grid grid-cols-2 gap-3">
							<NumericField
								label={t("characterCreation.creditMin")}
								value={sheet.occupation.creditMin}
								min={0}
								max={99}
								showValidation={showValidation}
								onErrorChange={(message) => reportError("creditMin", message)}
								onChange={(value) =>
									updateOccupation({ creditMin: value ?? 0 })
								}
							/>
							<NumericField
								label={t("characterCreation.creditMax")}
								value={sheet.occupation.creditMax}
								min={0}
								max={99}
								showValidation={showValidation}
								onErrorChange={(message) => reportError("creditMax", message)}
								onChange={(value) =>
									updateOccupation({ creditMax: value ?? 99 })
								}
							/>
						</div>
					</div>
					<div className="bg-md-surface-container-high flex flex-col gap-3 rounded-xl p-4">
						<div className="flex items-center justify-between gap-3">
							<h3 className="text-label-large-emph text-foreground">
								{t("characterCreation.customFormula")}
							</h3>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={sheet.occupation.skillPointFormula.length >= 4}
								onClick={() =>
									updateOccupation({
										skillPointFormula: [
											...sheet.occupation.skillPointFormula,
											{ attribute: "edu", multiplier: 1 },
										],
									})
								}
							>
								<Plus />
								{t("characterCreation.addFormulaPart")}
							</Button>
						</div>
						{sheet.occupation.skillPointFormula.map((part, index) => (
							<div
								key={`${part.attribute}-${part.multiplier}-${index}`}
								className="grid grid-cols-[1fr_7rem_2.5rem] items-end gap-2"
							>
								<SelectField
									label={t("characterCreation.formulaPart", {
										index: index + 1,
									})}
									value={part.attribute}
									options={ATTRIBUTE_OPTIONS}
									onChange={(value) => {
										const formula = [...sheet.occupation.skillPointFormula];
										formula[index] = {
											...part,
											attribute: value as AttributeKey,
										};
										updateOccupation({ skillPointFormula: formula });
									}}
								/>
								<NumericField
									label={t("characterCreation.attributeMultiplier", {
										attribute:
											coc7e.COC7E_ATTRIBUTE_LABELS[part.attribute]?.abbr ??
											part.attribute,
									})}
									value={part.multiplier}
									min={1}
									max={8}
									showValidation={showValidation}
									onErrorChange={(message) =>
										reportError(`formula-${index}`, message)
									}
									onChange={(value) => {
										const formula = [...sheet.occupation.skillPointFormula];
										formula[index] = { ...part, multiplier: value ?? 1 };
										updateOccupation({ skillPointFormula: formula });
									}}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("common.delete")}
									onClick={() =>
										updateOccupation({
											skillPointFormula:
												sheet.occupation.skillPointFormula.filter(
													(_, itemIndex) => itemIndex !== index,
												),
										})
									}
								>
									<Trash2 />
								</Button>
							</div>
						))}
						<span className="font-mono text-body-small text-foreground-secondary">
							{t("characterCreation.occupationPointsReady", {
								points: derived.occupationSkillPoints,
							})}
						</span>
					</div>
					<div className="flex flex-col gap-2 rounded-xl bg-md-surface-container-high px-4 py-3">
						<span className="text-label-medium text-foreground-secondary">
							{t("characterCreation.occupationReference")}
						</span>
						<div className="flex flex-wrap gap-1.5">
							{sheet.occupation.skillKeys.map((key) => (
								<Badge key={key} variant="soft" tone="default" size="sm">
									{key}
								</Badge>
							))}
						</div>
						<p className="text-foreground-tertiary text-body-small">
							{t("characterCreation.customOccupationHint")}
						</p>
					</div>
				</div>
			) : (
				<div className="border-md-outline-variant/60 flex flex-col gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center">
					<p className="text-body-medium text-foreground-secondary flex-1">
						{t("characterCreation.occupationEmptyHint")}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button type="button" onClick={() => setReferenceOpen(true)}>
							<ListChecks className="size-4" />
							{t("characterCreation.selectOccupation")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={selectCustomOccupation}
						>
							{t("characterCreation.customOccupation")}
						</Button>
					</div>
				</div>
			)}

			{eraNotice ? (
				<p
					role="status"
					className="rounded-xl bg-warning-soft px-4 py-3 text-body-medium text-warning-soft-foreground"
				>
					{t("characterCreation.modernOccupationRetained")}
				</p>
			) : null}

			<Dialog open={referenceOpen} onOpenChange={setReferenceOpen}>
				<DialogContent className="max-w-5xl">
					<DialogHeader>
						<DialogTitle>
							{t("occupation.referenceTable", { count: referenceCount })}
						</DialogTitle>
					</DialogHeader>
					<div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
						<Coc7eOccupationReferenceTable
							attributes={sheet.attributes}
							selectedId={sheet.occupation.presetId}
							onSelect={(definition) => {
								applyOccupation(definition);
								setReferenceOpen(false);
							}}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</SheetSection>
	);
}
