import { coc7e } from "@cogm/shared";
import {
	AlertTriangle,
	ChevronDown,
	Plus,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	NumericField,
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
import { cn } from "@/lib/utils";
import {
	Coc7eSpecialtyAddRow,
	Coc7eSpecialtySlotsSection,
	SkillNameWithHint,
} from "../specialty-slots-section";

type Sheet = coc7e.Coc7eCharacterSheet;
type Bucket = "occupation" | "interest" | "experience";

export type SkillCatalogItem = {
	key: string;
	aliases: ReadonlyArray<string>;
	base: number;
	group?: string | undefined;
	custom: boolean;
	modernOnly?: boolean | undefined;
	uncommon?: boolean | undefined;
};

export function Coc7eSkillsTab({
	sheet,
	catalog,
	wide,
	showValidation,
	onChange,
	reportError,
	onJumpToAssets,
}: {
	sheet: Sheet;
	catalog: SkillCatalogItem[];
	wide: boolean;
	showValidation: boolean;
	onChange: (patch: Partial<Sheet>) => void;
	reportError: (key: string, message: string | null) => void;
	onJumpToAssets: () => void;
}) {
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<
		"all" | "raised" | "occupation" | "specialization"
	>("all");
	const [customName, setCustomName] = useState("");
	const [customBase, setCustomBase] = useState(0);
	const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>(
		{},
	);

	const ledger = coc7e.deriveCoc7eSplitLedger(sheet);
	const occupation = coc7e.coc7eOccupation(sheet.occupation.presetId);
	const storied = sheet.profile.storiedInvestigator;

	const artEntries = useMemo(
		() =>
			catalog
				.filter((entry) => entry.group === "技艺")
				.map((entry) => ({ key: entry.key, base: entry.base })),
		[catalog],
	);
	const artSuggestions = useMemo(
		() =>
			artEntries
				.filter((entry) => !entry.key.startsWith("技艺("))
				.map((entry) => entry.key),
		[artEntries],
	);
	const languageEntries = useMemo(
		() =>
			catalog
				.filter((entry) => entry.group === "语言")
				.map((entry) => ({ key: entry.key, base: entry.base })),
		[catalog],
	);

	const visibleSkills = catalog.filter((entry) => {
		if (
			entry.group === "技艺" ||
			entry.group === "语言" ||
			entry.key === "信用评级"
		) {
			return false;
		}
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
			return coc7e.coc7eIsOccupationalSkill(sheet.occupation, entry.key);
		}
		if (filter === "specialization") {
			return entry.key.includes("(");
		}
		return true;
	});

	const skillGroups = new Map<string, SkillCatalogItem[]>();
	for (const entry of visibleSkills) {
		const group = entry.group ?? t("characterCreation.filterAll");
		skillGroups.set(group, [...(skillGroups.get(group) ?? []), entry]);
	}

	function toggleOccupationSkill(key: string, checked: boolean) {
		const keys = new Set(sheet.occupation.skillKeys);
		if (checked) {
			keys.add(key);
		} else {
			keys.delete(key);
		}
		onChange({ occupation: { ...sheet.occupation, skillKeys: [...keys] } });
	}

	function setSkillTotal(key: string, value: number) {
		const nextSkills = { ...sheet.skills, [key]: value };
		const nextAllocation = { ...sheet.skillAllocation };
		delete nextAllocation[key];
		onChange({ skills: nextSkills, skillAllocation: nextAllocation });
	}

	function adjustBucket(key: string, bucket: Bucket, delta: number) {
		const base = coc7e.coc7eSkillBaseValue(sheet, key) ?? 0;
		const currentSplit = coc7e.coc7eSkillAllocationForEntry(sheet, key);
		const nextBucketValue = Math.max(
			0,
			Math.min(999 - base, currentSplit[bucket] + delta),
		);
		const nextSplit = {
			...currentSplit,
			[bucket]: nextBucketValue,
		};
		const nextTotal = Math.min(
			999,
			base + nextSplit.occupation + nextSplit.interest + nextSplit.experience,
		);
		const nextSkills = { ...sheet.skills };
		const nextAllocation = { ...sheet.skillAllocation };
		if (nextTotal === base && nextSkills[key] === undefined) {
			return;
		}
		nextSkills[key] = nextTotal;
		nextAllocation[key] = nextSplit;
		onChange({ skills: nextSkills, skillAllocation: nextAllocation });
	}

	function resetSkill(key: string) {
		const skills = { ...sheet.skills };
		const skillAllocation = { ...sheet.skillAllocation };
		delete skills[key];
		delete skillAllocation[key];
		onChange({ skills, skillAllocation });
	}

	function pickArtSkill(key: string) {
		const trimmed = key.trim();
		if (trimmed === "") {
			return;
		}
		const canonical = coc7e.canonicalizeCoc7eSkillKey(trimmed);
		const finalKey = canonical ?? `技艺(${trimmed})`;
		if (sheet.skills[finalKey] !== undefined) {
			return;
		}
		const base = coc7e.coc7eSkillBaseValue(sheet, finalKey) ?? 5;
		if (canonical) {
			onChange({ skills: { ...sheet.skills, [finalKey]: base } });
			return;
		}
		onChange({
			customSkills: { ...sheet.customSkills, [finalKey]: { base } },
			skills: { ...sheet.skills, [finalKey]: base },
		});
	}

	function addLanguageSkill(name: string) {
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		const key = `外语(${trimmed})`;
		if (sheet.skills[key] !== undefined) {
			return;
		}
		const base = coc7e.COC7E_SKILL_GROUP_INFO["语言"]?.base ?? 1;
		onChange({
			customSkills: { ...sheet.customSkills, [key]: { base } },
			skills: { ...sheet.skills, [key]: base },
		});
	}

	function addGroupSpecialty(group: string, name: string) {
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		const canonical = coc7e.canonicalizeCoc7eSkillKey(trimmed);
		if (canonical) {
			if (sheet.skills[canonical] === undefined) {
				onChange({
					skills: {
						...sheet.skills,
						[canonical]: coc7e.coc7eSkillBaseValue(sheet, canonical) ?? 0,
					},
				});
			}
			return;
		}
		const key = `${group}(${trimmed})`;
		if (sheet.skills[key] !== undefined || sheet.customSkills[key]) {
			return;
		}
		const base = coc7e.COC7E_SKILL_GROUP_INFO[group]?.base ?? 0;
		onChange({
			customSkills: { ...sheet.customSkills, [key]: { base } },
			skills: { ...sheet.skills, [key]: base },
		});
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
		onChange({
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
		const skillAllocation = { ...sheet.skillAllocation };
		delete customSkills[key];
		delete skills[key];
		delete skillAllocation[key];
		onChange({ customSkills, skills, skillAllocation });
	}

	const overspent =
		ledger.occupation.remaining < 0 ||
		ledger.interest.remaining < 0 ||
		(storied && ledger.experience.remaining < 0);
	const unspent =
		ledger.occupation.remaining > 0 ||
		ledger.interest.remaining > 0 ||
		(storied && ledger.experience.remaining > 0);

	return (
		<SheetSection
			title={t("characterCreation.skills")}
			description={t("characterCreation.skillsHint")}
		>
			{overspent ? (
				<div
					role="alert"
					className="bg-danger-soft text-danger-soft-foreground flex items-start gap-2.5 rounded-xl px-4 py-3 text-body-medium"
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>
						{t("characterCreation.skillsOverspentBanner", {
							occ: ledger.occupation.remaining,
							intr: ledger.interest.remaining,
							expText: storied
								? t("characterCreation.skillsOverspentExpPart", {
										exp: ledger.experience.remaining,
									})
								: "",
						})}
					</span>
				</div>
			) : unspent ? (
				<div
					role="status"
					className="bg-warning-soft text-warning-soft-foreground flex items-start gap-2.5 rounded-xl px-4 py-3 text-body-medium"
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>
						{t("characterCreation.skillsRemainingBanner", {
							occ: Math.max(0, ledger.occupation.remaining),
							intr: Math.max(0, ledger.interest.remaining),
						})}
						{storied && ledger.experience.remaining > 0
							? ` · ${t("characterCreation.skillsExperienceRemainingBanner", {
									exp: ledger.experience.remaining,
								})}`
							: ""}
					</span>
				</div>
			) : null}

			<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-body-small text-foreground-secondary">
				<span>{t("characterCreation.creditMovedHint")}</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onJumpToAssets}
				>
					{t("characterCreation.goToAssetsTab")}
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
				<aside className="order-first lg:sticky lg:top-20 lg:order-last lg:self-start">
					<section
						aria-label={t("characterCreation.ledger")}
						className="border-md-outline-variant/50 bg-md-surface-container flex flex-col gap-3 rounded-2xl border p-4"
					>
						<div className="flex items-center justify-between border-b border-separator-secondary/40 pb-2">
							<h3 className="font-serif text-title-medium-emph text-foreground">
								{t("characterCreation.skillLedgerTitle")}
							</h3>
							<Badge variant="soft" tone="default" size="sm">
								CoC 7e
							</Badge>
						</div>
						{[
							{
								label: t("characterCreation.occupationPoints"),
								budget: ledger.occupation,
							},
							{
								label: t("characterCreation.interestPoints"),
								budget: ledger.interest,
							},
							...(storied
								? [
										{
											label: t("characterCreation.experiencePoints"),
											budget: ledger.experience,
										},
									]
								: []),
						].map(({ label, budget }) => {
							const over = budget.remaining < 0;
							return (
								<div
									key={label}
									className={cn(
										"flex flex-col gap-1 rounded-xl p-3",
										over
											? "bg-danger-soft text-danger-soft-foreground"
											: "bg-md-surface-container-high text-foreground",
									)}
								>
									<span className="text-label-large-emph">{label}</span>
									<span className="font-mono text-body-medium tabular-nums">
										{t("characterCreation.pointBudget", {
											budget: budget.budget,
											spent: budget.spent,
											remaining: budget.remaining,
										})}
									</span>
								</div>
							);
						})}
						<p className="text-body-small text-foreground-tertiary">
							{t("characterCreation.skillLedgerLegend")}
						</p>
					</section>
				</aside>

				<div className="flex min-w-0 flex-col gap-5">
					<Coc7eSpecialtySlotsSection
						title={t("characterCreation.artSkills")}
						hint={t("characterCreation.artSkillsHint")}
						family="技艺"
						slotsPrefix="技艺"
						entries={artEntries}
						skills={sheet.skills}
						suggestions={artSuggestions}
						showValidation={showValidation}
						onAddName={pickArtSkill}
						onRemoveKey={(key) =>
							sheet.customSkills[key] ? removeCustomSkill(key) : resetSkill(key)
						}
						onSetValue={setSkillTotal}
						reportError={reportError}
					/>
					<Coc7eSpecialtySlotsSection
						title={t("characterCreation.languageSlots")}
						hint={t("characterCreation.languageSlotsHint")}
						family="语言"
						slotsPrefix="外语"
						entries={languageEntries}
						skills={sheet.skills}
						suggestions={[]}
						showValidation={showValidation}
						onAddName={addLanguageSkill}
						onRemoveKey={(key) =>
							sheet.customSkills[key] ? removeCustomSkill(key) : resetSkill(key)
						}
						onSetValue={setSkillTotal}
						reportError={reportError}
					/>

					<div className="flex flex-col gap-3">
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
											<SkillNameWithHint
												name={group}
												className="cursor-help text-label-large-emph text-foreground-secondary"
											/>
										</h3>
										<span className="text-label-small text-foreground-tertiary tabular-nums">
											{entries.length}
										</span>
										<ChevronDown
											className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
										/>
									</button>
									<div
										hidden={!expanded}
										className={
											expanded ? "grid gap-2.5 sm:grid-cols-2" : "hidden"
										}
									>
										{entries.map((entry) => {
											const key = entry.key;
											const base = coc7e.coc7eSkillBaseValue(sheet, key) ?? 0;
											const current =
												coc7e.coc7eSkillTargetValue(sheet, key) ?? base;
											const split = coc7e.coc7eSkillAllocationForEntry(
												sheet,
												key,
											);
											const raised = current > base;
											const isOccupational = coc7e.coc7eIsOccupationalSkill(
												sheet.occupation,
												key,
											);
											const defaultBucket: Bucket = isOccupational
												? "occupation"
												: "interest";
											const custom = sheet.customSkills[key];
											return (
												<div
													key={key}
													className={cn(
														"flex flex-col gap-2.5 rounded-xl border p-3 transition-colors",
														raised
															? "border-md-primary/40 bg-md-surface-container-high"
															: "border-md-outline-variant/25 bg-md-surface-container opacity-85",
													)}
												>
													<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
														<div className="flex min-w-0 flex-col gap-1">
															<div className="flex min-w-0 flex-wrap items-center gap-1.5">
																<SkillNameWithHint
																	name={key}
																	className={
																		raised
																			? "text-label-large-emph text-foreground"
																			: undefined
																	}
																/>
																{entry.modernOnly ? (
																	<Badge
																		variant="soft"
																		tone="default"
																		size="sm"
																	>
																		{t("characterCreation.modernSkill")}
																	</Badge>
																) : null}
																{entry.uncommon ? (
																	<Badge
																		variant="soft"
																		tone="default"
																		size="sm"
																	>
																		{t("characterCreation.uncommonSkill")}
																	</Badge>
																) : null}
																{occupation !== null ? (
																	isOccupational ? (
																		<Badge
																			variant="soft"
																			tone="accent"
																			size="sm"
																		>
																			{t("characterCreation.filterOccupation")}
																		</Badge>
																	) : null
																) : (
																	<label
																		htmlFor={`occupation-${key}`}
																		className="flex w-fit cursor-pointer items-center gap-1.5 text-label-small text-foreground-secondary"
																	>
																		<Checkbox
																			id={`occupation-${key}`}
																			aria-label={t(
																				"characterCreation.occupationSkill",
																				{
																					name: key,
																				},
																			)}
																			checked={isOccupational}
																			onCheckedChange={(checked) =>
																				toggleOccupationSkill(
																					key,
																					checked === true,
																				)
																			}
																		/>
																		{t("characterCreation.filterOccupation")}
																	</label>
																)}
															</div>
															<span className="font-mono text-label-small text-foreground-secondary tabular-nums">
																{t("characterCreation.skillBase", {
																	value: base,
																})}{" "}
																·{" "}
																{t("characterCreation.halfFifth", {
																	half: Math.floor(current / 2),
																	fifth: Math.floor(current / 5),
																})}
															</span>
														</div>
														<div className="flex items-center gap-1">
															<NumericField
																label={t("characterCreation.skillValue", {
																	name: key,
																})}
																hideLabel
																className="w-28"
																value={current}
																min={0}
																max={999}
																showValidation={showValidation}
																onErrorChange={(message) =>
																	reportError(`skill-${key}`, message)
																}
																onChange={(value) =>
																	setSkillTotal(key, value ?? current)
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
																	aria-label={t(
																		"characterCreation.resetSkill",
																		{
																			name: key,
																		},
																	)}
																	onClick={() => resetSkill(key)}
																>
																	<RotateCcw />
																</Button>
															) : null}
														</div>
													</div>

													{key !== "克苏鲁神话" ? (
														<div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator-secondary/30 pt-2">
															<div className="flex flex-wrap items-center gap-1.5 font-mono text-label-small text-foreground-secondary">
																<button
																	type="button"
																	onClick={() =>
																		adjustBucket(key, "occupation", 5)
																	}
																	className="bg-md-surface-container-low hover:bg-md-surface-container-highest rounded-md px-2 py-0.5 tabular-nums"
																>
																	{t("characterCreation.skillColumnOccupation")}{" "}
																	{split.occupation || "—"}
																</button>
																<button
																	type="button"
																	onClick={() =>
																		adjustBucket(key, "interest", 5)
																	}
																	className="bg-md-surface-container-low hover:bg-md-surface-container-highest rounded-md px-2 py-0.5 tabular-nums"
																>
																	{t("characterCreation.skillColumnInterest")}{" "}
																	{split.interest || "—"}
																</button>
																{storied ? (
																	<button
																		type="button"
																		onClick={() =>
																			adjustBucket(key, "experience", 5)
																		}
																		className="bg-md-surface-container-low hover:bg-md-surface-container-highest rounded-md px-2 py-0.5 tabular-nums"
																	>
																		{t(
																			"characterCreation.skillColumnExperience",
																		)}{" "}
																		{split.experience || "—"}
																	</button>
																) : null}
															</div>
															<div className="flex items-center gap-1">
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="h-7 px-2 font-mono text-label-small"
																	onClick={() =>
																		adjustBucket(key, defaultBucket, 5)
																	}
																>
																	{t("characterCreation.skillQuickAdd5")}
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="h-7 px-2 font-mono text-label-small"
																	onClick={() =>
																		adjustBucket(key, defaultBucket, 10)
																	}
																>
																	{t("characterCreation.skillQuickAdd10")}
																</Button>
															</div>
														</div>
													) : null}

													{custom ? (
														<div className="max-w-40">
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
																	onChange({
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
										{!filterActive && coc7e.COC7E_SKILL_GROUP_INFO[group] ? (
											<Coc7eSpecialtyAddRow
												group={group}
												onAdd={(name) => addGroupSpecialty(group, name)}
											/>
										) : null}
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
							onErrorChange={(message) =>
								reportError("new-custom-base", message)
							}
							onChange={(value) => setCustomBase(value ?? 0)}
						/>
						<Button type="button" variant="outline" onClick={addCustomSkill}>
							<Plus />
							{t("characterCreation.addCustomSkill")}
						</Button>
					</div>
				</div>
			</div>
		</SheetSection>
	);
}
