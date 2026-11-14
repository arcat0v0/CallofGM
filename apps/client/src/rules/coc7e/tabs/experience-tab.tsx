import {
	type CharacterSheetContextResponse,
	type coc7e,
	SessionPhase,
	SessionPhaseLabel,
} from "@cogm/shared";
import { BookOpen, Link2, PenLine, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import { SheetSection, TextField } from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { formatStamp } from "@/lib/format";

type Sheet = coc7e.Coc7eCharacterSheet;
type Experience = coc7e.Coc7eExperienceEntry;

export function Coc7eExperienceTab({
	sheet,
	onChange,
	sheetContext,
}: {
	sheet: Sheet;
	onChange: (patch: Partial<Sheet>) => void;
	sheetContext?: CharacterSheetContextResponse | null;
}) {
	const [pickerMode, setPickerMode] = useState<"none" | "records" | "sessions">(
		"none",
	);
	const phaseRecords = sheetContext?.phaseRecords ?? [];
	const growthRecords = sheetContext?.growthRecords ?? [];

	const recordCandidates: Array<{
		key: string;
		refKind: "spell" | "tome" | "encounter";
		refId: string;
		title: string;
		refLabel: string;
		changes: string[];
		summary: string;
	}> = [
		...sheet.encounters.map((enc, index) => ({
			key: `enc-${index}-${enc.name}`,
			refKind: "encounter" as const,
			refId: String(index),
			title: enc.name,
			refLabel: enc.name,
			changes: [
				enc.sanLoss ? `SAN -${enc.sanLoss}` : "",
				enc.mythosGain > 0 ? `克苏鲁神话 +${enc.mythosGain}` : "",
			].filter(Boolean),
			summary: enc.notes,
		})),
		...sheet.mythosTomes.map((tome, index) => ({
			key: `tome-${index}-${tome.name}`,
			refKind: "tome" as const,
			refId: String(index),
			title: tome.name,
			refLabel: tome.name,
			changes: [
				tome.sanLoss ? `SAN -${tome.sanLoss}` : "",
				tome.mythosGain > 0 ? `克苏鲁神话 +${tome.mythosGain}` : "",
			].filter(Boolean),
			summary: tome.spells,
		})),
		...sheet.spells.map((spell, index) => ({
			key: `spell-${index}-${spell.name}`,
			refKind: "spell" as const,
			refId: String(index),
			title: spell.name,
			refLabel: spell.name,
			changes: [
				spell.mpCost ? `MP ${spell.mpCost}` : "",
				spell.sanCost ? `SAN ${spell.sanCost}` : "",
			].filter(Boolean),
			summary: spell.effect,
		})),
	];

	function addExperience(entry: Experience) {
		if (sheet.experiences.length >= 200) {
			return;
		}
		onChange({ experiences: [entry, ...sheet.experiences] });
	}

	function updateExperience(index: number, patch: Partial<Experience>) {
		onChange({
			experiences: sheet.experiences.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...patch } : item,
			),
		});
	}

	function isClaimed(refKind: string, refId: string): boolean {
		return sheet.experiences.some(
			(item) => item.refKind === refKind && item.refId === refId,
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<SheetSection
				title={t("characterCreation.experienceTitle")}
				description={t("characterCreation.experienceHint")}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								setPickerMode((current) =>
									current === "records" ? "none" : "records",
								)
							}
						>
							<Link2 className="size-4" />
							{t("characterCreation.experienceFromRecords")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								setPickerMode((current) =>
									current === "sessions" ? "none" : "sessions",
								)
							}
						>
							<ScrollText className="size-4" />
							{t("characterCreation.experienceFromSession")}
						</Button>
						<Button
							type="button"
							variant="primary"
							size="sm"
							onClick={() =>
								addExperience({
									id: crypto.randomUUID(),
									title: t("characterCreation.experienceSourceManual"),
									sourceType: "manual",
									refKind: null,
									refId: null,
									refLabel: "",
									summary: "",
									changes: [],
									occurredLabel: "",
								})
							}
						>
							<PenLine className="size-4" />
							{t("characterCreation.experienceAddManual")}
						</Button>
					</div>
				}
			>
				{pickerMode === "records" ? (
					<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-2.5 rounded-xl border p-4">
						{recordCandidates.length === 0 ? (
							<p className="text-body-small text-foreground-secondary">
								{t("characterCreation.experienceNoRecords")}
							</p>
						) : (
							recordCandidates.map((cand) => {
								const claimed = isClaimed(cand.refKind, cand.refId);
								return (
									<div
										key={cand.key}
										className="bg-md-surface-container-high flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
									>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="truncate text-label-large-emph text-foreground">
												{cand.title}
											</span>
											{cand.changes.length > 0 ? (
												<span className="font-mono text-label-small text-foreground-secondary">
													{cand.changes.join(" · ")}
												</span>
											) : null}
										</div>
										<Button
											type="button"
											variant={claimed ? "ghost" : "outline"}
											size="sm"
											disabled={claimed}
											onClick={() =>
												addExperience({
													id: crypto.randomUUID(),
													title: cand.title,
													sourceType: "record",
													refKind: cand.refKind,
													refId: cand.refId,
													refLabel: cand.refLabel,
													summary: cand.summary,
													changes: cand.changes,
													occurredLabel: "",
												})
											}
										>
											{t(
												claimed
													? "characterCreation.experienceClaimed"
													: "characterCreation.experienceClaim",
											)}
										</Button>
									</div>
								);
							})
						)}
					</div>
				) : null}

				{pickerMode === "sessions" ? (
					<div className="border-md-outline-variant/40 bg-md-surface-container flex flex-col gap-2.5 rounded-xl border p-4">
						{phaseRecords.length === 0 ? (
							<p className="text-body-small text-foreground-secondary">
								{t("characterCreation.experienceNoSessionPhases")}
							</p>
						) : (
							phaseRecords.map((record) => {
								const refId = `${record.sessionId}:${record.eventId}`;
								const claimed = isClaimed("phase", refId);
								const parsedPhase = SessionPhase.safeParse(record.phase);
								const phaseLabel = parsedPhase.success
									? SessionPhaseLabel[parsedPhase.data]
									: record.phase;
								const label = `${record.sessionName} · ${phaseLabel}`;
								return (
									<div
										key={refId}
										className="bg-md-surface-container-high flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
									>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="truncate text-label-large-emph text-foreground">
												{label}
											</span>
											<span className="font-mono text-label-small text-foreground-secondary">
												{formatStamp(record.occurredAt)}
											</span>
										</div>
										<Button
											type="button"
											variant={claimed ? "ghost" : "outline"}
											size="sm"
											disabled={claimed}
											onClick={() =>
												addExperience({
													id: crypto.randomUUID(),
													title: record.sessionName || label,
													sourceType: "session_phase",
													refKind: "phase",
													refId,
													refLabel: label,
													summary: "",
													changes: [],
													occurredLabel: formatStamp(record.occurredAt),
												})
											}
										>
											{t(
												claimed
													? "characterCreation.experienceClaimed"
													: "characterCreation.experienceClaim",
											)}
										</Button>
									</div>
								);
							})
						)}
					</div>
				) : null}

				{sheet.experiences.length === 0 ? (
					<p className="rounded-xl bg-md-surface-container px-4 py-6 text-center text-body-medium text-foreground-secondary">
						{t("characterCreation.experienceEmpty")}
					</p>
				) : (
					<div className="border-md-outline-variant/50 relative flex flex-col gap-4 border-s-2 ps-5">
						{sheet.experiences.map((entry, index) => (
							<div
								key={entry.id}
								className="border-md-outline-variant/40 bg-md-surface-container relative flex flex-col gap-3 rounded-2xl border p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="soft" tone="accent" size="sm">
											{t(
												entry.sourceType === "record"
													? "characterCreation.experienceSourceRecord"
													: entry.sourceType === "session_phase"
														? "characterCreation.experienceSourcePhase"
														: "characterCreation.experienceSourceManual",
											)}
										</Badge>
										{entry.refLabel ? (
											<Badge variant="soft" tone="default" size="sm">
												{entry.refLabel}
											</Badge>
										) : null}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t("common.delete")}
										onClick={() =>
											onChange({
												experiences: sheet.experiences.filter(
													(_, itemIndex) => itemIndex !== index,
												),
											})
										}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									<TextField
										label={t("characterCreation.experienceEntryTitle")}
										value={entry.title}
										required
										maxLength={200}
										onChange={(title) => updateExperience(index, { title })}
									/>
									<TextField
										label={t("characterCreation.experienceOccurred")}
										value={entry.occurredLabel}
										maxLength={80}
										onChange={(occurredLabel) =>
											updateExperience(index, { occurredLabel })
										}
									/>
								</div>
								<TextField
									label={t("characterCreation.experienceChanges")}
									value={entry.changes.join(", ")}
									maxLength={240}
									placeholder={t(
										"characterCreation.experienceChangesPlaceholder",
									)}
									onChange={(raw) =>
										updateExperience(index, {
											changes: raw
												.split(/[,，]/)
												.map((part) => part.trim())
												.filter(Boolean)
												.slice(0, 16),
										})
									}
								/>
								<TextField
									label={t("characterCreation.experienceSummary")}
									value={entry.summary}
									multiline
									maxLength={4000}
									onChange={(summary) => updateExperience(index, { summary })}
								/>
							</div>
						))}
					</div>
				)}
			</SheetSection>

			<SheetSection
				title={t("characterCreation.growthTableTitle")}
				description={t("characterCreation.growthTableHint")}
				actions={<BookOpen className="text-foreground-secondary size-4" />}
			>
				{growthRecords.length === 0 ? (
					<p className="text-body-medium text-foreground-secondary">
						{t("characterCreation.growthTableEmpty")}
					</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{growthRecords.map((item) => (
							<div
								key={item.id}
								className="bg-md-surface-container flex flex-col gap-1 rounded-xl px-3.5 py-2.5"
							>
								<span className="font-mono text-label-large-emph text-foreground">
									{t("characterCreation.growthEntryLine", {
										skill: item.skillKey,
										old: item.oldValue,
										next: item.newValue,
										reason: item.reason,
									})}
								</span>
								<span className="font-mono text-label-small text-foreground-tertiary">
									{formatStamp(item.createdAt)}
								</span>
							</div>
						))}
					</div>
				)}
			</SheetSection>
		</div>
	);
}
