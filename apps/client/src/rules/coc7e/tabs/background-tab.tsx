import type { CharacterSheetContextResponse } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import { AlertTriangle, Plus, Star, Trash2, Users } from "lucide-react";
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
import { randomUuid } from "@/lib/uuid";

type Sheet = coc7e.Coc7eCharacterSheet;
type BgKey = coc7e.Coc7eBackgroundFieldKey;
type Partner = coc7e.Coc7eBackgroundPartner;

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
	const partners: Partner[] =
		bg.partners.length > 0
			? bg.partners
			: bg.partnerName.trim()
				? [
						{
							id: "legacy",
							characterId: bg.partnerCharacterId,
							name: bg.partnerName,
							note: "",
						},
					]
				: [];

	function updateBg(patch: Partial<Sheet["backgroundProfile"]>) {
		const nextBg = { ...bg, ...patch };
		const nextProfile =
			patch.appearanceSummary !== undefined
				? { ...sheet.profile, appearance: patch.appearanceSummary }
				: sheet.profile;
		onChange({ backgroundProfile: nextBg, profile: nextProfile });
	}

	function updatePartners(next: Partner[]) {
		const first = next[0];
		updateBg({
			partners: next,
			partnerCharacterId: first?.characterId ?? null,
			partnerName: first?.name ?? "",
		});
	}

	function addPartner() {
		if (partners.length >= 20) {
			return;
		}
		updatePartners([
			...partners,
			{
				id: randomUuid(),
				characterId: null,
				name: "",
				note: "",
			},
		]);
	}

	function updatePartner(index: number, patch: Partial<Partner>) {
		updatePartners(
			partners.map((partner, itemIndex) =>
				itemIndex === index ? { ...partner, ...patch } : partner,
			),
		);
	}

	function removePartner(index: number) {
		updatePartners(partners.filter((_, itemIndex) => itemIndex !== index));
	}

	function fieldValue(key: BgKey): string {
		if (key === "appearanceSummary") {
			return bg.appearanceSummary || sheet.profile.appearance;
		}
		return bg[key];
	}

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
					{companions
						.filter((item) =>
							partners.some(
								(partner) => partner.characterId === item.characterId,
							),
						)
						.map((item) => (
							<Badge
								key={item.characterId}
								variant="soft"
								tone={item.linkedToMe ? "accent" : "default"}
								size="sm"
							>
								{item.linkedToMe
									? t("characterCreation.partnerMutualBadge", {
											session: item.sessionName,
										})
									: t("characterCreation.partnerSessionBadge", {
											session: item.sessionName,
										})}
							</Badge>
						))}
				</div>
				<p className="text-body-small text-foreground-secondary">
					{t("characterCreation.partnerHint")}
				</p>
				<div className="flex flex-col gap-3">
					{partners.length === 0 ? (
						<p className="border-md-outline-variant/40 bg-md-surface-container rounded-xl border border-dashed px-3.5 py-2.5 text-body-small text-foreground-tertiary">
							{t("characterCreation.partnerEmpty")}
						</p>
					) : null}
					{partners.map((partner, index) => (
						<div
							key={partner.id}
							className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-3 rounded-xl border p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-serif text-title-small-emph text-foreground">
									{t("characterCreation.partnerCardTitle", {
										index: index + 1,
									})}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("characterCreation.partnerRemove", {
										index: index + 1,
									})}
									onClick={() => removePartner(index)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								{companions.length > 0 ? (
									<SelectField
										label={t("characterCreation.partnerFromSession")}
										value={partner.characterId ?? "__manual__"}
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
												updatePartner(index, { characterId: null });
												return;
											}
											const picked = companions.find(
												(item) => item.characterId === value,
											);
											updatePartner(index, {
												characterId: value,
												name: picked?.name ?? partner.name,
											});
										}}
									/>
								) : null}
								<TextField
									label={t("characterCreation.partnerManualName")}
									value={partner.name}
									maxLength={100}
									placeholder={t("characterCreation.partnerManualPlaceholder")}
									onChange={(name) => updatePartner(index, { name })}
								/>
							</div>
							<TextField
								label={t("characterCreation.partnerNote")}
								value={partner.note}
								maxLength={200}
								placeholder={t("characterCreation.partnerNotePlaceholder")}
								onChange={(note) => updatePartner(index, { note })}
							/>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="self-start"
						disabled={partners.length >= 20}
						onClick={addPartner}
					>
						<Plus className="size-4" />
						{t("characterCreation.partnerAdd")}
					</Button>
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
				<TextField
					label={t("characterProfile.detailedBackground")}
					value={background ?? ""}
					multiline
					maxLength={4000}
					placeholder={t("characterProfile.detailedBackgroundHint")}
					onChange={onBackgroundChange}
				/>
			) : null}
		</SheetSection>
	);
}
