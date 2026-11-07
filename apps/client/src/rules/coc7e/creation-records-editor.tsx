import { coc7e } from "@cogm/shared";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
	NumericField,
	SelectField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/i18n";

type Sheet = coc7e.Coc7eCharacterSheet;

type RecordsProps = {
	sheet: Sheet;
	onChange: (sheet: Sheet) => void;
	showValidation: boolean;
	reportError: (key: string, message: string | null) => void;
	skillOptions: ReadonlyArray<{ value: string; label: string }>;
};

export function Coc7eCreationRecordsEditor({
	sheet,
	onChange,
	showValidation,
	reportError,
	skillOptions,
}: RecordsProps) {
	function update(patch: Partial<Sheet>) {
		onChange({ ...sheet, ...patch });
	}

	function updateWeapon(
		index: number,
		patch: Partial<Sheet["weapons"][number]>,
	) {
		update({
			weapons: sheet.weapons.map((weapon, itemIndex) =>
				itemIndex === index ? { ...weapon, ...patch } : weapon,
			),
		});
	}

	function updateSpell(index: number, patch: Partial<Sheet["spells"][number]>) {
		update({
			spells: sheet.spells.map((spell, itemIndex) =>
				itemIndex === index ? { ...spell, ...patch } : spell,
			),
		});
	}

	function updateTome(
		index: number,
		patch: Partial<Sheet["mythosTomes"][number]>,
	) {
		update({
			mythosTomes: sheet.mythosTomes.map((tome, itemIndex) =>
				itemIndex === index ? { ...tome, ...patch } : tome,
			),
		});
	}

	function updateEncounter(
		index: number,
		patch: Partial<Sheet["encounters"][number]>,
	) {
		update({
			encounters: sheet.encounters.map((encounter, itemIndex) =>
				itemIndex === index ? { ...encounter, ...patch } : encounter,
			),
		});
	}

	const credit = coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0;
	const recommendation = coc7e.coc7eAssetRecommendation(sheet.era, credit);

	return (
		<>
			<SheetSection title={t("characterCreation.combat")}>
				<RecordGroup
					title={t("characterCreation.weapons")}
					actionLabel={t("characterCreation.addWeapon")}
					disabled={sheet.weapons.length >= 100}
					onAdd={() =>
						update({
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
					{sheet.weapons.map((weapon, index) => (
						<RecordCard
							key={`${weapon.name}-${index}`}
							removeLabel={t("characterCreation.removeWeapon", {
								index: index + 1,
							})}
							onRemove={() =>
								update({
									weapons: sheet.weapons.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
						>
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
								<label className="flex items-center gap-2 text-label-medium text-foreground-secondary">
									<Checkbox
										aria-label={t("characterCreation.weaponImpale", {
											index: index + 1,
										})}
										checked={weapon.impale}
										onCheckedChange={(checked) =>
											updateWeapon(index, { impale: checked === true })
										}
									/>
									{t("characterCreation.weaponImpale", { index: index + 1 })}
								</label>
								<label className="flex items-center gap-2 text-label-medium text-foreground-secondary">
									<Checkbox
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
						</RecordCard>
					))}
				</RecordGroup>

				<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
					<h3 className="text-label-large-emph text-foreground">
						{t("characterCreation.armor")}
					</h3>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
						<TextField
							label={t("characterCreation.armorName")}
							value={sheet.armor.name}
							onChange={(name) => update({ armor: { ...sheet.armor, name } })}
						/>
						<NumericField
							label={t("characterCreation.armorValue")}
							value={sheet.armor.value}
							min={0}
							max={99}
							showValidation={showValidation}
							onErrorChange={(message) => reportError("armor-value", message)}
							onChange={(value) =>
								update({ armor: { ...sheet.armor, value: value ?? 0 } })
							}
						/>
						<TextField
							label={t("characterCreation.armorLocations")}
							value={sheet.armor.locations}
							maxLength={200}
							onChange={(locations) =>
								update({ armor: { ...sheet.armor, locations } })
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
								update({ armor: { ...sheet.armor, penalty: penalty ?? 0 } })
							}
						/>
					</div>
				</div>

				<RecordGroup
					title={t("characterCreation.gear")}
					actionLabel={t("characterCreation.addGear")}
					disabled={sheet.gear.length >= 200}
					onAdd={() =>
						update({
							gear: [
								...sheet.gear,
								{ name: t("characterCreation.newGear"), quantity: 1 },
							],
						})
					}
				>
					{sheet.gear.map((item, index) => (
						<div
							key={`${item.name}-${index}`}
							className="grid items-end gap-3 rounded-xl bg-md-surface-container p-4 md:grid-cols-[1fr_10rem_auto]"
						>
							<TextField
								label={t("characterCreation.gearName", { index: index + 1 })}
								value={item.name}
								required
								maxLength={200}
								showValidation={showValidation}
								onChange={(name) =>
									update({
										gear: sheet.gear.map((entry, itemIndex) =>
											itemIndex === index ? { ...entry, name } : entry,
										),
									})
								}
							/>
							<NumericField
								label={t("characterCreation.gearQuantity", {
									index: index + 1,
								})}
								value={item.quantity}
								min={0}
								max={9999}
								showValidation={showValidation}
								onErrorChange={(message) =>
									reportError(`gear-${index}`, message)
								}
								onChange={(quantity) =>
									update({
										gear: sheet.gear.map((entry, itemIndex) =>
											itemIndex === index
												? { ...entry, quantity: quantity ?? 1 }
												: entry,
										),
									})
								}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={t("characterCreation.removeGear", {
									index: index + 1,
								})}
								onClick={() =>
									update({
										gear: sheet.gear.filter(
											(_, itemIndex) => itemIndex !== index,
										),
									})
								}
							>
								<Trash2 />
							</Button>
						</div>
					))}
				</RecordGroup>
			</SheetSection>

			<SheetSection title={t("characterCreation.assets")}>
				<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-body-medium text-foreground-secondary">
						{t("characterCreation.assetRecommendation", {
							lifestyle: recommendation.lifestyle,
							cash: formatNumber(recommendation.cash),
							otherAssets: formatNumber(recommendation.otherAssets),
							spendingLevel: formatNumber(recommendation.spendingLevel),
						})}
					</p>
					<Button
						type="button"
						variant="outline"
						className="shrink-0"
						onClick={() =>
							update({
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
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
					<TextField
						label={t("characterCreation.currency")}
						value={sheet.assets.currency}
						required
						maxLength={16}
						showValidation={showValidation}
						onChange={(currency) =>
							update({ assets: { ...sheet.assets, currency } })
						}
					/>
					<MoneyField
						label={t("characterCreation.spendingLevel")}
						value={sheet.assets.spendingLevel}
						showValidation={showValidation}
						reportError={(message) => reportError("spending", message)}
						onChange={(spendingLevel) =>
							update({
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
							update({ assets: { ...sheet.assets, cash: cash ?? 0 } })
						}
					/>
					<MoneyField
						label={t("characterCreation.otherAssets")}
						value={sheet.assets.otherAssets}
						showValidation={showValidation}
						reportError={(message) => reportError("other-assets", message)}
						onChange={(otherAssets) =>
							update({
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
						update({
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
								update({
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
										update({
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
										update({
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
										update({
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

			<SheetSection
				title={t("characterCreation.magic")}
				description={t("characterCreation.magicHint")}
			>
				<RecordGroup
					title={t("characterCreation.spells")}
					actionLabel={t("characterCreation.addSpell")}
					disabled={sheet.spells.length >= 100}
					onAdd={() =>
						update({
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
								update({
									spells: sheet.spells.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
						>
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
								<TextField
									label={t("characterCreation.spellName", { index: index + 1 })}
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
									label={t("characterCreation.spellSan", { index: index + 1 })}
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
								label={t("characterCreation.spellEffect", { index: index + 1 })}
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
						update({
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
								update({
									mythosTomes: sheet.mythosTomes.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
						>
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
								<TextField
									label={t("characterCreation.tomeName", { index: index + 1 })}
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
									label={t("characterCreation.tomeHours", { index: index + 1 })}
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
								label={t("characterCreation.tomeSpells", { index: index + 1 })}
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
						update({
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
								update({
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
			</SheetSection>
		</>
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
	children,
}: {
	title: string;
	actionLabel: string;
	disabled: boolean;
	onAdd: () => void;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-title-medium-emph text-foreground">{title}</h3>
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
