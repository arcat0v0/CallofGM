import { coc7e } from "@cogm/shared";
import { t } from "@/i18n";

export type Coc7eTabId =
	| "identity"
	| "occupation"
	| "skills"
	| "background"
	| "equipment"
	| "experience"
	| "review";

export const COC7E_TAB_ORDER: ReadonlyArray<{
	id: Coc7eTabId;
	labelKey: string;
}> = [
	{ id: "identity", labelKey: "characterCreation.tabIdentity" },
	{ id: "occupation", labelKey: "characterCreation.tabOccupation" },
	{ id: "skills", labelKey: "characterCreation.tabSkills" },
	{ id: "background", labelKey: "characterCreation.tabBackground" },
	{ id: "equipment", labelKey: "characterCreation.tabEquipment" },
	{ id: "experience", labelKey: "characterCreation.tabExperience" },
	{ id: "review", labelKey: "characterCreation.tabReview" },
];

export type Coc7eIssue = {
	id: string;
	tab: Coc7eTabId;
	severity: "warning" | "blocker";
	message: string;
	targetTab?: Coc7eTabId;
	targetLabel?: string;
};

export type Coc7eValidationState = {
	issues: Coc7eIssue[];
	warnings: Coc7eIssue[];
	blockers: Coc7eIssue[];
	tabCounts: Record<Coc7eTabId, number>;
	tabHasBlocker: Record<Coc7eTabId, boolean>;
	filledBackgroundCount: number;
	wornGearCount: number;
	backpackGearCount: number;
};

function errorTab(key: string): Coc7eTabId {
	if (
		key === "age" ||
		key === "movementModifier" ||
		key.startsWith("attribute-")
	) {
		return "identity";
	}
	if (
		key === "creditMin" ||
		key === "creditMax" ||
		key.startsWith("formula-")
	) {
		return "occupation";
	}
	if (
		key.startsWith("skill-") ||
		key.startsWith("custom-base-") ||
		key === "new-custom-base"
	) {
		return "skills";
	}
	return "equipment";
}

export function computeCoc7eValidation(
	sheet: coc7e.Coc7eCharacterSheet,
	errors: Record<string, string>,
	characterName?: string,
	onCharacterNameChange?: (name: string) => void,
): Coc7eValidationState {
	const issues: Coc7eIssue[] = [];
	const ledger = coc7e.deriveCoc7eSplitLedger(sheet);
	const occProgress = coc7e.coc7eOccupationProgress(sheet.occupation);
	const credit = coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0;
	const creditOutOfRange =
		credit < sheet.occupation.creditMin || credit > sheet.occupation.creditMax;

	if (onCharacterNameChange && (characterName ?? "").trim() === "") {
		issues.push({
			id: "missing-name",
			tab: "identity",
			severity: "blocker",
			message: `${t("characterCreation.name")}：${t("characterCreation.requiredText")}`,
			targetTab: "identity",
			targetLabel: t("characterCreation.reviewGoFix"),
		});
	}

	for (const [key, message] of Object.entries(errors)) {
		const tab = errorTab(key);
		issues.push({
			id: `err-${key}`,
			tab,
			severity: "blocker",
			message,
			targetTab: tab,
			targetLabel: t("characterCreation.reviewGoFix"),
		});
	}

	const occOver = ledger.occupation.remaining < 0;
	const intrOver = ledger.interest.remaining < 0;
	const expOver =
		sheet.profile.storiedInvestigator && ledger.experience.remaining < 0;
	if (occOver || intrOver || expOver) {
		issues.push({
			id: "skills-overspent",
			tab: "skills",
			severity: "blocker",
			message: t("characterCreation.skillsOverspentBanner", {
				occ: ledger.occupation.remaining,
				intr: ledger.interest.remaining,
				expText: sheet.profile.storiedInvestigator
					? t("characterCreation.skillsOverspentExpPart", {
							exp: ledger.experience.remaining,
						})
					: "",
			}),
			targetTab: "skills",
			targetLabel: t("characterCreation.goToSkillsTab"),
		});
	}

	if (creditOutOfRange) {
		const message = t("characterCreation.creditAlertTitle", {
			value: credit,
			min: sheet.occupation.creditMin,
			max: sheet.occupation.creditMax,
		});
		issues.push({
			id: "credit-occ",
			tab: "occupation",
			severity: "warning",
			message,
			targetTab: "equipment",
			targetLabel: t("characterCreation.goToAssetsTab"),
		});
		issues.push({
			id: "credit-eq",
			tab: "equipment",
			severity: "warning",
			message,
			targetTab: "occupation",
			targetLabel: t("characterCreation.goToOccupationTab"),
		});
	}

	if (occProgress.definition && occProgress.missingChoices > 0) {
		issues.push({
			id: "occ-choices",
			tab: "occupation",
			severity: "warning",
			message: t("occupation.templateMissing", {
				count: occProgress.missingChoices,
			}),
			targetTab: "occupation",
			targetLabel: t("characterCreation.reviewGoFix"),
		});
	}

	if (ledger.occupation.remaining > 0 || ledger.interest.remaining > 0) {
		issues.push({
			id: "skills-remaining",
			tab: "skills",
			severity: "warning",
			message: t("characterCreation.skillsRemainingBanner", {
				occ: Math.max(0, ledger.occupation.remaining),
				intr: Math.max(0, ledger.interest.remaining),
			}),
			targetTab: "skills",
			targetLabel: t("characterCreation.goToSkillsTab"),
		});
	}

	if (sheet.profile.storiedInvestigator && ledger.experience.remaining > 0) {
		issues.push({
			id: "skills-exp-remaining",
			tab: "skills",
			severity: "warning",
			message: t("characterCreation.skillsExperienceRemainingBanner", {
				exp: ledger.experience.remaining,
			}),
			targetTab: "skills",
			targetLabel: t("characterCreation.goToSkillsTab"),
		});
	}

	if (sheet.backgroundProfile.keyConnection === null) {
		issues.push({
			id: "missing-key-connection",
			tab: "background",
			severity: "warning",
			message: t("characterCreation.keyConnectionMissingBanner"),
			targetTab: "background",
			targetLabel: t("characterCreation.goToBackgroundTab"),
		});
	}

	const tabCounts: Record<Coc7eTabId, number> = {
		identity: 0,
		occupation: 0,
		skills: 0,
		background: 0,
		equipment: 0,
		experience: 0,
		review: 0,
	};
	const tabHasBlocker: Record<Coc7eTabId, boolean> = {
		identity: false,
		occupation: false,
		skills: false,
		background: false,
		equipment: false,
		experience: false,
		review: false,
	};

	for (const issue of issues) {
		tabCounts[issue.tab] += 1;
		if (issue.severity === "blocker") {
			tabHasBlocker[issue.tab] = true;
		}
	}

	// Deduplicate cross-tab credit issue in review tab count
	const reviewIssues = issues.filter((issue) => issue.id !== "credit-occ");
	tabCounts.review = reviewIssues.length;
	tabHasBlocker.review = reviewIssues.some(
		(issue) => issue.severity === "blocker",
	);

	const filledBackgroundCount = coc7e.COC7E_BACKGROUND_FIELD_META.filter(
		(field) => {
			const value =
				field.key === "appearanceSummary"
					? sheet.backgroundProfile.appearanceSummary.trim() ||
						sheet.profile.appearance.trim()
					: sheet.backgroundProfile[field.key].trim();
			return value !== "";
		},
	).length;

	const wornGearCount = sheet.gear.filter(
		(item) => item.slot && item.slot !== "none",
	).length;
	const backpackGearCount = sheet.gear.length - wornGearCount;

	return {
		issues: reviewIssues,
		warnings: reviewIssues.filter((issue) => issue.severity === "warning"),
		blockers: reviewIssues.filter((issue) => issue.severity === "blocker"),
		tabCounts,
		tabHasBlocker,
		filledBackgroundCount,
		wornGearCount,
		backpackGearCount,
	};
}
