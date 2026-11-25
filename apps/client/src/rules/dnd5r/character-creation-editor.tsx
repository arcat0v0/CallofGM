import {
	dnd5r,
	hasUnsafeMultiLineChars,
	hasUnsafeSingleLineChars,
} from "@cogm/shared";
import { ImagePlus, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	NumericField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { randomUuid } from "@/lib/uuid";
import type { RuleCreationEditorProps } from "../types";
import { DndAbilityBuilder } from "./ability-builder";
import { DndCatalogPicker, DndSourceCredit } from "./catalog-picker";
import {
	DndChoiceGrid,
	DndDerivedGrid,
	DndSelectField,
	DndStringList,
	namedRecordRows,
} from "./editor-controls";
import {
	ABILITIES,
	abilityLabel,
	backgroundLabel,
	classLabel,
	type DndAbility,
	type DndSheet,
	damageLabel,
	SKILLS,
	signed,
	skillLabel,
	speciesLabel,
} from "./labels";
import {
	creatureItems,
	FEAT_CATEGORIES,
	featItems,
	gearItems,
} from "./reference-data";

const TABS = [
	"concept",
	"abilities",
	"proficiencies",
	"equipment",
	"spells",
	"details",
	"reference",
	"review",
] as const;
type TabId = (typeof TABS)[number];

function toggleValue<T>(values: T[], value: T): T[] {
	return values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];
}

function CustomSpellEditor({
	sheet,
	onChange,
}: {
	sheet: DndSheet;
	onChange: (patch: Partial<DndSheet>) => void;
}) {
	const [name, setName] = useState("");
	const [level, setLevel] = useState("0");
	return (
		<FieldSet>
			<FieldLegend>{t("dnd5r.spells.customTitle")}</FieldLegend>
			<FieldDescription>{t("dnd5r.spells.customDescription")}</FieldDescription>
			{namedRecordRows(sheet.customSpells).map(
				({ item: spell, index, key }) => (
					<div
						key={key}
						className="flex items-center gap-2 rounded-xl bg-md-surface-container px-3 py-2"
					>
						<span className="min-w-0 flex-1 truncate">{spell.name}</span>
						<Badge variant="soft" tone="default">
							{t("dnd5r.spells.level", { level: spell.level })}
						</Badge>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t("dnd5r.list.remove", { name: spell.name })}
							onClick={() =>
								onChange({
									customSpells: sheet.customSpells.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
						>
							<X />
						</Button>
					</div>
				),
			)}
			<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
				<Input
					value={name}
					aria-label={t("dnd5r.spells.customName")}
					placeholder={t("dnd5r.spells.customName")}
					onChange={(event) => setName(event.target.value)}
				/>
				<Select value={level} onValueChange={setLevel}>
					<SelectTrigger aria-label={t("dnd5r.spells.customLevel")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="popper">
						<SelectGroup>
							{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((spellLevel) => (
								<SelectItem key={spellLevel} value={String(spellLevel)}>
									{t("dnd5r.spells.level", { level: spellLevel })}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="outline"
					disabled={!name.trim()}
					onClick={() => {
						onChange({
							customSpells: [
								...sheet.customSpells,
								{ name: name.trim(), level: Number(level) },
							],
						});
						setName("");
					}}
				>
					<Plus data-icon="inline-start" />
					{t("dnd5r.list.add")}
				</Button>
			</div>
		</FieldSet>
	);
}

export function DndCharacterCreationEditor(props: RuleCreationEditorProps) {
	if (
		!props.sheet ||
		typeof props.sheet !== "object" ||
		Array.isArray(props.sheet)
	) {
		return (
			<p role="alert" className="text-danger text-body-medium">
				{t("dnd5r.validation.invalidSheet")}
			</p>
		);
	}
	return <DndEditor {...props} sheet={props.sheet as DndSheet} />;
}

function DndEditor({
	sheet,
	onChange: onSheetChange,
	showValidation,
	onValidityChange,
	onWarningsChange,
	characterName,
	onCharacterNameChange,
	background: detailedBackground,
	onBackgroundChange,
	backgroundRequired = true,
	portraitPreviewUrl,
	portraitPending,
	onPickPortraitFile,
	onClearPendingPortrait,
	onManageExpressions,
	identityHeaderSlot,
	onSubmitAction,
	submitLabel,
	submitPending,
}: Omit<RuleCreationEditorProps, "sheet"> & { sheet: DndSheet }) {
	const [tab, setTab] = useState<TabId>("concept");
	const [attackName, setAttackName] = useState("");
	const [resourceName, setResourceName] = useState("");
	const [inventoryName, setInventoryName] = useState("");
	const [abilityDraftDirty, setAbilityDraftDirty] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const derived = useMemo(() => dnd5r.deriveCharacter(sheet), [sheet]);
	const background = dnd5r.BACKGROUNDS[sheet.backgroundId];
	const species = dnd5r.SPECIES[sheet.speciesId];
	const cls = dnd5r.CLASSES[sheet.classId];
	const schema = dnd5r.CharacterSheet.safeParse(sheet);
	const backgroundMissing =
		Boolean(onBackgroundChange) &&
		backgroundRequired &&
		(detailedBackground ?? "").trim() === "";
	const backgroundUnsafe =
		Boolean(onBackgroundChange) &&
		hasUnsafeMultiLineChars(detailedBackground ?? "");
	const nameUnsafe =
		Boolean(onCharacterNameChange) &&
		hasUnsafeSingleLineChars(characterName ?? "");
	const customIssues = useMemo(() => {
		const issues: { tab: TabId; message: string }[] = [];
		if (showValidation && backgroundMissing)
			issues.push({
				tab: "concept",
				message: `${t("characterProfile.detailedBackground")}：${t("characterProfile.detailedBackgroundRequired")}`,
			});
		if (backgroundUnsafe)
			issues.push({
				tab: "concept",
				message: `${t("characterProfile.detailedBackground")}：${t("characterCreation.unsafeText")}`,
			});
		if (nameUnsafe)
			issues.push({
				tab: "concept",
				message: `${t("characterCreation.name")}：${t("characterCreation.unsafeText")}`,
			});
		if (sheet.classId === "custom" && !sheet.className?.trim())
			issues.push({
				tab: "concept",
				message: t("dnd5r.validation.customClass"),
			});
		if (sheet.speciesId === "custom" && !sheet.speciesName?.trim())
			issues.push({
				tab: "concept",
				message: t("dnd5r.validation.customSpecies"),
			});
		if (sheet.backgroundId === "custom" && !sheet.backgroundName?.trim())
			issues.push({
				tab: "concept",
				message: t("dnd5r.validation.customBackground"),
			});
		if (abilityDraftDirty)
			issues.push({ tab: "abilities", message: t("dnd5r.abilities.pending") });
		return issues;
	}, [
		sheet,
		abilityDraftDirty,
		showValidation,
		backgroundMissing,
		backgroundUnsafe,
		nameUnsafe,
	]);
	const issues = useMemo(() => {
		const result = [...customIssues];
		if (!schema.success) {
			result.push({
				tab: "review",
				message: t("dnd5r.validation.schema", {
					field: schema.error.issues[0]?.path.join(".") || "sheet",
				}),
			});
		}
		return result;
	}, [customIssues, schema]);

	useEffect(() => {
		onValidityChange(
			issues.length === 0 &&
				!backgroundMissing &&
				!backgroundUnsafe &&
				!nameUnsafe,
		);
	}, [
		issues.length,
		backgroundMissing,
		backgroundUnsafe,
		nameUnsafe,
		onValidityChange,
	]);
	useEffect(() => {
		onWarningsChange?.(0);
	}, [onWarningsChange]);

	function onChange(patch: Partial<DndSheet>) {
		onSheetChange({ ...sheet, ...patch });
	}

	const skillOptions = SKILLS.map((skill) => ({
		value: skill,
		label: skillLabel(skill),
		detail: `${abilityLabel(dnd5r.SKILLS[skill])} ${signed(derived.skillModifiers[skill])}`,
	}));
	const automaticSkills = [
		...(background?.skills ?? []),
		...(species?.skills ?? []),
	];
	const weaponItems = Object.entries(dnd5r.WEAPONS).map(([id, weapon]) => ({
		id,
		name: weapon.name,
		meta: `${weapon.category} · ${weapon.kind} · ${weapon.damage.count}d${weapon.damage.sides} ${damageLabel(weapon.damage.type)} · ${weapon.properties.join(", ") || weapon.mastery}`,
	}));
	const spellItems = Object.entries(dnd5r.SPELLS).map(([id, spell]) => ({
		id,
		name: spell.name,
		meta: `${t("dnd5r.spells.level", { level: spell.level })} · ${spell.school}`,
	}));

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => setTab(value as TabId)}
			className="gap-5"
		>
			<TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5">
				{TABS.map((id) => (
					<TabsTrigger key={id} value={id} className="min-h-11 flex-none">
						{t(`dnd5r.tabs.${id}`)}
						{issues.some((issue) => issue.tab === id) ? (
							<span
								className="text-danger"
								role="img"
								aria-label={t("dnd5r.validation.tabError")}
							>
								●
							</span>
						) : null}
					</TabsTrigger>
				))}
			</TabsList>

			<TabsContent value="concept" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.concept.title")}
					description={t("dnd5r.concept.description")}
				>
					<div className="grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
						{onPickPortraitFile ? (
							<div className="flex flex-col items-center gap-2">
								<div className="border-md-outline-variant/50 bg-md-surface-container relative size-36 overflow-hidden rounded-t-full rounded-b-xl border">
									{portraitPreviewUrl ? (
										<img
											src={portraitPreviewUrl}
											alt={characterName || t("characterCreation.portrait")}
											className="size-full object-cover"
										/>
									) : (
										<div className="text-foreground-tertiary flex size-full items-center justify-center">
											<UserRound className="size-8" />
										</div>
									)}
								</div>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/png,image/jpeg,image/webp"
									className="hidden"
									onChange={(event) => {
										const file = event.currentTarget.files?.[0];
										event.currentTarget.value = "";
										if (file) onPickPortraitFile(file);
									}}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => fileInputRef.current?.click()}
								>
									<ImagePlus data-icon="inline-start" />
									{t("characterCreation.portraitUpload")}
								</Button>
								{portraitPending && onClearPendingPortrait ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={onClearPendingPortrait}
									>
										<Trash2 data-icon="inline-start" />
										{t("characterCreation.portraitRemove")}
									</Button>
								) : null}
								{onManageExpressions ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={onManageExpressions}
									>
										{t("characterCreation.portraitManageExpressions")}
									</Button>
								) : null}
							</div>
						) : null}
						<FieldGroup>
							{onCharacterNameChange ? (
								<TextField
									label={t("characterCreation.name")}
									value={characterName ?? ""}
									required
									showValidation={showValidation}
									maxLength={100}
									onChange={onCharacterNameChange}
								/>
							) : null}
							{identityHeaderSlot}
							<NumericField
								label={t("dnd5r.concept.level")}
								value={sheet.level}
								min={1}
								max={20}
								showValidation={showValidation}
								onErrorChange={() => undefined}
								onChange={(value) => onChange({ level: value ?? 1 })}
							/>
						</FieldGroup>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<DndSelectField
							label={t("dnd5r.concept.class")}
							value={sheet.classId}
							options={[
								...Object.entries(dnd5r.CLASSES).map(([id, entry]) => ({
									value: id,
									label: entry.name,
								})),
								{ value: "custom", label: t("dnd5r.custom.class") },
							]}
							onChange={(value) => {
								const next = dnd5r.CLASSES[value];
								onChange({
									classId: value as DndSheet["classId"],
									className: value === "custom" ? sheet.className : undefined,
									subclass: next?.subclass ?? "",
									saveProficiencies: next
										? [...next.saves]
										: sheet.saveProficiencies,
									spellcastingAbility: next?.spellcastingAbility,
								});
							}}
							description={
								cls
									? t("dnd5r.concept.classMechanics", {
											die: cls.hitDie,
											saves: cls.saves
												.map(abilityLabel)
												.join(t("common.listSeparator")),
										})
									: undefined
							}
						/>
						<DndSelectField
							label={t("dnd5r.concept.species")}
							value={sheet.speciesId}
							options={[
								...Object.entries(dnd5r.SPECIES).map(([id, entry]) => ({
									value: id,
									label: entry.name,
								})),
								{ value: "custom", label: t("dnd5r.custom.species") },
							]}
							onChange={(value) => {
								const nextSpecies = dnd5r.SPECIES[value];
								const nextBackground = dnd5r.BACKGROUNDS[sheet.backgroundId];
								onChange({
									speciesId: value as DndSheet["speciesId"],
									speciesName:
										value === "custom" ? sheet.speciesName : undefined,
									expertise: sheet.expertise.filter(
										(skill) =>
											sheet.skills.includes(skill) ||
											nextSpecies?.skills?.includes(skill) ||
											nextBackground?.skills.includes(skill),
									),
								});
							}}
							description={
								species
									? t("dnd5r.concept.speciesMechanics", {
											speed: species.speed,
											darkvision: species.darkvision ?? 0,
										})
									: undefined
							}
						/>
						<DndSelectField
							label={t("dnd5r.concept.background")}
							value={sheet.backgroundId}
							options={[
								...Object.entries(dnd5r.BACKGROUNDS).map(([id, entry]) => ({
									value: id,
									label: entry.name,
								})),
								{ value: "custom", label: t("dnd5r.custom.background") },
							]}
							onChange={(value) => {
								setAbilityDraftDirty(false);
								const nextBackground = dnd5r.BACKGROUNDS[value];
								onChange({
									backgroundId: value as DndSheet["backgroundId"],
									backgroundName:
										value === "custom" ? sheet.backgroundName : undefined,
									expertise: sheet.expertise.filter(
										(skill) =>
											sheet.skills.includes(skill) ||
											nextBackground?.skills.includes(skill) ||
											species?.skills?.includes(skill),
									),
								});
							}}
							description={
								background
									? t("dnd5r.concept.backgroundMechanics", {
											skills: background.skills
												.map(skillLabel)
												.join(t("common.listSeparator")),
											feat: background.feat,
											tool: background.tool,
										})
									: undefined
							}
						/>
					</div>
					{sheet.classId === "custom" ? (
						<TextField
							label={t("dnd5r.custom.className")}
							value={sheet.className ?? ""}
							required
							showValidation={showValidation}
							onChange={(value) => onChange({ className: value })}
						/>
					) : null}
					{sheet.speciesId === "custom" ? (
						<TextField
							label={t("dnd5r.custom.speciesName")}
							value={sheet.speciesName ?? ""}
							required
							showValidation={showValidation}
							onChange={(value) => onChange({ speciesName: value })}
						/>
					) : null}
					{sheet.backgroundId === "custom" ? (
						<TextField
							label={t("dnd5r.custom.backgroundName")}
							value={sheet.backgroundName ?? ""}
							required
							showValidation={showValidation}
							onChange={(value) => onChange({ backgroundName: value })}
						/>
					) : null}
					<TextField
						label={t("dnd5r.concept.subclass")}
						value={sheet.subclass}
						placeholder={cls?.subclass}
						maxLength={120}
						onChange={(value) => onChange({ subclass: value })}
					/>
					{onBackgroundChange ? (
						<TextField
							label={t("characterProfile.detailedBackground")}
							value={detailedBackground ?? ""}
							multiline
							required={backgroundRequired}
							requiredMessage={t("characterProfile.detailedBackgroundRequired")}
							showValidation={showValidation}
							maxLength={4000}
							placeholder={t("characterProfile.detailedBackgroundHint")}
							onChange={onBackgroundChange}
						/>
					) : null}
					<DndSelectField
						label={t("dnd5r.concept.creature")}
						value={sheet.creatureId ?? "none"}
						options={[
							{ value: "none", label: t("dnd5r.concept.noCreature") },
							...Object.entries(dnd5r.CREATURES).map(([id, creature]) => ({
								value: id,
								label: `${creature.name} · CR ${creature.cr}`,
							})),
						]}
						onChange={(value) =>
							onChange({ creatureId: value === "none" ? undefined : value })
						}
						description={t("dnd5r.concept.creatureDescription")}
					/>
				</SheetSection>
				<SheetSection
					title={t("dnd5r.derived.title")}
					description={t("dnd5r.derived.description")}
				>
					<DndDerivedGrid
						items={[
							{ label: "HP", value: derived.maxHp },
							{ label: "AC", value: derived.armorClass },
							{
								label: t("dnd5r.derived.proficiency"),
								value: signed(derived.proficiencyBonus),
							},
							{
								label: t("dnd5r.derived.initiative"),
								value: signed(derived.initiative),
							},
							{ label: t("dnd5r.derived.speed"), value: derived.speed },
							{
								label: t("dnd5r.derived.passivePerception"),
								value: derived.passivePerception,
							},
						]}
					/>
				</SheetSection>
			</TabsContent>

			<TabsContent
				value="abilities"
				forceMount
				className="flex flex-col gap-5 data-[state=inactive]:hidden"
			>
				<DndAbilityBuilder
					key={sheet.backgroundId}
					sheet={sheet}
					onChange={onChange}
					showValidation={showValidation}
					onDirtyChange={setAbilityDraftDirty}
				/>
				<SheetSection
					title={t("dnd5r.abilities.finalTitle")}
					description={t("dnd5r.abilities.finalDescription")}
				>
					<DndDerivedGrid
						items={ABILITIES.map((ability) => ({
							label: abilityLabel(ability),
							value: `${sheet.abilities[ability]} (${signed(derived.abilityModifiers[ability])})`,
						}))}
					/>
					<DndChoiceGrid
						legend={t("dnd5r.abilities.saves")}
						description={t("dnd5r.abilities.savesDescription")}
						options={ABILITIES.map((ability) => ({
							value: ability,
							label: abilityLabel(ability),
							detail: signed(derived.savingThrows[ability]),
						}))}
						selected={sheet.saveProficiencies ?? [...derived.saveProficiencies]}
						onToggle={(value) =>
							onChange({
								saveProficiencies: toggleValue(
									sheet.saveProficiencies ?? [...derived.saveProficiencies],
									value as DndAbility,
								),
							})
						}
					/>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<NumericField
							label={t("dnd5r.overrides.maxHp")}
							value={sheet.maxHpOverride ?? null}
							nullable
							min={1}
							max={9999}
							onErrorChange={() => undefined}
							onChange={(value) =>
								onChange({ maxHpOverride: value ?? undefined })
							}
						/>
						<NumericField
							label={t("dnd5r.overrides.ac")}
							value={sheet.armorClassOverride ?? null}
							nullable
							min={1}
							max={40}
							onErrorChange={() => undefined}
							onChange={(value) =>
								onChange({ armorClassOverride: value ?? undefined })
							}
						/>
						<NumericField
							label={t("dnd5r.overrides.speed")}
							value={sheet.speedOverride ?? null}
							nullable
							min={0}
							max={300}
							onErrorChange={() => undefined}
							onChange={(value) =>
								onChange({ speedOverride: value ?? undefined })
							}
						/>
						<NumericField
							label={t("dnd5r.overrides.initiative")}
							value={sheet.initiativeModifier ?? null}
							nullable
							min={-10}
							max={30}
							onErrorChange={() => undefined}
							onChange={(value) =>
								onChange({ initiativeModifier: value ?? undefined })
							}
						/>
					</div>
				</SheetSection>
			</TabsContent>

			<TabsContent value="proficiencies" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.proficiencies.title")}
					description={t("dnd5r.proficiencies.description")}
				>
					<DndChoiceGrid
						legend={t("dnd5r.proficiencies.skills")}
						options={skillOptions}
						selected={[...new Set([...automaticSkills, ...sheet.skills])]}
						disabled={(skill) => automaticSkills.includes(skill as dnd5r.Skill)}
						badges={(skill) =>
							automaticSkills.includes(skill as dnd5r.Skill)
								? t("dnd5r.proficiencies.origin")
								: null
						}
						onToggle={(skill) =>
							onChange({
								skills: toggleValue(sheet.skills, skill as dnd5r.Skill),
								expertise: sheet.expertise.filter((item) => item !== skill),
							})
						}
					/>
					<DndChoiceGrid
						legend={t("dnd5r.proficiencies.expertise")}
						description={t("dnd5r.proficiencies.expertiseDescription")}
						options={skillOptions}
						selected={sheet.expertise}
						disabled={(skill) =>
							!derived.skillProficiencies.includes(skill as dnd5r.Skill)
						}
						onToggle={(skill) =>
							onChange({
								expertise: toggleValue(sheet.expertise, skill as dnd5r.Skill),
							})
						}
					/>
					<DndStringList
						label={t("dnd5r.proficiencies.feats")}
						description={
							background
								? t("dnd5r.proficiencies.originFeat", { feat: background.feat })
								: undefined
						}
						values={sheet.feats}
						placeholder={t("dnd5r.proficiencies.featPlaceholder")}
						onChange={(feats) => onChange({ feats })}
					/>
					<DndCatalogPicker
						legend={t("dnd5r.reference.feats")}
						description={t("dnd5r.reference.featsDescription")}
						items={featItems(sheet.level)}
						selectedIds={sheet.feats}
						searchLabel={t("dnd5r.reference.searchFeats")}
						categories={FEAT_CATEGORIES}
						categoryLabel={t("dnd5r.reference.featCategory")}
						onToggle={(feat) =>
							onChange({ feats: toggleValue(sheet.feats, feat) })
						}
					/>
					<DndStringList
						label={t("dnd5r.proficiencies.languages")}
						values={sheet.languages}
						placeholder={t("dnd5r.proficiencies.languagePlaceholder")}
						onChange={(languages) => onChange({ languages })}
					/>
				</SheetSection>
			</TabsContent>

			<TabsContent value="equipment" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.equipment.armorTitle")}
					description={t("dnd5r.equipment.armorDescription")}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<DndSelectField
							label={t("dnd5r.equipment.armor")}
							value={sheet.armorId ?? "none"}
							options={[
								{ value: "none", label: t("dnd5r.equipment.noArmor") },
								...Object.entries(dnd5r.ARMORS).map(([id, armor]) => ({
									value: id,
									label: `${armor.name} · AC ${armor.ac} · ${armor.category}`,
								})),
							]}
							onChange={(value) =>
								onChange({ armorId: value === "none" ? null : value })
							}
						/>
						<Field orientation="horizontal">
							<Switch
								id="dnd-shield"
								checked={sheet.shield}
								onCheckedChange={(shield) => onChange({ shield })}
							/>
							<FieldLabel htmlFor="dnd-shield">
								{t("dnd5r.equipment.shield")}
							</FieldLabel>
						</Field>
					</div>
				</SheetSection>
				<SheetSection
					title={t("dnd5r.equipment.weaponsTitle")}
					description={t("dnd5r.equipment.weaponsDescription")}
				>
					<DndCatalogPicker
						legend={t("dnd5r.equipment.weaponsTitle")}
						description={t("dnd5r.catalog.weaponGuide")}
						items={weaponItems}
						selectedIds={sheet.weaponIds}
						searchLabel={t("dnd5r.catalog.searchWeapons")}
						onToggle={(id) =>
							onChange({ weaponIds: toggleValue(sheet.weaponIds, id) })
						}
					/>
					<FieldSet>
						<FieldLegend>{t("dnd5r.equipment.customAttacks")}</FieldLegend>
						<FieldDescription>
							{t("dnd5r.equipment.customAttackDescription")}
						</FieldDescription>
						{sheet.customAttacks.map((attack, index) => (
							<div
								key={attack.id}
								className="grid gap-2 rounded-xl bg-md-surface-container p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem_auto]"
							>
								<Input
									value={attack.name}
									aria-label={t("dnd5r.equipment.attackName")}
									onChange={(event) =>
										onChange({
											customAttacks: sheet.customAttacks.map(
												(item, itemIndex) =>
													itemIndex === index
														? { ...item, name: event.target.value }
														: item,
											),
										})
									}
								/>
								<Select
									value={String(attack.damage.count)}
									onValueChange={(value) =>
										onChange({
											customAttacks: sheet.customAttacks.map(
												(item, itemIndex) =>
													itemIndex === index
														? {
																...item,
																damage: {
																	...item.damage,
																	count: Number(value),
																},
															}
														: item,
											),
										})
									}
								>
									<SelectTrigger aria-label={t("dnd5r.equipment.damageCount")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{Array.from({ length: 21 }, (_, count) => count).map(
												(count) => (
													<SelectItem key={count} value={String(count)}>
														{count}
													</SelectItem>
												),
											)}
										</SelectGroup>
									</SelectContent>
								</Select>
								<Select
									value={String(attack.damage.sides)}
									onValueChange={(value) =>
										onChange({
											customAttacks: sheet.customAttacks.map(
												(item, itemIndex) =>
													itemIndex === index
														? {
																...item,
																damage: {
																	...item.damage,
																	sides: Number(value) as 4 | 6 | 8 | 10 | 12,
																},
															}
														: item,
											),
										})
									}
								>
									<SelectTrigger aria-label={t("dnd5r.equipment.damageDie")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{[4, 6, 8, 10, 12].map((sides) => (
												<SelectItem key={sides} value={String(sides)}>
													d{sides}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
								<Select
									value={attack.damage.type}
									onValueChange={(value) =>
										onChange({
											customAttacks: sheet.customAttacks.map(
												(item, itemIndex) =>
													itemIndex === index
														? {
																...item,
																damage: {
																	...item.damage,
																	type: value as dnd5r.DamageType,
																},
															}
														: item,
											),
										})
									}
								>
									<SelectTrigger aria-label={t("dnd5r.equipment.damageType")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{dnd5r.DAMAGE_TYPES.map((type) => (
												<SelectItem key={type} value={type}>
													{damageLabel(type)}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
								<Button
									type="button"
									variant="ghost"
									size="icon-md"
									aria-label={t("dnd5r.list.remove", { name: attack.name })}
									onClick={() =>
										onChange({
											customAttacks: sheet.customAttacks.filter(
												(item) => item.id !== attack.id,
											),
										})
									}
								>
									<X />
								</Button>
							</div>
						))}
						<div className="flex gap-2">
							<Input
								value={attackName}
								placeholder={t("dnd5r.equipment.attackName")}
								aria-label={t("dnd5r.equipment.attackName")}
								onChange={(event) => setAttackName(event.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								disabled={!attackName.trim()}
								onClick={() => {
									onChange({
										customAttacks: [
											...sheet.customAttacks,
											{
												id: `custom-${randomUuid()}`,
												name: attackName.trim(),
												damage: { count: 1, sides: 6, type: "bludgeoning" },
												ability: "str",
												proficient: true,
											},
										],
									});
									setAttackName("");
								}}
							>
								<Plus data-icon="inline-start" />
								{t("dnd5r.list.add")}
							</Button>
						</div>
					</FieldSet>
				</SheetSection>
				<SheetSection
					title={t("dnd5r.equipment.inventoryTitle")}
					description={t("dnd5r.equipment.inventoryDescription")}
				>
					<DndCatalogPicker
						legend={t("dnd5r.reference.gear")}
						description={t("dnd5r.reference.gearDescription")}
						items={gearItems()}
						selectedIds={sheet.inventory.map((item) => item.name)}
						searchLabel={t("dnd5r.reference.searchGear")}
						onToggle={(name) =>
							onChange({
								inventory: sheet.inventory.some((item) => item.name === name)
									? sheet.inventory.filter((item) => item.name !== name)
									: [...sheet.inventory, { name, quantity: 1 }],
							})
						}
					/>
					{namedRecordRows(sheet.inventory).map(({ item, index, key }) => (
						<div
							key={key}
							className="flex items-center gap-2 rounded-xl bg-md-surface-container px-3 py-2"
						>
							<Input
								defaultValue={item.name}
								aria-label={t("dnd5r.equipment.itemName")}
								onBlur={(event) =>
									onChange({
										inventory: sheet.inventory.map((entry, itemIndex) =>
											itemIndex === index
												? { ...entry, name: event.target.value }
												: entry,
										),
									})
								}
							/>
							<Input
								type="number"
								min={1}
								max={9999}
								value={item.quantity}
								className="w-24"
								aria-label={t("dnd5r.equipment.quantity")}
								onChange={(event) =>
									onChange({
										inventory: sheet.inventory.map((entry, itemIndex) =>
											itemIndex === index
												? { ...entry, quantity: Number(event.target.value) }
												: entry,
										),
									})
								}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={t("dnd5r.list.remove", { name: item.name })}
								onClick={() =>
									onChange({
										inventory: sheet.inventory.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<X />
							</Button>
						</div>
					))}
					<div className="flex gap-2">
						<Input
							value={inventoryName}
							placeholder={t("dnd5r.equipment.itemName")}
							aria-label={t("dnd5r.equipment.itemName")}
							onChange={(event) => setInventoryName(event.target.value)}
						/>
						<Button
							type="button"
							variant="outline"
							disabled={!inventoryName.trim()}
							onClick={() => {
								onChange({
									inventory: [
										...sheet.inventory,
										{ name: inventoryName.trim(), quantity: 1 },
									],
								});
								setInventoryName("");
							}}
						>
							<Plus data-icon="inline-start" />
							{t("dnd5r.list.add")}
						</Button>
					</div>
				</SheetSection>
			</TabsContent>

			<TabsContent value="spells" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.spells.title")}
					description={
						derived.spellcastingAbility
							? t("dnd5r.spells.casterDescription")
							: t("dnd5r.spells.nonCasterDescription")
					}
				>
					<DndSelectField
						label={t("dnd5r.spells.ability")}
						value={
							sheet.spellcastingAbility ?? derived.spellcastingAbility ?? "none"
						}
						options={[
							{ value: "none", label: t("dnd5r.spells.noAbility") },
							...ABILITIES.map((ability) => ({
								value: ability,
								label: abilityLabel(ability),
							})),
						]}
						onChange={(value) =>
							onChange({
								spellcastingAbility:
									value === "none" ? undefined : (value as DndAbility),
							})
						}
					/>
					<DndDerivedGrid
						items={[
							{ label: t("dnd5r.spells.saveDc"), value: derived.spellSaveDc },
							{
								label: t("dnd5r.spells.attackBonus"),
								value:
									derived.spellAttackBonus === null
										? null
										: signed(derived.spellAttackBonus),
							},
							{
								label: t("dnd5r.spells.castingAbility"),
								value: derived.spellcastingAbility
									? abilityLabel(derived.spellcastingAbility)
									: null,
							},
						]}
					/>
					{derived.spellSlots.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{Array.from(derived.spellSlots.entries()).map(
								([index, slots]) => (
									<Badge key={index + 1} variant="soft" tone="accent">
										{t("dnd5r.spells.slotSummary", {
											level: index + 1,
											count: slots,
										})}
									</Badge>
								),
							)}
						</div>
					) : null}
					<DndCatalogPicker
						legend={t("dnd5r.spells.catalog")}
						description={t("dnd5r.catalog.spellGuide")}
						items={spellItems}
						selectedIds={sheet.spellIds}
						searchLabel={t("dnd5r.catalog.searchSpells")}
						onToggle={(id) =>
							onChange({ spellIds: toggleValue(sheet.spellIds, id) })
						}
					/>
					<CustomSpellEditor sheet={sheet} onChange={onChange} />
				</SheetSection>
			</TabsContent>

			<TabsContent value="details" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.details.resourcesTitle")}
					description={t("dnd5r.details.resourcesDescription")}
				>
					{derived.resources.map((resource) => (
						<div
							key={resource.id}
							className="flex flex-wrap items-center gap-2 rounded-xl bg-md-surface-container px-3 py-2"
						>
							<span className="min-w-0 flex-1 truncate">{resource.name}</span>
							<Badge variant="soft" tone="default">
								{t("dnd5r.resources.max", { max: resource.max })}
							</Badge>
							<Badge variant="soft" tone="accent">
								{t(`dnd5r.recharge.${resource.recharge}`)}
							</Badge>
							{sheet.resources.some((item) => item.id === resource.id) ? (
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("dnd5r.list.remove", { name: resource.name })}
									onClick={() =>
										onChange({
											resources: sheet.resources.filter(
												(item) => item.id !== resource.id,
											),
										})
									}
								>
									<X />
								</Button>
							) : null}
						</div>
					))}
					<div className="flex gap-2">
						<Input
							value={resourceName}
							placeholder={t("dnd5r.resources.name")}
							aria-label={t("dnd5r.resources.name")}
							onChange={(event) => setResourceName(event.target.value)}
						/>
						<Button
							type="button"
							variant="outline"
							disabled={!resourceName.trim()}
							onClick={() => {
								onChange({
									resources: [
										...sheet.resources,
										{
											id: `custom-${randomUuid()}`,
											name: resourceName.trim(),
											max: 1,
											recharge: "manual",
										},
									],
								});
								setResourceName("");
							}}
						>
							<Plus data-icon="inline-start" />
							{t("dnd5r.list.add")}
						</Button>
					</div>
					{sheet.resources.map((resource, index) => (
						<div
							key={`edit-${resource.id}`}
							className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem]"
						>
							<Input
								value={resource.name}
								aria-label={t("dnd5r.resources.name")}
								onChange={(event) =>
									onChange({
										resources: sheet.resources.map((item, itemIndex) =>
											itemIndex === index
												? { ...item, name: event.target.value }
												: item,
										),
									})
								}
							/>
							<Input
								type="number"
								min={1}
								max={99}
								value={resource.max}
								aria-label={t("dnd5r.resources.maxLabel")}
								onChange={(event) =>
									onChange({
										resources: sheet.resources.map((item, itemIndex) =>
											itemIndex === index
												? { ...item, max: Number(event.target.value) }
												: item,
										),
									})
								}
							/>
							<Select
								value={resource.recharge}
								onValueChange={(value) =>
									onChange({
										resources: sheet.resources.map((item, itemIndex) =>
											itemIndex === index
												? {
														...item,
														recharge: value as "short" | "long" | "manual",
													}
												: item,
										),
									})
								}
							>
								<SelectTrigger aria-label={t("dnd5r.resources.recharge")}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{["short", "long", "manual"].map((recharge) => (
											<SelectItem key={recharge} value={recharge}>
												{t(`dnd5r.recharge.${recharge}`)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					))}
				</SheetSection>
				<SheetSection
					title={t("dnd5r.details.defensesTitle")}
					description={t("dnd5r.details.defensesDescription")}
				>
					{(["resistances", "immunities", "vulnerabilities"] as const).map(
						(field) => (
							<DndChoiceGrid
								key={field}
								legend={t(`dnd5r.details.${field}`)}
								options={dnd5r.DAMAGE_TYPES.map((type) => ({
									value: type,
									label: damageLabel(type),
								}))}
								selected={sheet[field]}
								onToggle={(type) =>
									onChange({
										[field]: toggleValue(
											sheet[field],
											type as dnd5r.DamageType,
										),
									})
								}
							/>
						),
					)}
				</SheetSection>
				<SheetSection
					title={t("dnd5r.details.notesTitle")}
					description={t("dnd5r.details.notesDescription")}
				>
					<Textarea
						value={sheet.notes}
						maxLength={8000}
						aria-label={t("dnd5r.details.notesTitle")}
						className="min-h-48"
						onChange={(event) => onChange({ notes: event.target.value })}
					/>
				</SheetSection>
			</TabsContent>

			<TabsContent value="reference" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.reference.creatures")}
					description={t("dnd5r.reference.creaturesDescription", {
						count: Object.keys(dnd5r.CREATURES).length,
					})}
				>
					<DndCatalogPicker
						legend={t("dnd5r.reference.creatures")}
						description={t("dnd5r.reference.creatureImportGuide")}
						items={creatureItems()}
						selectedIds={sheet.creatureId ? [sheet.creatureId] : []}
						searchLabel={t("dnd5r.reference.searchCreatures")}
						onToggle={(id) =>
							onChange({ creatureId: sheet.creatureId === id ? undefined : id })
						}
					/>
				</SheetSection>
				<SheetSection title={t("dnd5r.source.title")}>
					<DndSourceCredit />
				</SheetSection>
			</TabsContent>
			<TabsContent value="review" className="flex flex-col gap-5">
				<SheetSection
					title={t("dnd5r.review.title")}
					description={t("dnd5r.review.description")}
				>
					<div className="flex flex-wrap gap-2">
						<Badge variant="soft" tone="accent">
							{classLabel(sheet)} · {t("dnd5r.concept.level")} {sheet.level}
						</Badge>
						<Badge variant="soft" tone="default">
							{speciesLabel(sheet)}
						</Badge>
						<Badge variant="soft" tone="default">
							{backgroundLabel(sheet)}
						</Badge>
						{sheet.subclass ? (
							<Badge variant="soft" tone="default">
								{sheet.subclass}
							</Badge>
						) : null}
					</div>
					<DndDerivedGrid
						items={[
							{ label: "HP", value: derived.maxHp },
							{ label: "AC", value: derived.armorClass },
							{
								label: t("dnd5r.derived.proficiency"),
								value: signed(derived.proficiencyBonus),
							},
							{
								label: t("dnd5r.derived.initiative"),
								value: signed(derived.initiative),
							},
							{ label: t("dnd5r.derived.speed"), value: derived.speed },
							{
								label: t("dnd5r.derived.passivePerception"),
								value: derived.passivePerception,
							},
						]}
					/>
					<DndDerivedGrid
						items={ABILITIES.map((ability) => ({
							label: abilityLabel(ability),
							value: `${sheet.abilities[ability]} (${signed(derived.abilityModifiers[ability])})`,
						}))}
					/>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-xl bg-md-surface-container p-4">
							<h3 className="text-title-medium-emph">
								{t("dnd5r.review.attacks")}
							</h3>
							{derived.attacks.map((attack) => (
								<p
									key={attack.id}
									className="text-body-medium text-foreground-secondary"
								>
									{attack.name} · {signed(attack.attackBonus)} ·{" "}
									{attack.damage.count}d{attack.damage.sides}
									{signed(attack.damageBonus)} {damageLabel(attack.damage.type)}
								</p>
							))}
						</div>
						<div className="rounded-xl bg-md-surface-container p-4">
							<h3 className="text-title-medium-emph">
								{t("dnd5r.review.contents")}
							</h3>
							<p>
								{t("dnd5r.review.contentCounts", {
									skills: derived.skillProficiencies.length,
									expertise: sheet.expertise.length,
									weapons: sheet.weaponIds.length + sheet.customAttacks.length,
									spells: sheet.spellIds.length + sheet.customSpells.length,
									inventory: sheet.inventory.length,
									feats: sheet.feats.length,
								})}
							</p>
						</div>
					</div>
					{issues.length > 0 && showValidation ? (
						<div
							role="alert"
							className="flex flex-col gap-2 rounded-xl bg-danger-soft p-4 text-danger-soft-foreground"
						>
							{issues.map((issue) => (
								<p key={issue.message}>{issue.message}</p>
							))}
						</div>
					) : (
						<p className="rounded-xl bg-md-surface-container p-4 text-success">
							{t("dnd5r.review.ready")}
						</p>
					)}
					{onSubmitAction ? (
						<Button
							type="button"
							variant="primary"
							className="self-end"
							disabled={submitPending}
							onClick={onSubmitAction}
						>
							<Save data-icon="inline-start" />
							{submitLabel ?? t("common.save")}
						</Button>
					) : null}
				</SheetSection>
				<SheetSection title={t("dnd5r.source.title")}>
					<DndSourceCredit />
				</SheetSection>
			</TabsContent>
		</Tabs>
	);
}
