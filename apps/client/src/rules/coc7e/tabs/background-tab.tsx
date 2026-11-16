import type { CharacterSheetContextResponse } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import { AlertTriangle, Star, Users } from "lucide-react";
import {
	SelectField,
	SheetSection,
	TextField,
} from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type Sheet = coc7e.Coc7eCharacterSheet;
type BgKey = coc7e.Coc7eBackgroundFieldKey;

export function Coc7eBackgroundTab({
	sheet,
	onChange,
	background,
	onBackgroundChange,
	sheetContext,
}: {
	sheet: Sheet;
	onChange: (patch: Partial<Sheet>) => void;
	background?: string;
	onBackgroundChange?: (value: string) => void;
	sheetContext?: CharacterSheetContextResponse | null;
}) {
	const bg = sheet.backgroundProfile;
	const companions = sheetContext?.companions ?? [];
	const selectedCompanion = companions.find(
		(item) => item.characterId === bg.partnerCharacterId,
	);

	function updateBg(patch: Partial<Sheet["backgroundProfile"]>) {
		const nextBg = { ...bg, ...patch };
		const nextProfile =
			patch.appearanceSummary !== undefined
				? { ...sheet.profile, appearance: patch.appearanceSummary }
				: sheet.profile;
		onChange({ backgroundProfile: nextBg, profile: nextProfile });
		if (onBackgroundChange) {
			onBackgroundChange(
				coc7e.serializeCoc7eBackground(nextProfile, nextBg, background ?? ""),
			);
		}
	}

	function fieldValue(key: BgKey): string {
		if (key === "appearanceSummary") {
			return bg.appearanceSummary || sheet.profile.appearance;
		}
		return bg[key];
	}

	const synthesized = coc7e.serializeCoc7eBackground(
		sheet.profile,
		bg,
		background ?? "",
	);

	return (
		<SheetSection
			title={t("characterCreation.backgroundTitle")}
			description={t("characterCreation.backgroundPageHint")}
		>
			{bg.keyConnection === null ? (
				<div
					role="status"
					className="bg-warning-soft text-warning-soft-foreground flex items-start gap-2.5 rounded-xl px-4 py-3 text-body-medium"
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>{t("characterCreation.keyConnectionMissingBanner")}</span>
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-2">
				{coc7e.COC7E_BACKGROUND_FIELD_META.map((field) => {
					const isKey = bg.keyConnection === field.key;
					const label = t(`characterCreation.bgField.${field.key}`);
					const hint = t(`characterCreation.bgField.${field.key}Hint`);
					return (
						<div
							key={field.key}
							className={cn(
								"flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors",
								isKey
									? "border-dossier-gold bg-md-surface-container-high"
									: "border-md-outline-variant/40 bg-md-surface-container",
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-0.5">
									<Label
										htmlFor={`bg-${field.key}`}
										className="font-serif text-title-medium-emph text-foreground"
									>
										{label}
									</Label>
									<span className="text-body-small text-foreground-tertiary">
										{hint}
									</span>
								</div>
								<Button
									type="button"
									variant={isKey ? "primary" : "outline"}
									size="sm"
									aria-pressed={isKey}
									className="shrink-0"
									onClick={() =>
										updateBg({ keyConnection: isKey ? null : field.key })
									}
								>
									<Star className="size-3.5" />
									{isKey
										? t("characterCreation.isKeyConnection")
										: t("characterCreation.setKeyConnection")}
								</Button>
							</div>
							<Textarea
								id={`bg-${field.key}`}
								aria-label={label}
								value={fieldValue(field.key)}
								rows={3}
								maxLength={4000}
								onInput={(event) =>
									updateBg({ [field.key]: event.currentTarget.value })
								}
							/>
						</div>
					);
				})}
			</div>

			<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-3 rounded-2xl border p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Users className="text-foreground-secondary size-4" />
						<h3 className="font-serif text-title-medium-emph text-foreground">
							{t("characterCreation.partnerTitle")}
						</h3>
					</div>
					{selectedCompanion ? (
						<Badge
							variant="soft"
							tone={selectedCompanion.linkedToMe ? "accent" : "default"}
							size="sm"
						>
							{selectedCompanion.linkedToMe
								? t("characterCreation.partnerMutualBadge", {
										session: selectedCompanion.sessionName,
									})
								: t("characterCreation.partnerSessionBadge", {
										session: selectedCompanion.sessionName,
									})}
						</Badge>
					) : null}
				</div>
				<p className="text-body-small text-foreground-secondary">
					{t("characterCreation.partnerHint")}
				</p>
				<div className="grid gap-3 md:grid-cols-2">
					{companions.length > 0 ? (
						<SelectField
							label={t("characterCreation.partnerFromSession")}
							value={bg.partnerCharacterId ?? "__manual__"}
							options={[
								{
									value: "__manual__",
									label: t("characterCreation.partnerCustomOption"),
								},
								...companions.map((item) => ({
									value: item.characterId,
									label: `${item.name}（${item.sessionName}）`,
								})),
							]}
							onChange={(value) => {
								if (value === "__manual__") {
									updateBg({ partnerCharacterId: null });
									return;
								}
								const picked = companions.find(
									(item) => item.characterId === value,
								);
								updateBg({
									partnerCharacterId: value,
									partnerName: picked?.name ?? bg.partnerName,
								});
							}}
						/>
					) : null}
					<TextField
						label={t("characterCreation.partnerManualName")}
						value={bg.partnerName}
						maxLength={100}
						placeholder={t("characterCreation.partnerManualPlaceholder")}
						onChange={(partnerName) => updateBg({ partnerName })}
					/>
				</div>
			</div>

			<TextField
				label={t("characterCreation.keyConnectionStory")}
				value={bg.keyConnectionStory}
				multiline
				maxLength={4000}
				placeholder={t("characterCreation.keyConnectionStoryHint")}
				onChange={(keyConnectionStory) => updateBg({ keyConnectionStory })}
			/>

			{onBackgroundChange ? (
				<details className="bg-md-surface-container rounded-xl px-4 py-3">
					<summary className="text-label-large-emph text-foreground cursor-pointer">
						{t("characterCreation.legacyBackgroundTitle")}
					</summary>
					<div className="mt-3 flex flex-col gap-2">
						<Textarea
							aria-label={t("characterCreation.background")}
							value={background ?? synthesized}
							rows={4}
							maxLength={4000}
							onInput={(event) => onBackgroundChange(event.currentTarget.value)}
						/>
					</div>
				</details>
			) : null}
		</SheetSection>
	);
}
