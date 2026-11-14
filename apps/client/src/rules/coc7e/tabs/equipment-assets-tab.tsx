import { coc7e } from "@cogm/shared";
import {
	AlertTriangle,
	Backpack,
	ChevronDown,
	Minus,
	Plus,
	Shield,
	Sparkles,
	Swords,
	Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	NumericField,
	SelectField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Coc7eArmorPicker, Coc7eWeaponPicker } from "../equipment-picker";
import { Coc7eSpellPicker } from "../spell-picker";

type Sheet = coc7e.Coc7eCharacterSheet;
type GearSlot = coc7e.Coc7eGearSlot;
type GearStatus = coc7e.Coc7eGearStatus;

const SLOT_OPTIONS: Array<{ value: GearSlot; labelKey: string }> = [
	{ value: "none", labelKey: "characterCreation.slot.none" },
	{ value: "head", labelKey: "characterCreation.slot.head" },
	{ value: "chest", labelKey: "characterCreation.slot.chest" },
	{ value: "waist", labelKey: "characterCreation.slot.waist" },
	{ value: "hand", labelKey: "characterCreation.slot.hand" },
	{ value: "other", labelKey: "characterCreation.slot.other" },
];

const STATUS_OPTIONS: Array<{ value: GearStatus; labelKey: string }> = [
	{ value: "in_use", labelKey: "characterCreation.gearStatus.in_use" },
	{ value: "lent", labelKey: "characterCreation.gearStatus.lent" },
	{ value: "lost", labelKey: "characterCreation.gearStatus.lost" },
];

const WEAPON_NAME_PATTERN =
	/(手枪|左轮|步枪|霰弹|冲锋枪|机枪|刀|匕首|剑|斧|棍|棒|弓|弩|tec-?9|pistol|revolver|rifle|shotgun|knife)/i;

export function Coc7eEquipmentAssetsTab({
	sheet,
	onChange,
	showValidation,
	reportError,
	skillOptions,
	onJumpToOccupation,
}: {
	sheet: Sheet;
	onChange: (patch: Partial<Sheet>) => void;
	showValidation: boolean;
	reportError: (key: string, message: string | null) => void;
	skillOptions: ReadonlyArray<{ value: string; label: string }>;
	onJumpToOccupation: () => void;
}) {
	const [quickGearName, setQuickGearName] = useState("");
	const [expandedWeapons, setExpandedWeapons] = useState<
		Record<number, boolean>
	>({});
	const [expandedGearIndex, setExpandedGearIndex] = useState<number | null>(
		null,
	);

	const credit = coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0;
	const recommendation = coc7e.coc7eAssetRecommendation(sheet.era, credit);
	const creditTooLow = credit < sheet.occupation.creditMin;
	const creditTooHigh = credit > sheet.occupation.creditMax;
	const creditOutOfRange = creditTooLow || creditTooHigh;
	const fixTarget = creditTooLow
		? sheet.occupation.creditMin
		: sheet.occupation.creditMax;

	function setCreditRating(value: number) {
		onChange({ skills: { ...sheet.skills, 信用评级: value } });
	}

	function updateWeapon(
		index: number,
		patch: Partial<Sheet["weapons"][number]>,
	) {
		onChange({
			weapons: sheet.weapons.map((weapon, itemIndex) =>
				itemIndex === index ? { ...weapon, ...patch } : weapon,
			),
		});
	}

	function updateGear(index: number, patch: Partial<Sheet["gear"][number]>) {
		onChange({
			gear: sheet.gear.map((entry, itemIndex) =>
				itemIndex === index ? { ...entry, ...patch } : entry,
			),
		});
	}

	function addQuickGear() {
		const trimmed = quickGearName.trim();
		if (!trimmed || sheet.gear.length >= 200) {
			return;
		}
		onChange({
			gear: [...sheet.gear, { name: trimmed, quantity: 1 }],
		});
		setQuickGearName("");
	}

	function registerGearAsWeapon(name: string) {
		if (sheet.weapons.length >= 100) {
			return;
		}
		const isFirearm =
			/(枪|左轮|步枪|霰弹|冲锋|tec|pistol|revolver|rifle)/i.test(name);
		onChange({
			weapons: [
				...sheet.weapons,
				{
					name,
					skillKey: isFirearm ? "射击(手枪)" : "格斗(斗殴)",
					damage: isFirearm ? "1d10" : "1d4",
					range: isFirearm ? "15 码" : "",
					attacks: "1",
					ammo: null,
					malfunction: null,
					impale: false,
					applyDamageBonus: !isFirearm,
				},
			],
		});
	}

	function updateSpell(index: number, patch: Partial<Sheet["spells"][number]>) {
		onChange({
			spells: sheet.spells.map((spell, itemIndex) =>
				itemIndex === index ? { ...spell, ...patch } : spell,
			),
		});
	}

	function updateTome(
		index: number,
		patch: Partial<Sheet["mythosTomes"][number]>,
	) {
		onChange({
			mythosTomes: sheet.mythosTomes.map((tome, itemIndex) =>
				itemIndex === index ? { ...tome, ...patch } : tome,
			),
		});
	}

	function updateEncounter(
		index: number,
		patch: Partial<Sheet["encounters"][number]>,
	) {
		onChange({
			encounters: sheet.encounters.map((encounter, itemIndex) =>
				itemIndex === index ? { ...encounter, ...patch } : encounter,
			),
		});
	}

	const wornGear = sheet.gear
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => item.slot && item.slot !== "none");
	const backpackGear = sheet.gear
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => !item.slot || item.slot === "none");

	return (
		<div className="flex flex-col gap-6">
			<SheetSection title={t("characterCreation.assets")}>
				{creditOutOfRange ? (
					<div
						role="status"
						className="border-danger/60 bg-warning-soft text-warning-soft-foreground flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setCreditRating(fixTarget)}
							>
								{t("characterCreation.fixCreditToMin", { value: fixTarget })}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={onJumpToOccupation}
							>
								{t("characterCreation.goToOccupationTab")}
							</Button>
						</div>
					</div>
				) : null}

				<div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
					<div
						className={cn(
							"rounded-xl border p-3.5",
							creditOutOfRange
								? "border-danger bg-md-surface-container-high"
								: "border-md-outline-variant/40 bg-md-surface-container",
						)}
					>
						<NumericField
							label={t("characterCreation.creditRatingLabel")}
							value={credit}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) =>
								reportError("skill-信用评级", message)
							}
							onChange={(value) => setCreditRating(value ?? credit)}
						/>
						<p
							className={cn(
								"mt-1.5 font-mono text-label-small",
								creditOutOfRange ? "text-warning" : "text-success",
							)}
						>
							{t(
								creditOutOfRange
									? "characterCreation.creditRangeBad"
									: "characterCreation.creditRangeOk",
								{
									min: sheet.occupation.creditMin,
									max: sheet.occupation.creditMax,
								},
							)}
						</p>
					</div>

					<div className="flex flex-col justify-between gap-3 rounded-xl bg-md-surface-container p-4 sm:flex-row sm:items-center">
						<div className="flex flex-col gap-1">
							<p className="text-body-medium text-foreground">
								{t("characterCreation.assetRecommendation", {
									lifestyle: recommendation.lifestyle,
									cash: formatNumber(recommendation.cash),
									otherAssets: formatNumber(recommendation.otherAssets),
									spendingLevel: formatNumber(recommendation.spendingLevel),
								})}
							</p>
							<span className="font-mono text-label-small text-foreground-secondary">
								{t("characterCreation.lifestyleSummary", {
									lifestyle: recommendation.lifestyle,
									spending: `${sheet.assets.currency}${formatNumber(recommendation.spendingLevel)}`,
									cash: `${sheet.assets.currency}${formatNumber(recommendation.cash)}`,
								})}
							</span>
						</div>
						<Button
							type="button"
							variant="outline"
							className="shrink-0"
							onClick={() =>
								onChange({
									assets: {
										...sheet.assets,
										cash: recommendation.cash,
										otherAssets: recommendation.otherAssets,
										spendingLevel: recommendation.spendingLevel,
									},
								})
							}
						>
							{t("characterCreation.applyAssets")}
						</Button>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
					<TextField
						label={t("characterCreation.currency")}
						value={sheet.assets.currency}
						required
						maxLength={16}
						showValidation={showValidation}
						onChange={(currency) =>
							onChange({ assets: { ...sheet.assets, currency } })
						}
					/>
					<MoneyField
						label={t("characterCreation.spendingLevel")}
						value={sheet.assets.spendingLevel}
						showValidation={showValidation}
						reportError={(message) => reportError("spending", message)}
						onChange={(spendingLevel) =>
							onChange({
								assets: { ...sheet.assets, spendingLevel: spendingLevel ?? 0 },
							})
						}
					/>
					<MoneyField
						label={t("characterCreation.cash")}
						value={sheet.assets.cash}
						showValidation={showValidation}
						reportError={(message) => reportError("cash", message)}
						onChange={(cash) =>
							onChange({ assets: { ...sheet.assets, cash: cash ?? 0 } })
						}
					/>
					<MoneyField
						label={t("characterCreation.otherAssets")}
						value={sheet.assets.otherAssets}
						showValidation={showValidation}
						reportError={(message) => reportError("other-assets", message)}
						onChange={(otherAssets) =>
							onChange({
								assets: { ...sheet.assets, otherAssets: otherAssets ?? 0 },
							})
						}
					/>
				</div>

				<RecordGroup
					title={t("characterCreation.assetDetails")}
					actionLabel={t("characterCreation.addAsset")}
					disabled={sheet.assets.details.length >= 200}
					onAdd={() =>
						onChange({
							assets: {
								...sheet.assets,
								details: [
									...sheet.assets.details,
									{
										category: "other",
										name: t("characterCreation.newAsset"),
										value: 0,
									},
								],
							},
						})
					}
				>
					{sheet.assets.details.map((asset, index) => (
						<RecordCard
							key={`${asset.name}-${index}`}
							removeLabel={t("characterCreation.removeAsset", {
								index: index + 1,
							})}
							onRemove={() =>
								onChange({
									assets: {
										...sheet.assets,
										details: sheet.assets.details.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									},
								})
							}
						>
							<div className="grid gap-3 md:grid-cols-3">
								<SelectField
									label={t("characterCreation.assetCategory", {
										index: index + 1,
									})}
									value={asset.category}
									options={[
										{
											value: "transport",
											label: t("characterCreation.assetTransport"),
										},
										{
											value: "residence",
											label: t("characterCreation.assetResidence"),
										},
										{
											value: "luxury",
											label: t("characterCreation.assetLuxury"),
										},
										{
											value: "securities",
											label: t("characterCreation.assetSecurities"),
										},
										{
											value: "other",
											label: t("characterCreation.assetOther"),
										},
									]}
									onChange={(category) =>
										onChange({
											assets: {
												...sheet.assets,
												details: sheet.assets.details.map((entry, itemIndex) =>
													itemIndex === index
														? {
																...entry,
																category:
																	category as Sheet["assets"]["details"][number]["category"],
															}
														: entry,
												),
											},
										})
									}
								/>
								<TextField
									label={t("characterCreation.assetName", { index: index + 1 })}
									value={asset.name}
									required
									maxLength={200}
									showValidation={showValidation}
									onChange={(name) =>
										onChange({
											assets: {
												...sheet.assets,
												details: sheet.assets.details.map((entry, itemIndex) =>
													itemIndex === index ? { ...entry, name } : entry,
												),
											},
										})
									}
								/>
								<MoneyField
									label={t("characterCreation.assetValue", {
										index: index + 1,
									})}
									value={asset.value}
									showValidation={showValidation}
									reportError={(message) =>
										reportError(`asset-${index}`, message)
									}
									onChange={(value) =>
										onChange({
											assets: {
												...sheet.assets,
												details: sheet.assets.details.map((entry, itemIndex) =>
													itemIndex === index
														? { ...entry, value: value ?? 0 }
														: entry,
												),
											},
										})
									}
								/>
							</div>
						</RecordCard>
					))}
				</RecordGroup>
			</SheetSection>

			<SheetSection title={t("characterCreation.combat")}>
				<RecordGroup
					title={t("characterCreation.weaponsCompactTitle")}
					actionLabel={t("characterCreation.addWeapon")}
					disabled={sheet.weapons.length >= 100}
					extraAction={
						<Coc7eWeaponPicker
							era={sheet.era}
							exclude={sheet.weapons.map((weapon) => weapon.name)}
							disabled={sheet.weapons.length >= 100}
							onPick={(weapon) =>
								onChange({ weapons: [...sheet.weapons, weapon] })
							}
						/>
					}
					onAdd={() =>
						onChange({
							weapons: [
								...sheet.weapons,
								{
									name: t("characterCreation.newWeapon"),
									skillKey: "格斗(斗殴)",
									damage: "1d4",
									range: "",
									attacks: "",
									ammo: null,
									malfunction: null,
									impale: false,
									applyDamageBonus: false,
								},
							],
						})
					}
				>
					{sheet.weapons.map((weapon, index) => {
						const expanded = expandedWeapons[index] === true;
						return (
							<RecordCard
								key={`${weapon.name}-${index}`}
								removeLabel={t("characterCreation.removeWeapon", {
									index: index + 1,
								})}
								onRemove={() =>
									onChange({
										weapons: sheet.weapons.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<div className="grid gap-3 md:grid-cols-3">
									<TextField
										label={t("characterCreation.weaponName", {
											index: index + 1,
										})}
										value={weapon.name}
										required
										showValidation={showValidation}
										onChange={(name) => updateWeapon(index, { name })}
									/>
									<SelectField
										label={t("characterCreation.weaponSkill", {
											index: index + 1,
										})}
										value={weapon.skillKey}
										options={skillOptions}
										onChange={(skillKey) => updateWeapon(index, { skillKey })}
									/>
									<TextField
										label={t("characterCreation.weaponDamage", {
											index: index + 1,
										})}
										value={weapon.damage}
										required
										showValidation={showValidation}
										onChange={(damage) => updateWeapon(index, { damage })}
									/>
								</div>
								<div className="mt-2.5 flex items-center justify-between gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() =>
											setExpandedWeapons((current) => ({
												...current,
												[index]: !expanded,
											}))
										}
									>
										<ChevronDown
											className={cn(
												"size-4 transition-transform",
												expanded ? "rotate-180" : "",
											)}
										/>
										{t(
											expanded
												? "characterCreation.collapseDetails"
												: "characterCreation.expandDetails",
										)}
									</Button>
								</div>
								{expanded ? (
									<>
										<div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
											<TextField
												label={t("characterCreation.weaponRange", {
													index: index + 1,
												})}
												value={weapon.range}
												onChange={(range) => updateWeapon(index, { range })}
											/>
											<TextField
												label={t("characterCreation.weaponAttacks", {
													index: index + 1,
												})}
												value={weapon.attacks}
												maxLength={40}
												onChange={(attacks) => updateWeapon(index, { attacks })}
											/>
											<NumericField
												label={t("characterCreation.weaponAmmo", {
													index: index + 1,
												})}
												value={weapon.ammo}
												min={0}
												max={999}
												nullable
												showValidation={showValidation}
												onErrorChange={(message) =>
													reportError(`weapon-${index}-ammo`, message)
												}
												onChange={(ammo) => updateWeapon(index, { ammo })}
											/>
											<NumericField
												label={t("characterCreation.weaponMalfunction", {
													index: index + 1,
												})}
												value={weapon.malfunction}
												min={0}
												max={999}
												nullable
												showValidation={showValidation}
												onErrorChange={(message) =>
													reportError(`weapon-${index}-malfunction`, message)
												}
												onChange={(malfunction) =>
													updateWeapon(index, { malfunction })
												}
											/>
										</div>
										<div className="mt-3 flex flex-wrap gap-5">
											<label
												htmlFor={`weapon-${index}-impale`}
												className="flex items-center gap-2 text-label-medium text-foreground-secondary"
											>
												<Checkbox
													id={`weapon-${index}-impale`}
													aria-label={t("characterCreation.weaponImpale", {
														index: index + 1,
													})}
													checked={weapon.impale}
													onCheckedChange={(checked) =>
														updateWeapon(index, { impale: checked === true })
													}
												/>
												{t("characterCreation.weaponImpale", {
													index: index + 1,
												})}
											</label>
											<label
												htmlFor={`weapon-${index}-db`}
												className="flex items-center gap-2 text-label-medium text-foreground-secondary"
											>
												<Checkbox
													id={`weapon-${index}-db`}
													aria-label={t("characterCreation.weaponDamageBonus", {
														index: index + 1,
													})}
													checked={weapon.applyDamageBonus}
													onCheckedChange={(checked) =>
														updateWeapon(index, {
															applyDamageBonus: checked === true,
														})
													}
												/>
												{t("characterCreation.weaponDamageBonus", {
													index: index + 1,
												})}
											</label>
										</div>
									</>
								) : null}
							</RecordCard>
						);
					})}
				</RecordGroup>

				<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Shield className="text-foreground-secondary size-4" />
							<h3 className="text-label-large-emph text-foreground">
								{t("characterCreation.armor")}
							</h3>
						</div>
						<Coc7eArmorPicker
							era={sheet.era}
							onPick={(armor) => onChange({ armor })}
						/>
					</div>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
						<TextField
							label={t("characterCreation.armorName")}
							value={sheet.armor.name}
							onChange={(name) => onChange({ armor: { ...sheet.armor, name } })}
						/>
						<NumericField
							label={t("characterCreation.armorValue")}
							value={sheet.armor.value}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) => reportError("armor-value", message)}
							onChange={(value) =>
								onChange({ armor: { ...sheet.armor, value: value ?? 0 } })
							}
						/>
						<TextField
							label={t("characterCreation.armorLocations")}
							value={sheet.armor.locations}
							maxLength={200}
							onChange={(locations) =>
								onChange({ armor: { ...sheet.armor, locations } })
							}
						/>
						<NumericField
							label={t("characterCreation.armorPenalty")}
							value={sheet.armor.penalty}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) => reportError("armor-penalty", message)}
							onChange={(penalty) =>
								onChange({ armor: { ...sheet.armor, penalty: penalty ?? 0 } })
							}
						/>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h3 className="text-title-medium-emph text-foreground">
								{t("characterCreation.gear")}
							</h3>
							<p className="text-body-small text-foreground-secondary">
								{t("characterCreation.wearSlotsHint")} ·{" "}
								{t("characterCreation.backpackHint")}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={sheet.gear.length >= 200}
							onClick={() =>
								onChange({
									gear: [
										...sheet.gear,
										{ name: t("characterCreation.newGear"), quantity: 1 },
									],
								})
							}
						>
							<Plus />
							{t("characterCreation.addGear")}
						</Button>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							value={quickGearName}
							maxLength={200}
							placeholder={t("characterCreation.gearQuickAddPlaceholder")}
							onInput={(event) => setQuickGearName(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									addQuickGear();
								}
							}}
						/>
						<Button
							type="button"
							variant="outline"
							className="shrink-0"
							disabled={quickGearName.trim() === "" || sheet.gear.length >= 200}
							onClick={addQuickGear}
						>
							<Plus className="size-4" />
							{t("characterCreation.gearQuickAdd")}
						</Button>
					</div>

					{wornGear.length > 0 ? (
						<div className="flex flex-col gap-2">
							<h4 className="font-mono text-label-large-emph text-foreground-secondary">
								{t("characterCreation.wearSlotsTitle")}
							</h4>
							<div className="grid gap-2.5 md:grid-cols-2">
								{wornGear.map(({ item, index }) => (
									<GearCard
										key={`${item.name}-${index}`}
										item={item}
										index={index}
										expanded={expandedGearIndex === index}
										onToggleExpand={() =>
											setExpandedGearIndex(
												expandedGearIndex === index ? null : index,
											)
										}
										showValidation={showValidation}
										reportError={reportError}
										onUpdate={(patch) => updateGear(index, patch)}
										onRemove={() =>
											onChange({
												gear: sheet.gear.filter(
													(_, itemIndex) => itemIndex !== index,
												),
											})
										}
										unregisteredWeapon={
											WEAPON_NAME_PATTERN.test(item.name) &&
											!sheet.weapons.some((w) => w.name === item.name)
										}
										onRegisterWeapon={() => registerGearAsWeapon(item.name)}
									/>
								))}
							</div>
						</div>
					) : null}

					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Backpack className="text-foreground-secondary size-4" />
							<h4 className="font-mono text-label-large-emph text-foreground-secondary">
								{t("characterCreation.backpackTitle")}
							</h4>
						</div>
						<div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
							{backpackGear.map(({ item, index }) => (
								<GearCard
									key={`${item.name}-${index}`}
									item={item}
									index={index}
									expanded={expandedGearIndex === index}
									onToggleExpand={() =>
										setExpandedGearIndex(
											expandedGearIndex === index ? null : index,
										)
									}
									showValidation={showValidation}
									reportError={reportError}
									onUpdate={(patch) => updateGear(index, patch)}
									onRemove={() =>
										onChange({
											gear: sheet.gear.filter(
												(_, itemIndex) => itemIndex !== index,
											),
										})
									}
									unregisteredWeapon={
										WEAPON_NAME_PATTERN.test(item.name) &&
										!sheet.weapons.some((w) => w.name === item.name)
									}
									onRegisterWeapon={() => registerGearAsWeapon(item.name)}
								/>
							))}
						</div>
					</div>
				</div>
			</SheetSection>

			<details className="rounded-2xl bg-md-surface-container-low p-5 md:p-6">
				<summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Sparkles className="text-foreground-secondary size-4" />
						<span className="font-sans text-title-large-emph text-foreground">
							{t("characterCreation.magicCollapsedTitle")}
						</span>
					</div>
					<span className="text-body-small text-foreground-secondary">
						{t("characterCreation.magicCollapsedHint", {
							spells: sheet.spells.length,
							tomes: sheet.mythosTomes.length,
							encounters: sheet.encounters.length,
						})}
					</span>
				</summary>
				<div className="mt-5 flex flex-col gap-6">
					<RecordGroup
						title={t("characterCreation.spells")}
						actionLabel={t("characterCreation.addSpell")}
						disabled={sheet.spells.length >= 100}
						extraAction={
							<Coc7eSpellPicker
								exclude={sheet.spells.map((spell) => spell.name)}
								onPick={(spell) =>
									onChange({
										spells: [
											...sheet.spells,
											{
												name: spell.name,
												mpCost: spell.mpCost,
												sanCost: spell.sanCost,
												castingTime: spell.castingTime,
												effect: spell.effect,
											},
										],
									})
								}
							/>
						}
						onAdd={() =>
							onChange({
								spells: [
									...sheet.spells,
									{
										name: t("characterCreation.newSpell"),
										mpCost: "",
										sanCost: "",
										castingTime: "",
										effect: "",
									},
								],
							})
						}
					>
						{sheet.spells.map((spell, index) => (
							<RecordCard
								key={`${spell.name}-${index}`}
								removeLabel={t("characterCreation.removeSpell", {
									index: index + 1,
								})}
								onRemove={() =>
									onChange({
										spells: sheet.spells.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
									<TextField
										label={t("characterCreation.spellName", {
											index: index + 1,
										})}
										value={spell.name}
										required
										maxLength={200}
										showValidation={showValidation}
										onChange={(name) => updateSpell(index, { name })}
									/>
									<TextField
										label={t("characterCreation.spellMp", { index: index + 1 })}
										value={spell.mpCost}
										onChange={(mpCost) => updateSpell(index, { mpCost })}
									/>
									<TextField
										label={t("characterCreation.spellSan", {
											index: index + 1,
										})}
										value={spell.sanCost}
										onChange={(sanCost) => updateSpell(index, { sanCost })}
									/>
									<TextField
										label={t("characterCreation.spellCastingTime", {
											index: index + 1,
										})}
										value={spell.castingTime}
										onChange={(castingTime) =>
											updateSpell(index, { castingTime })
										}
									/>
								</div>
								<TextField
									className="mt-3"
									label={t("characterCreation.spellEffect", {
										index: index + 1,
									})}
									value={spell.effect}
									multiline
									maxLength={4000}
									onChange={(effect) => updateSpell(index, { effect })}
								/>
							</RecordCard>
						))}
					</RecordGroup>

					<RecordGroup
						title={t("characterCreation.tomes")}
						actionLabel={t("characterCreation.addTome")}
						disabled={sheet.mythosTomes.length >= 100}
						onAdd={() =>
							onChange({
								mythosTomes: [
									...sheet.mythosTomes,
									{
										name: t("characterCreation.newTome"),
										sanLoss: "",
										mythosGain: 0,
										studyHours: 0,
										spells: "",
									},
								],
							})
						}
					>
						{sheet.mythosTomes.map((tome, index) => (
							<RecordCard
								key={`${tome.name}-${index}`}
								removeLabel={t("characterCreation.removeTome", {
									index: index + 1,
								})}
								onRemove={() =>
									onChange({
										mythosTomes: sheet.mythosTomes.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
									<TextField
										label={t("characterCreation.tomeName", {
											index: index + 1,
										})}
										value={tome.name}
										required
										maxLength={200}
										showValidation={showValidation}
										onChange={(name) => updateTome(index, { name })}
									/>
									<TextField
										label={t("characterCreation.tomeSan", { index: index + 1 })}
										value={tome.sanLoss}
										onChange={(sanLoss) => updateTome(index, { sanLoss })}
									/>
									<NumericField
										label={t("characterCreation.tomeMythos", {
											index: index + 1,
										})}
										value={tome.mythosGain}
										min={0}
										max={999}
										showValidation={showValidation}
										onErrorChange={(message) =>
											reportError(`tome-${index}-mythos`, message)
										}
										onChange={(mythosGain) =>
											updateTome(index, { mythosGain: mythosGain ?? 0 })
										}
									/>
									<NumericField
										label={t("characterCreation.tomeHours", {
											index: index + 1,
										})}
										value={tome.studyHours}
										min={0}
										max={1_000_000}
										integer={false}
										showValidation={showValidation}
										onErrorChange={(message) =>
											reportError(`tome-${index}-hours`, message)
										}
										onChange={(studyHours) =>
											updateTome(index, { studyHours: studyHours ?? 0 })
										}
									/>
								</div>
								<TextField
									className="mt-3"
									label={t("characterCreation.tomeSpells", {
										index: index + 1,
									})}
									value={tome.spells}
									multiline
									maxLength={4000}
									onChange={(spells) => updateTome(index, { spells })}
								/>
							</RecordCard>
						))}
					</RecordGroup>

					<RecordGroup
						title={t("characterCreation.encounters")}
						actionLabel={t("characterCreation.addEncounter")}
						disabled={sheet.encounters.length >= 100}
						onAdd={() =>
							onChange({
								encounters: [
									...sheet.encounters,
									{
										name: t("characterCreation.newEncounter"),
										sanLoss: "",
										mythosGain: 0,
										count: 1,
										notes: "",
									},
								],
							})
						}
					>
						{sheet.encounters.map((encounter, index) => (
							<RecordCard
								key={`${encounter.name}-${index}`}
								removeLabel={t("characterCreation.removeEncounter", {
									index: index + 1,
								})}
								onRemove={() =>
									onChange({
										encounters: sheet.encounters.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
									<TextField
										label={t("characterCreation.encounterName", {
											index: index + 1,
										})}
										value={encounter.name}
										required
										maxLength={200}
										showValidation={showValidation}
										onChange={(name) => updateEncounter(index, { name })}
									/>
									<TextField
										label={t("characterCreation.encounterSan", {
											index: index + 1,
										})}
										value={encounter.sanLoss}
										onChange={(sanLoss) => updateEncounter(index, { sanLoss })}
									/>
									<NumericField
										label={t("characterCreation.encounterMythos", {
											index: index + 1,
										})}
										value={encounter.mythosGain}
										min={0}
										max={999}
										showValidation={showValidation}
										onErrorChange={(message) =>
											reportError(`encounter-${index}-mythos`, message)
										}
										onChange={(mythosGain) =>
											updateEncounter(index, { mythosGain: mythosGain ?? 0 })
										}
									/>
									<NumericField
										label={t("characterCreation.encounterCount", {
											index: index + 1,
										})}
										value={encounter.count}
										min={0}
										max={9999}
										showValidation={showValidation}
										onErrorChange={(message) =>
											reportError(`encounter-${index}-count`, message)
										}
										onChange={(count) =>
											updateEncounter(index, { count: count ?? 1 })
										}
									/>
								</div>
								<TextField
									className="mt-3"
									label={t("characterCreation.encounterNotes", {
										index: index + 1,
									})}
									value={encounter.notes}
									multiline
									maxLength={4000}
									onChange={(notes) => updateEncounter(index, { notes })}
								/>
							</RecordCard>
						))}
					</RecordGroup>
				</div>
			</details>
		</div>
	);
}

function GearCard({
	item,
	index,
	expanded,
	onToggleExpand,
	showValidation,
	reportError,
	onUpdate,
	onRemove,
	unregisteredWeapon,
	onRegisterWeapon,
}: {
	item: Sheet["gear"][number];
	index: number;
	expanded: boolean;
	onToggleExpand: () => void;
	showValidation: boolean;
	reportError: (key: string, message: string | null) => void;
	onUpdate: (patch: Partial<Sheet["gear"][number]>) => void;
	onRemove: () => void;
	unregisteredWeapon: boolean;
	onRegisterWeapon: () => void;
}) {
	const slot = item.slot ?? "none";
	const status = item.status ?? "in_use";
	return (
		<div className="border-md-outline-variant/40 bg-md-surface-container flex min-w-0 flex-col gap-2 rounded-xl border p-3">
			<div className="flex items-start justify-between gap-2">
				<button
					type="button"
					onClick={onToggleExpand}
					className="min-w-0 flex-1 text-left"
				>
					<div className="flex flex-wrap items-center gap-1.5">
						{slot !== "none" ? (
							<Badge variant="soft" tone="default" size="sm">
								{t(`characterCreation.slot.${slot}`)}
							</Badge>
						) : null}
						<span className="truncate text-label-large-emph text-foreground">
							{item.name}
						</span>
					</div>
					{item.note ? (
						<p className="mt-1 line-clamp-2 text-body-small text-foreground-secondary">
							{item.note}
						</p>
					) : null}
				</button>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`${item.name} -1`}
						onClick={() =>
							onUpdate({ quantity: Math.max(0, item.quantity - 1) })
						}
					>
						<Minus className="size-3.5" />
					</Button>
					<span className="min-w-7 text-center font-mono text-label-medium tabular-nums">
						×{item.quantity}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`${item.name} +1`}
						onClick={() =>
							onUpdate({ quantity: Math.min(9999, item.quantity + 1) })
						}
					>
						<Plus className="size-3.5" />
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{slot !== "none" ? (
					<Badge
						variant="soft"
						tone={
							status === "lost"
								? "danger"
								: status === "lent"
									? "warning"
									: "accent"
						}
						size="sm"
					>
						{t(`characterCreation.gearStatus.${status}`)}
					</Badge>
				) : null}
				{item.linkedPossession ? (
					<Badge variant="soft" tone="default" size="sm">
						{t("characterCreation.gearLinkedPossession")}
					</Badge>
				) : null}
				{unregisteredWeapon ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-6 px-2 text-label-small text-warning"
						onClick={onRegisterWeapon}
					>
						<Swords className="size-3" />
						{t("characterCreation.gearRegisterWeapon")}
					</Button>
				) : null}
			</div>

			{expanded ? (
				<div className="mt-1 flex flex-col gap-2.5 border-t border-separator-secondary/40 pt-2.5">
					<TextField
						label={t("characterCreation.gearName", { index: index + 1 })}
						value={item.name}
						required
						maxLength={200}
						showValidation={showValidation}
						onChange={(name) => onUpdate({ name })}
					/>
					<div className="grid gap-2 sm:grid-cols-2">
						<NumericField
							label={t("characterCreation.gearQuantity", { index: index + 1 })}
							value={item.quantity}
							min={0}
							max={9999}
							showValidation={showValidation}
							onErrorChange={(message) => reportError(`gear-${index}`, message)}
							onChange={(quantity) => onUpdate({ quantity: quantity ?? 1 })}
						/>
						<SelectField
							label={t("characterCreation.gearSlot")}
							value={slot}
							options={SLOT_OPTIONS.map((opt) => ({
								value: opt.value,
								label: t(opt.labelKey),
							}))}
							onChange={(nextSlot) => onUpdate({ slot: nextSlot as GearSlot })}
						/>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<SelectField
							label={t("characterCreation.gearStatus")}
							value={status}
							options={STATUS_OPTIONS.map((opt) => ({
								value: opt.value,
								label: t(opt.labelKey),
							}))}
							onChange={(nextStatus) =>
								onUpdate({ status: nextStatus as GearStatus })
							}
						/>
						<label
							htmlFor={`gear-${index}-possession`}
							className="flex items-center gap-2 pt-5 text-label-medium text-foreground-secondary"
						>
							<Checkbox
								id={`gear-${index}-possession`}
								checked={Boolean(item.linkedPossession)}
								onCheckedChange={(checked) =>
									onUpdate({ linkedPossession: checked === true })
								}
							/>
							{t("characterCreation.gearLinkedPossession")}
						</label>
					</div>
					<TextField
						label={t("characterCreation.gearNote")}
						value={item.note ?? ""}
						maxLength={400}
						placeholder={t("characterCreation.gearNotePlaceholder")}
						onChange={(note) => onUpdate({ note })}
					/>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-danger"
							aria-label={t("characterCreation.removeGear", {
								index: index + 1,
							})}
							onClick={onRemove}
						>
							<Trash2 className="size-3.5" />
							{t("common.delete")}
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function MoneyField({
	label,
	value,
	onChange,
	showValidation,
	reportError,
}: {
	label: string;
	value: number;
	onChange: (value: number | null) => void;
	showValidation: boolean;
	reportError: (message: string | null) => void;
}) {
	return (
		<NumericField
			label={label}
			value={value}
			min={0}
			max={1_000_000_000_000_000}
			integer={false}
			showValidation={showValidation}
			onErrorChange={reportError}
			onChange={onChange}
		/>
	);
}

function RecordGroup({
	title,
	actionLabel,
	disabled,
	onAdd,
	extraAction,
	children,
}: {
	title: string;
	actionLabel: string;
	disabled: boolean;
	onAdd: () => void;
	extraAction?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-title-medium-emph text-foreground">{title}</h3>
				<div className="flex items-center gap-2">
					{extraAction}
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={onAdd}
					>
						<Plus />
						{actionLabel}
					</Button>
				</div>
			</div>
			{children}
		</div>
	);
}

function RecordCard({
	removeLabel,
	onRemove,
	children,
}: {
	removeLabel: string;
	onRemove: () => void;
	children: ReactNode;
}) {
	return (
		<div className="relative rounded-xl bg-md-surface-container p-4 pr-14">
			{children}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-3 right-3"
				aria-label={removeLabel}
				onClick={onRemove}
			>
				<Trash2 />
			</Button>
		</div>
	);
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(
		value,
	);
}
