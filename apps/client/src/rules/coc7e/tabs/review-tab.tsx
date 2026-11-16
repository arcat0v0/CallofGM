import type { coc7e } from "@cogm/shared";
import { AlertTriangle, CheckCircle2, OctagonAlert, Save } from "lucide-react";
import { SheetSection } from "@/components/shared/creation-form";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import type { Coc7eTabId, Coc7eValidationState } from "../creation-validation";

export function Coc7eReviewTab({
	sheet,
	validation,
	onSelectTab,
	onSubmitAction,
	submitLabel,
	submitPending,
}: {
	sheet: coc7e.Coc7eCharacterSheet;
	validation: Coc7eValidationState;
	onSelectTab: (tab: Coc7eTabId) => void;
	onSubmitAction?: () => void;
	submitLabel?: string;
	submitPending?: boolean;
}) {
	return (
		<SheetSection
			title={t("characterCreation.reviewTitle")}
			description={t("characterCreation.reviewPageHint")}
		>
			<div className="border-md-outline-variant/40 bg-md-surface-container rounded-xl border px-4 py-3 font-mono text-body-small text-foreground-secondary">
				{t("characterCreation.reviewSummaryCounts", {
					filled: validation.filledBackgroundCount,
					weapons: sheet.weapons.length,
					gear: sheet.gear.length,
					worn: validation.wornGearCount,
					pack: validation.backpackGearCount,
					exp: sheet.experiences.length,
				})}
			</div>

			{validation.issues.length === 0 ? (
				<div className="bg-md-surface-container text-success flex items-center gap-2.5 rounded-xl px-4 py-3 text-body-medium">
					<CheckCircle2 className="size-4 shrink-0" />
					<span>{t("characterCreation.reviewAllClear")}</span>
				</div>
			) : null}

			{validation.blockers.length > 0 ? (
				<div className="flex flex-col gap-2">
					<h3 className="text-label-large-emph text-danger">
						{t("characterCreation.reviewBlockersHeader", {
							count: validation.blockers.length,
						})}
					</h3>
					{validation.blockers.map((issue) => (
						<div
							key={issue.id}
							className="bg-danger-soft text-danger-soft-foreground flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
						>
							<div className="flex items-start gap-2">
								<OctagonAlert className="mt-0.5 size-4 shrink-0" />
								<span className="text-body-medium">{issue.message}</span>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onSelectTab(issue.targetTab ?? issue.tab)}
							>
								{issue.targetLabel ?? t("characterCreation.reviewGoFix")}
							</Button>
						</div>
					))}
				</div>
			) : null}

			{validation.warnings.length > 0 ? (
				<div className="flex flex-col gap-2">
					<h3 className="text-label-large-emph text-warning">
						{t("characterCreation.reviewWarningsHeader", {
							count: validation.warnings.length,
						})}
					</h3>
					{validation.warnings.map((issue) => (
						<div
							key={issue.id}
							className="bg-warning-soft text-warning-soft-foreground flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
						>
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<span className="text-body-medium">{issue.message}</span>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onSelectTab(issue.targetTab ?? issue.tab)}
							>
								{issue.targetLabel ?? t("characterCreation.reviewGoFix")}
							</Button>
						</div>
					))}
				</div>
			) : null}

			{onSubmitAction ? (
				<div className="flex justify-end pt-2">
					<Button
						type="button"
						variant="primary"
						disabled={submitPending}
						onClick={onSubmitAction}
					>
						<Save />
						{submitLabel ?? t("common.save")}
					</Button>
				</div>
			) : null}
		</SheetSection>
	);
}
