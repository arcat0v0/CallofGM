import { coc7e } from "@cogm/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RuleCreationEditorProps } from "@/rules/registry";
import { Coc7eCreationTabsBar } from "./creation-tabs-bar";
import { type Coc7eTabId, computeCoc7eValidation } from "./creation-validation";
import { Coc7eBackgroundTab } from "./tabs/background-tab";
import { Coc7eEquipmentAssetsTab } from "./tabs/equipment-assets-tab";
import { Coc7eExperienceTab } from "./tabs/experience-tab";
import { Coc7eIdentityAttributesTab } from "./tabs/identity-attributes-tab";
import { Coc7eOccupationTab } from "./tabs/occupation-tab";
import { Coc7eReviewTab } from "./tabs/review-tab";
import { Coc7eSkillsTab, type SkillCatalogItem } from "./tabs/skills-tab";

type Sheet = coc7e.Coc7eCharacterSheet;

export function Coc7eCharacterCreationEditor({
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
}: RuleCreationEditorProps) {
	const [activeTab, setActiveTab] = useState<Coc7eTabId>("identity");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [referenceOpen, setReferenceOpen] = useState(false);
	const [eraNotice, setEraNotice] = useState(false);
	const [wide, setWide] = useState(
		() => typeof window === "undefined" || window.innerWidth >= 768,
	);
	const [customMode, setCustomMode] = useState(false);
	const occupation = coc7e.coc7eOccupation(sheet.occupation.presetId);

	useEffect(() => {
		function update() {
			setWide(window.innerWidth >= 768);
		}
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	const reportError = useCallback((key: string, message: string | null) => {
		setErrors((current) => {
			if (message) {
				if (current[key] === message) {
					return current;
				}
				return { ...current, [key]: message };
			}
			if (!(key in current)) {
				return current;
			}
			const next = { ...current };
			delete next[key];
			return next;
		});
	}, []);

	const validation = useMemo(
		() =>
			computeCoc7eValidation(
				sheet,
				errors,
				characterName,
				onCharacterNameChange,
			),
		[sheet, errors, characterName, onCharacterNameChange],
	);

	useEffect(() => {
		onValidityChange(validation.blockers.length === 0);
	}, [validation.blockers.length, onValidityChange]);

	useEffect(() => {
		onWarningsChange?.(validation.warnings.length);
	}, [validation.warnings.length, onWarningsChange]);

	function update(patch: Partial<Sheet>) {
		onChange({ ...sheet, ...patch });
	}

	function addSkillKey(key: string, base: number) {
		if (sheet.skills[key] !== undefined && sheet.customSkills[key]) {
			return;
		}
		if (sheet.customSkills[key]) {
			return;
		}
		if (coc7e.canonicalizeCoc7eSkillKey(key)) {
			return;
		}
		update({
			customSkills: { ...sheet.customSkills, [key]: { base } },
			skills: { ...sheet.skills, [key]: base },
		});
	}

	function changeEra(era: Sheet["era"]) {
		if (era === sheet.era) {
			return;
		}
		const blocked =
			occupation !== null &&
			((occupation.era === "modern" && era === "1920s") ||
				(occupation.era === "classic" && era === "modern"));
		update({
			era,
			occupation: blocked
				? { ...coc7e.coc7eClearOccupation(), name: sheet.occupation.name }
				: sheet.occupation,
		});
		setEraNotice(blocked);
	}

	const catalog = useMemo<SkillCatalogItem[]>(() => {
		const standard = coc7e.COC7E_SKILL_CATALOG.map((entry) => ({
			...entry,
			custom: false,
		}));
		const standardKeys = new Set(standard.map((entry) => entry.key));
		const custom = Object.entries(sheet.customSkills)
			.filter(([key]) => !standardKeys.has(key))
			.map(([key, definition]) => ({
				key,
				aliases: [key],
				base: definition.base,
				group: coc7e.coc7eSkillFamily(key) ?? undefined,
				custom: true,
				modernOnly: false,
				uncommon: false,
			}));
		return [...standard, ...custom];
	}, [sheet.customSkills]);

	return (
		<div className="flex flex-col gap-6">
			<Coc7eCreationTabsBar
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				validation={validation}
			/>

			<div role="tabpanel" hidden={activeTab !== "identity"}>
				<Coc7eIdentityAttributesTab
					sheet={sheet}
					onChange={update}
					onChangeEra={changeEra}
					showValidation={showValidation}
					reportError={reportError}
					characterName={characterName}
					onCharacterNameChange={onCharacterNameChange}
					identityHeaderSlot={identityHeaderSlot}
					portraitPreviewUrl={portraitPreviewUrl}
					portraitPending={portraitPending}
					onPickPortraitFile={onPickPortraitFile}
					onClearPendingPortrait={onClearPendingPortrait}
					onManageExpressions={onManageExpressions}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "occupation"}>
				<Coc7eOccupationTab
					sheet={sheet}
					onChange={(patch) => {
						setEraNotice(false);
						update(patch);
					}}
					showValidation={showValidation}
					reportError={reportError}
					customMode={customMode}
					setCustomMode={setCustomMode}
					referenceOpen={referenceOpen}
					setReferenceOpen={setReferenceOpen}
					eraNotice={eraNotice}
					onJumpToAssets={() => setActiveTab("equipment")}
					onAddSkillKey={addSkillKey}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "skills"}>
				<Coc7eSkillsTab
					sheet={sheet}
					catalog={catalog}
					wide={wide}
					showValidation={showValidation}
					onChange={update}
					reportError={reportError}
					onJumpToAssets={() => setActiveTab("equipment")}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "background"}>
				<Coc7eBackgroundTab
					sheet={sheet}
					onChange={update}
					background={background}
					onBackgroundChange={onBackgroundChange}
					sheetContext={sheetContext}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "equipment"}>
				<Coc7eEquipmentAssetsTab
					sheet={sheet}
					onChange={update}
					showValidation={showValidation}
					reportError={reportError}
					skillOptions={catalog.map((entry) => ({
						value: entry.key,
						label: entry.key,
					}))}
					onJumpToOccupation={() => setActiveTab("occupation")}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "experience"}>
				<Coc7eExperienceTab
					sheet={sheet}
					onChange={update}
					sheetContext={sheetContext}
				/>
			</div>

			<div role="tabpanel" hidden={activeTab !== "review"}>
				<Coc7eReviewTab
					sheet={sheet}
					validation={validation}
					onSelectTab={setActiveTab}
					onSubmitAction={onSubmitAction}
					submitLabel={submitLabel}
					submitPending={submitPending}
				/>
			</div>
		</div>
	);
}
