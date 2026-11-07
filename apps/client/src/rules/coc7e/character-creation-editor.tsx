import { coc7e } from "@cogm/shared";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	NumericField,
	SelectField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
import { Coc7eCreationRecordsEditor } from "./creation-records-editor";

type Sheet = coc7e.Coc7eCharacterSheet;
type AttributeKey = coc7e.Coc7eAttributeKey;

const attributeKeys: AttributeKey[] = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
];

const attributeOptions = attributeKeys.map((key) => ({
	value: key,
	label: `${coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? key} ${coc7e.COC7E_ATTRIBUTE_LABELS[key]?.abbr ?? key.toUpperCase()}`,
}));

export function Coc7eCharacterCreationEditor({
	sheet,
	onChange,
	showValidation,
	onValidityChange,
	children,
}: {
	sheet: Sheet;
	onChange: (sheet: Sheet) => void;
	showValidation: boolean;
	onValidityChange: (valid: boolean) => void;
	children?: ReactNode;
}) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<
		"all" | "raised" | "occupation" | "specialization"
	>("all");
	const [customName, setCustomName] = useState("");
	const [customBase, setCustomBase] = useState(0);
	const [eraNotice, setEraNotice] = useState(false);
	const [wide, setWide] = useState(
		() => typeof window === "undefined" || window.innerWidth >= 768,
	);
	const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>(
		{},
	);
	const derived = coc7e.deriveCoc7eSheetStats(sheet);
	const ledger = coc7e.deriveCoc7eCreationLedger(sheet);
	const ageGuidance = coc7e.coc7eAgeCreationGuidance(sheet.age);
	const occupation = coc7e.COC7E_OCCUPATIONS.find(
		(item) => item.id === sheet.occupation.presetId,
	);

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

	useEffect(() => {
		onValidityChange(Object.keys(errors).length === 0);
	}, [errors, onValidityChange]);

	function update(patch: Partial<Sheet>) {
		onChange({ ...sheet, ...patch });
	}

	function updateOccupation(patch: Partial<Sheet["occupation"]>) {
		update({ occupation: { ...sheet.occupation, ...patch } });
	}

	function selectOccupation(value: string) {
		if (value === "custom") {
			updateOccupation({ presetId: null });
			return;
		}
		const definition = coc7e.COC7E_OCCUPATIONS.find(
			(item) => item.id === value,
		);
		if (!definition) {
			return;
		}
		setEraNotice(false);
		updateOccupation({
			presetId: definition.id,
			name: definition.name,
			skillPointFormula: [...(definition.skillPointFormulaOptions[0] ?? [])],
			creditMin: definition.creditMin,
			creditMax: definition.creditMax,
			skillKeys: [...definition.skillKeys],
		});
	}

	function changeEra(era: Sheet["era"]) {
		if (era === sheet.era) {
			return;
		}
		const modernOnly = occupation?.modernOnly && era === "1920s";
		update({
			era,
			occupation: modernOnly
				? { ...sheet.occupation, presetId: null }
				: sheet.occupation,
		});
		setEraNotice(Boolean(modernOnly));
	}

	const occupationOptions = coc7e.COC7E_OCCUPATIONS.filter(
		(item) => sheet.era === "modern" || !item.modernOnly,
	).map((item) => ({ value: item.id, label: item.name }));

	const occupationSet = new Set(
		sheet.occupation.skillKeys.map(
			(key) => coc7e.canonicalizeCoc7eSkillKey(key) ?? key,
		),
	);

	function toggleOccupationSkill(key: string, checked: boolean) {
		const keys = new Set(sheet.occupation.skillKeys);
		if (checked) {
			keys.add(key);
		} else {
			keys.delete(key);
		}
		updateOccupation({ skillKeys: [...keys] });
	}

	function setSkill(key: string, value: number) {
		update({ skills: { ...sheet.skills, [key]: value } });
	}

	function resetSkill(key: string) {
		const skills = { ...sheet.skills };
		delete skills[key];
		update({ skills });
	}

	function addCustomSkill() {
		const key = customName.trim();
		if (!key) {
			toast.error(t("characterCreation.customSkillRequired"));
			return;
		}
		const canonical = coc7e.canonicalizeCoc7eSkillKey(key);
		if (canonical || sheet.customSkills[key]) {
			toast.error(t("characterCreation.customSkillExists"));
			return;
		}
		update({
			customSkills: { ...sheet.customSkills, [key]: { base: customBase } },
			skills: { ...sheet.skills, [key]: customBase },
		});
		setCustomName("");
		setCustomBase(0);
	}

	function removeCustomSkill(key: string) {
		if (sheet.weapons.some((weapon) => weapon.skillKey === key)) {
			toast.error(t("characterCreation.customSkillReferenced", { name: key }));
			return;
		}
		const customSkills = { ...sheet.customSkills };
		const skills = { ...sheet.skills };
		delete customSkills[key];
		delete skills[key];
		update({ customSkills, skills });
	}

	const catalog = useMemo(() => {
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
				group: key.includes("(") ? key.split("(")[0] : undefined,
				custom: true,
				modernOnly: false,
				uncommon: false,
			}));
		return [...standard, ...custom];
	}, [sheet.customSkills]);

	const visibleSkills = catalog.filter((entry) => {
		if (
			search.trim() &&
			!entry.key.toLowerCase().includes(search.trim().toLowerCase())
		) {
			return false;
		}
		const base = coc7e.coc7eSkillBaseValue(sheet, entry.key) ?? 0;
		const current = coc7e.coc7eSkillTargetValue(sheet, entry.key) ?? base;
		if (filter === "raised") {
			return current > base;
		}
		if (filter === "occupation") {
			return occupationSet.has(entry.key) || entry.key === "信用评级";
		}
		if (filter === "specialization") {
			return entry.key.includes("(");
		}
		return true;
	});

	const skillGroups = new Map<string, typeof visibleSkills>();
	for (const entry of visibleSkills) {
		const group = entry.group ?? t("characterCreation.filterAll");
		skillGroups.set(group, [...(skillGroups.get(group) ?? []), entry]);
	}

	return (
		<div className="flex flex-col gap-6">
			<SheetSection
				title={t("characterCreation.identity")}
				description={t("characterCreation.identityHint")}
			>
				<div className="grid gap-4 md:grid-cols-3">
					<div className="flex flex-col gap-1.5">
						<Label>{t("characterCreation.era")}</Label>
						<SegmentedControl
							aria-label={t("characterCreation.era")}
							value={sheet.era}
							options={[
								{ value: "1920s", label: t("characterCreation.era1920s") },
								{ value: "modern", label: t("characterCreation.eraModern") },
							]}
							onValueChange={changeEra}
						/>
					</div>
					<NumericField
						label={t("characterCreation.age")}
						value={sheet.age}
						min={15}
						max={90}
						nullable
						showValidation={showValidation}
						onErrorChange={(message) => reportError("age", message)}
						onChange={(value) => update({ age: value })}
					/>
					<SelectField
						label={t("characterCreation.occupation")}
						value={sheet.occupation.presetId ?? "custom"}
						options={[
							{
								value: "custom",
								label: t("characterCreation.customOccupation"),
							},
							...occupationOptions,
						]}
						onChange={selectOccupation}
					/>
				</div>
				{eraNotice ? (
					<p
						role="status"
						className="rounded-xl bg-warning-soft px-4 py-3 text-body-medium text-warning-soft-foreground"
					>
						{t("characterCreation.modernOccupationRetained")}
					</p>
				) : null}
				<div className="grid gap-4 md:grid-cols-2">
					<TextField
						label={t("characterCreation.occupationName")}
						value={sheet.occupation.name}
						showValidation={showValidation}
						onChange={(name) => updateOccupation({ presetId: null, name })}
					/>
					<div className="grid grid-cols-2 gap-3">
						<NumericField
							label={t("characterCreation.creditMin")}
							value={sheet.occupation.creditMin}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) => reportError("creditMin", message)}
							onChange={(value) => updateOccupation({ creditMin: value ?? 0 })}
						/>
						<NumericField
							label={t("characterCreation.creditMax")}
							value={sheet.occupation.creditMax}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) => reportError("creditMax", message)}
							onChange={(value) => updateOccupation({ creditMax: value ?? 99 })}
						/>
					</div>
				</div>
				{occupation ? (
					<SelectField
						label={t("characterCreation.occupationFormula")}
						value={String(
							Math.max(
								0,
								occupation.skillPointFormulaOptions.findIndex(
									(formula) =>
										JSON.stringify(formula) ===
										JSON.stringify(sheet.occupation.skillPointFormula),
								),
							),
						)}
						options={occupation.skillPointFormulaOptions.map(
							(formula, index) => ({
								value: String(index),
								label: formula
									.map(
										(part) =>
											`${coc7e.COC7E_ATTRIBUTE_LABELS[part.attribute]?.abbr ?? part.attribute}×${part.multiplier}`,
									)
									.join(" + "),
							}),
						)}
						onChange={(value) => {
							const formula =
								occupation.skillPointFormulaOptions[Number(value)];
							if (formula) {
								updateOccupation({ skillPointFormula: [...formula] });
							}
						}}
					/>
				) : (
					<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
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
								key={`${part.attribute}-${part.multiplier}`}
								className="grid grid-cols-[1fr_7rem_2.5rem] items-end gap-2"
							>
								<SelectField
									label={t("characterCreation.formulaPart", {
										index: index + 1,
									})}
									value={part.attribute}
									options={attributeOptions}
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
					</div>
				)}
				<div className="flex flex-col gap-2 rounded-xl bg-md-surface-container px-4 py-3">
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
				</div>
				{ageGuidance ? (
					<div className="flex flex-col gap-1.5 text-body-medium text-foreground-secondary">
						{ageGuidance.eduImprovementChecks === 0 ? null : (
							<p>
								{t("characterCreation.ageEduChecks", {
									count: ageGuidance.eduImprovementChecks,
								})}
							</p>
						)}
						{ageGuidance.eduImprovementChecks === 0 &&
						ageGuidance.physicalAttributeReduction === 0 ? (
							<p>{t("characterCreation.ageNoAdjustment")}</p>
						) : null}
						{ageGuidance.physicalAttributeGroup === "strSiz" ? (
							<p>
								{t("characterCreation.agePhysicalStrSiz", {
									value: ageGuidance.physicalAttributeReduction,
								})}
							</p>
						) : null}
						{ageGuidance.physicalAttributeGroup === "strConDex" ? (
							<p>
								{t("characterCreation.agePhysicalStrConDex", {
									value: ageGuidance.physicalAttributeReduction,
								})}
							</p>
						) : null}
						{ageGuidance.appearanceReduction > 0 ? (
							<p>
								{t("characterCreation.ageApp", {
									value: ageGuidance.appearanceReduction,
								})}
							</p>
						) : null}
						{ageGuidance.eduReduction > 0 ? (
							<p>
								{t("characterCreation.ageEduReduction", {
									value: ageGuidance.eduReduction,
								})}
							</p>
						) : null}
						{ageGuidance.luckRolls > 1 ? (
							<p>{t("characterCreation.ageLuck")}</p>
						) : null}
					</div>
				) : (
					<p className="text-body-small text-foreground-tertiary">
						{t("characterCreation.ageHint")}
					</p>
				)}
			</SheetSection>

			<SheetSection
				id="attributes"
				title={t("characterCreation.attributes")}
				description={t("characterCreation.attributesHint")}
			>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
					{attributeKeys.map((key) => {
						const pair = coc7e.COC7E_ATTRIBUTE_LABELS[key] ?? {
							label: key,
							abbr: key.toUpperCase(),
						};
						const value = sheet.attributes[key];
						return (
							<div key={key} className="rounded-xl bg-md-surface-container p-3">
								<NumericField
									label={t("characterCreation.attributeValue", {
										label: pair.label,
										abbr: pair.abbr,
									})}
									value={value}
									min={1}
									max={99}
									showValidation={showValidation}
									onErrorChange={(message) =>
										reportError(`attribute-${key}`, message)
									}
									onChange={(next) =>
										update({
											attributes: { ...sheet.attributes, [key]: next ?? value },
										})
									}
								/>
								<p className="mt-1 text-label-small text-foreground-secondary tabular-nums">
									{t("characterCreation.halfFifth", {
										half: Math.floor(value / 2),
										fifth: Math.floor(value / 5),
									})}
								</p>
							</div>
						);
					})}
				</div>
				<div className="max-w-xs">
					<NumericField
						label={t("characterCreation.movementModifier")}
						value={sheet.movementModifier}
						min={-20}
						max={20}
						showValidation={showValidation}
						onErrorChange={(message) =>
							reportError("movementModifier", message)
						}
						onChange={(value) => update({ movementModifier: value ?? 0 })}
					/>
				</div>
				<section
					aria-label={t("characterCreation.derived")}
					className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-md-surface-container-high sm:grid-cols-4 lg:grid-cols-8"
				>
					{[
						[t("characterCreation.maxHp"), derived.maxHp],
						[t("characterCreation.maxMp"), derived.maxMp],
						[t("characterCreation.initialSan"), derived.initialSan],
						[t("characterCreation.maxSan"), derived.maxSan],
						[t("characterCreation.mov"), derived.mov],
						[t("characterCreation.damageBonus"), derived.damageBonus],
						[t("characterCreation.build"), derived.build],
						[t("characterCreation.majorWound"), derived.majorWoundThreshold],
					].map(([label, value]) => (
						<div
							key={label}
							className="flex flex-col gap-1 bg-md-surface-container px-3 py-3"
						>
							<span className="text-label-small text-foreground-secondary">
								{label}
							</span>
							<span className="text-title-medium-emph text-foreground tabular-nums">
								{value}
							</span>
						</div>
					))}
				</section>
			</SheetSection>

			<SheetSection
				title={t("characterCreation.skills")}
				description={t("characterCreation.skillsHint")}
			>
				<section
					aria-label={t("characterCreation.ledger")}
					className="grid gap-4 rounded-xl bg-md-surface-container p-4 md:grid-cols-2"
				>
					{[
						[t("characterCreation.occupationPoints"), ledger.occupation],
						[t("characterCreation.interestPoints"), ledger.interest],
					].map(([label, budget]) => {
						const value = budget as coc7e.Coc7eSkillPointBudget;
						return (
							<div key={label as string} className="flex flex-col gap-1">
								<span className="text-label-large-emph text-foreground">
									{label as string}
								</span>
								<span className="text-body-medium text-foreground-secondary tabular-nums">
									{t("characterCreation.pointBudget", {
										budget: value.budget,
										spent: value.spent,
										remaining: value.remaining,
									})}
								</span>
							</div>
						);
					})}
					{(coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0) <
						sheet.occupation.creditMin ||
					(coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0) >
						sheet.occupation.creditMax ? (
						<p className="text-body-medium text-warning md:col-span-2">
							{t("characterCreation.creditOutOfRange", {
								value: coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0,
								min: sheet.occupation.creditMin,
								max: sheet.occupation.creditMax,
							})}
						</p>
					) : null}
				</section>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-end">
					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<Label htmlFor="coc-skill-search">
							{t("characterCreation.searchSkills")}
						</Label>
						<Input
							id="coc-skill-search"
							type="search"
							role="searchbox"
							aria-label={t("characterCreation.searchSkills")}
							value={search}
							placeholder={t("characterCreation.skillSearchPlaceholder")}
							onInput={(event) => setSearch(event.currentTarget.value)}
						/>
					</div>
					<SegmentedControl
						aria-label={t("characterCreation.skillFilter")}
						value={filter}
						options={[
							{ value: "all", label: t("characterCreation.filterAll") },
							{ value: "raised", label: t("characterCreation.filterRaised") },
							{
								value: "occupation",
								label: t("characterCreation.filterOccupation"),
							},
							{
								value: "specialization",
								label: t("characterCreation.filterSpecialization"),
							},
						]}
						onValueChange={setFilter}
					/>
				</div>
				{visibleSkills.length === 0 ? (
					<p className="rounded-xl bg-md-surface-container px-4 py-5 text-body-medium text-foreground-secondary">
						{t("characterCreation.noSkillMatches")}
					</p>
				) : (
					[...skillGroups.entries()].map(([group, entries]) => {
						const filterActive = search.trim() !== "" || filter !== "all";
						const expanded = filterActive || (groupOverrides[group] ?? wide);
						return (
							<div key={group} className="flex flex-col gap-2">
								<button
									type="button"
									aria-expanded={expanded}
									onClick={() =>
										setGroupOverrides((current) => ({
											...current,
											[group]: !expanded,
										}))
									}
									className="bg-md-surface-container hover:bg-md-surface-container-high flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors"
								>
									<h3 className="text-label-large-emph text-foreground-secondary flex-1">
										{group}
									</h3>
									<span className="text-label-small text-foreground-tertiary tabular-nums">
										{entries.length} 项
									</span>
									<ChevronDown
										className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
									/>
								</button>
								<div
									hidden={!expanded}
									className={expanded ? "grid gap-2 lg:grid-cols-2" : "hidden"}
								>
									{entries.map((entry) => {
										const key = entry.key;
										const base = coc7e.coc7eSkillBaseValue(sheet, key) ?? 0;
										const current =
											coc7e.coc7eSkillTargetValue(sheet, key) ?? base;
										const custom = sheet.customSkills[key];
										return (
											<div
												key={key}
												className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 rounded-xl bg-md-surface-container p-3"
											>
												<div className="flex min-w-0 flex-col justify-center gap-1">
													<div className="flex min-w-0 flex-wrap items-center gap-1.5">
														<span className="truncate text-label-large-emph text-foreground">
															{key}
														</span>
														{entry.modernOnly ? (
															<Badge variant="soft" tone="default" size="sm">
																{t("characterCreation.modernSkill")}
															</Badge>
														) : null}
														{entry.uncommon ? (
															<Badge variant="soft" tone="default" size="sm">
																{t("characterCreation.uncommonSkill")}
															</Badge>
														) : null}
													</div>
													<span className="text-label-small text-foreground-secondary tabular-nums">
														{t("characterCreation.skillBase", { value: base })}{" "}
														·{" "}
														{t("characterCreation.halfFifth", {
															half: Math.floor(current / 2),
															fifth: Math.floor(current / 5),
														})}
													</span>
													<label
														htmlFor={`occupation-${key}`}
														className="flex w-fit cursor-pointer items-center gap-2 text-label-small text-foreground-secondary"
													>
														<Checkbox
															id={`occupation-${key}`}
															aria-label={t(
																"characterCreation.occupationSkill",
																{
																	name: key,
																},
															)}
															checked={
																occupationSet.has(key) || key === "信用评级"
															}
															disabled={key === "信用评级"}
															onCheckedChange={(checked) =>
																toggleOccupationSkill(key, checked === true)
															}
														/>
														{t("characterCreation.filterOccupation")}
													</label>
												</div>
												<div className="flex items-start gap-1">
													<NumericField
														label={t("characterCreation.skillValue", {
															name: key,
														})}
														value={current}
														min={0}
														max={999}
														showValidation={showValidation}
														onErrorChange={(message) =>
															reportError(`skill-${key}`, message)
														}
														onChange={(value) =>
															setSkill(key, value ?? current)
														}
													/>
													{custom ? (
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															aria-label={t(
																"characterCreation.removeCustomSkill",
																{ name: key },
															)}
															onClick={() => removeCustomSkill(key)}
														>
															<Trash2 />
														</Button>
													) : sheet.skills[key] !== undefined ? (
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															aria-label={t("characterCreation.resetSkill", {
																name: key,
															})}
															onClick={() => resetSkill(key)}
														>
															<RotateCcw />
														</Button>
													) : null}
												</div>
												{custom ? (
													<div className="col-span-2 max-w-40">
														<NumericField
															label={t("characterCreation.customSkillBase")}
															value={custom.base}
															min={0}
															max={99}
															showValidation={showValidation}
															onErrorChange={(message) =>
																reportError(`custom-base-${key}`, message)
															}
															onChange={(value) =>
																update({
																	customSkills: {
																		...sheet.customSkills,
																		[key]: { ...custom, base: value ?? 0 },
																	},
																})
															}
														/>
													</div>
												) : null}
											</div>
										);
									})}
								</div>
							</div>
						);
					})
				)}
				<div className="grid items-end gap-3 rounded-xl bg-md-surface-container p-4 md:grid-cols-[1fr_10rem_auto]">
					<TextField
						label={t("characterCreation.customSkillName")}
						value={customName}
						maxLength={100}
						onChange={setCustomName}
					/>
					<NumericField
						label={t("characterCreation.customSkillBase")}
						value={customBase}
						min={0}
						max={99}
						showValidation={showValidation}
						onErrorChange={(message) => reportError("new-custom-base", message)}
						onChange={(value) => setCustomBase(value ?? 0)}
					/>
					<Button type="button" variant="outline" onClick={addCustomSkill}>
						<Plus />
						{t("characterCreation.addCustomSkill")}
					</Button>
				</div>
			</SheetSection>

			{children}

			<Coc7eCreationRecordsEditor
				sheet={sheet}
				onChange={onChange}
				showValidation={showValidation}
				reportError={reportError}
				skillOptions={catalog.map((entry) => ({
					value: entry.key,
					label: entry.key,
				}))}
			/>
		</div>
	);
}
