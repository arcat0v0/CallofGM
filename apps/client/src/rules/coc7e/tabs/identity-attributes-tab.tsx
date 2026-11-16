import { coc7e } from "@cogm/shared";
import { Dices, ImagePlus, Trash2, UserRound } from "lucide-react";
import { type ReactNode, useRef } from "react";
import {
	NumericField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";

type Sheet = coc7e.Coc7eCharacterSheet;
type AttributeKey = coc7e.Coc7eAttributeKey;

const ATTRIBUTE_KEYS: AttributeKey[] = [
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

export function Coc7eIdentityAttributesTab({
	sheet,
	onChange,
	onChangeEra,
	showValidation,
	reportError,
	characterName,
	onCharacterNameChange,
	identityHeaderSlot,
	portraitPreviewUrl,
	portraitPending,
	onPickPortraitFile,
	onClearPendingPortrait,
	onManageExpressions,
}: {
	sheet: Sheet;
	onChange: (patch: Partial<Sheet>) => void;
	onChangeEra: (era: Sheet["era"]) => void;
	showValidation: boolean;
	reportError: (key: string, message: string | null) => void;
	characterName?: string;
	onCharacterNameChange?: (name: string) => void;
	identityHeaderSlot?: ReactNode;
	portraitPreviewUrl?: string | null;
	portraitPending?: boolean;
	onPickPortraitFile?: (file: File) => void;
	onClearPendingPortrait?: () => void;
	onManageExpressions?: () => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const derived = coc7e.deriveCoc7eSheetStats(sheet);
	const ageGuidance = coc7e.coc7eAgeCreationGuidance(sheet.age);

	function updateProfile(patch: Partial<Sheet["profile"]>) {
		const nextProfile = { ...sheet.profile, ...patch };
		const nextBg =
			patch.appearance !== undefined
				? { ...sheet.backgroundProfile, appearanceSummary: patch.appearance }
				: sheet.backgroundProfile;
		onChange({ profile: nextProfile, backgroundProfile: nextBg });
	}

	return (
		<div className="flex flex-col gap-6">
			<SheetSection
				title={t("characterCreation.tabIdentity")}
				description={t("characterCreation.identitySectionHint")}
			>
				<div className="grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
					<div className="flex flex-col items-center gap-2.5">
						<div className="border-md-outline-variant/50 bg-md-surface-container relative size-36 overflow-hidden rounded-t-full rounded-b-xl border">
							{portraitPreviewUrl ? (
								<img
									src={portraitPreviewUrl}
									alt={characterName || t("characterCreation.portrait")}
									className="size-full object-cover"
								/>
							) : (
								<div className="text-foreground-tertiary flex size-full flex-col items-center justify-center gap-1.5">
									<UserRound className="size-8" />
									<span className="font-mono text-label-small">
										{t("characterCreation.portrait")}
									</span>
								</div>
							)}
						</div>
						{onPickPortraitFile ? (
							<>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/png,image/jpeg,image/webp"
									className="hidden"
									onChange={(event) => {
										const file = event.currentTarget.files?.[0];
										event.currentTarget.value = "";
										if (file) {
											onPickPortraitFile(file);
										}
									}}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full"
									onClick={() => fileInputRef.current?.click()}
								>
									<ImagePlus className="size-4" />
									{portraitPreviewUrl
										? t("characterCreation.portraitChange")
										: t("characterCreation.portraitUpload")}
								</Button>
							</>
						) : null}
						{portraitPending && onClearPendingPortrait ? (
							<div className="flex flex-col items-center gap-1 text-center">
								<Badge variant="soft" tone="accent" size="sm">
									{t("characterCreation.portraitPendingHint")}
								</Badge>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={onClearPendingPortrait}
								>
									<Trash2 className="size-3.5" />
									{t("characterCreation.portraitRemove")}
								</Button>
							</div>
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

					<div className="flex min-w-0 flex-col gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
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
						</div>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="flex flex-col gap-1.5 sm:col-span-2">
								<Label>{t("characterCreation.era")}</Label>
								<SegmentedControl
									aria-label={t("characterCreation.era")}
									value={sheet.era}
									options={[
										{ value: "1920s", label: t("characterCreation.era1920s") },
										{
											value: "modern",
											label: t("characterCreation.eraModern"),
										},
									]}
									onValueChange={onChangeEra}
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
								onChange={(age) => onChange({ age })}
							/>
							<TextField
								label={t("characterCreation.gender")}
								value={sheet.profile.gender}
								maxLength={40}
								onChange={(gender) => updateProfile({ gender })}
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<TextField
								label={t("characterCreation.residence")}
								value={sheet.profile.residence}
								maxLength={120}
								onChange={(residence) => updateProfile({ residence })}
							/>
							<TextField
								label={t("characterCreation.birthplace")}
								value={sheet.profile.birthplace}
								maxLength={120}
								onChange={(birthplace) => updateProfile({ birthplace })}
							/>
						</div>
						<TextField
							label={t("characterCreation.appearance")}
							value={sheet.profile.appearance}
							multiline
							maxLength={1000}
							placeholder={t("characterCreation.appearancePlaceholder")}
							onChange={(appearance) => updateProfile({ appearance })}
						/>
						<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex min-w-0 flex-col gap-0.5">
								<Label
									htmlFor="storied-investigator-toggle"
									className="text-label-large-emph text-foreground cursor-pointer"
								>
									{t("characterCreation.storiedInvestigator")}
								</Label>
								<span className="text-body-small text-foreground-secondary">
									{t("characterCreation.storiedInvestigatorHint")}
								</span>
							</div>
							<div className="flex shrink-0 items-center gap-3">
								{sheet.profile.storiedInvestigator ? (
									<NumericField
										label={t("characterCreation.experienceBonusPoints")}
										hideLabel
										className="w-28"
										value={sheet.profile.experienceBonusPoints}
										min={0}
										max={500}
										showValidation={showValidation}
										onErrorChange={(message) =>
											reportError("experienceBonusPoints", message)
										}
										onChange={(value) =>
											updateProfile({ experienceBonusPoints: value ?? 100 })
										}
									/>
								) : null}
								<Switch
									id="storied-investigator-toggle"
									aria-label={t("characterCreation.storiedInvestigator")}
									checked={sheet.profile.storiedInvestigator}
									onCheckedChange={(checked) =>
										updateProfile({ storiedInvestigator: checked })
									}
								/>
							</div>
						</div>
					</div>
				</div>
			</SheetSection>

			<SheetSection
				id="attributes"
				title={t("characterCreation.attributes")}
				description={t("characterCreation.rollFormulaHint")}
				actions={
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							onChange({ attributes: coc7e.rollAllCoc7eAttributes() })
						}
					>
						<Dices className="size-4" />
						{t("characterCreation.rollAllAttributes")}
					</Button>
				}
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{ATTRIBUTE_KEYS.map((key) => {
						const pair = coc7e.COC7E_ATTRIBUTE_LABELS[key] ?? {
							label: key,
							abbr: key.toUpperCase(),
						};
						const value = sheet.attributes[key];
						return (
							<div
								key={key}
								className="border-md-outline-variant/30 bg-md-surface-container flex flex-col gap-2 rounded-xl border p-3.5"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
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
												onChange({
													attributes: {
														...sheet.attributes,
														[key]: next ?? value,
													},
												})
											}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="mt-6 shrink-0"
										aria-label={t("characterCreation.rollSingleAttribute", {
											name: pair.label,
										})}
										onClick={() =>
											onChange({
												attributes: {
													...sheet.attributes,
													[key]: coc7e.rollCoc7eAttribute(key),
												},
											})
										}
									>
										<Dices className="size-4" />
									</Button>
								</div>
								<p className="font-mono text-label-small text-foreground-secondary tabular-nums">
									{t("characterCreation.halfFifth", {
										half: Math.floor(value / 2),
										fifth: Math.floor(value / 5),
									})}
								</p>
							</div>
						);
					})}
				</div>

				{ageGuidance ? (
					<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-body-medium text-foreground-secondary">
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
						onChange={(value) => onChange({ movementModifier: value ?? 0 })}
					/>
				</div>

				<section
					aria-label={t("characterCreation.derived")}
					className="border-md-outline-variant/40 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-md-surface-container-high sm:grid-cols-4 lg:grid-cols-8"
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
							<span className="font-mono text-title-medium-emph text-foreground tabular-nums">
								{value}
							</span>
						</div>
					))}
				</section>
			</SheetSection>
		</div>
	);
}
