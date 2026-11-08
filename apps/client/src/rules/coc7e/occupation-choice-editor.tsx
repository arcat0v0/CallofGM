import { coc7e } from "@cogm/shared";
import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Coc7eSkillPicker, coc7eCatalogOptions } from "./skill-picker";

type Sheet = coc7e.Coc7eCharacterSheet;
type Occupation = coc7e.Coc7eOccupation;

function isFamilyEntry(key: string): boolean {
	const family = coc7e.coc7eSkillFamily(key);
	return family !== null && family === key;
}

function selectionMatches(selected: readonly string[], entry: string): boolean {
	if (selected.includes(entry)) {
		return true;
	}
	if (!isFamilyEntry(entry)) {
		return false;
	}
	return selected.some((key) => coc7e.coc7eSkillFamily(key) === entry);
}

export function Coc7eOccupationChoiceEditor({
	sheet,
	onChange,
	onAddSkill,
}: {
	sheet: Sheet;
	onChange: (occupation: Occupation) => void;
	onAddSkill: (key: string, base: number) => void;
}) {
	const occupation = sheet.occupation;
	const progress = coc7e.coc7eOccupationProgress(occupation);
	const definition = progress.definition;
	if (!definition) {
		return null;
	}
	function setGroup(groupId: string, keys: string[]) {
		onChange(coc7e.coc7eOccupationWithChoice(occupation, groupId, keys));
	}

	function toggleGroupEntry(groupId: string, entry: string, choose: number) {
		const group = progress.choices.find((item) => item.id === groupId);
		const selected = group?.selected ?? [];
		if (selectionMatches(selected, entry)) {
			const next = selected.filter((key) => !selectionMatches([key], entry));
			setGroup(groupId, next);
			return;
		}
		const withoutFamily = selected.filter(
			(key) => !selectionMatches([key], entry),
		);
		if (withoutFamily.length >= choose) {
			setGroup(groupId, [...withoutFamily.slice(1), entry]);
			return;
		}
		setGroup(groupId, [...withoutFamily, entry]);
	}

	function replaceFamilyMember(groupId: string, entry: string, picked: string) {
		const group = progress.choices.find((item) => item.id === groupId);
		const next = (group?.selected ?? []).filter(
			(key) => !selectionMatches([key], entry),
		);
		setGroup(groupId, [...next, picked]);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				{progress.complete ? (
					<Badge variant="soft" tone="success" size="md">
						{t("occupation.templateComplete")}
					</Badge>
				) : (
					<Badge variant="soft" tone="warning" size="md">
						{t("occupation.templateMissing", {
							count: progress.missingChoices,
						})}
					</Badge>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-2">
					<span className="text-foreground-tertiary text-label-medium">
						{t("occupation.fixedSkills")}
					</span>
					<div className="flex flex-wrap gap-1.5">
						{definition.fixedSkillKeys.map((key) => (
							<span
								key={key}
								className="bg-md-primary-container text-md-on-primary-container inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label-large"
							>
								<CheckIcon className="size-3.5" />
								{coc7e.coc7eSkillLabel(key)}
							</span>
						))}
					</div>
					<p className="text-foreground-tertiary text-body-small">
						{t("occupation.fixedSkillsHint")}
					</p>
				</div>

				{progress.choices.map((group) => (
					<div key={group.id} className="flex flex-col gap-2">
						<div className="flex flex-wrap items-baseline gap-2">
							<span className="text-foreground-tertiary text-label-medium">
								{t("occupation.chooseGroup", {
									label: group.label,
									count: group.choose,
								})}
							</span>
							<span className="text-foreground-tertiary text-label-small">
								{t("occupation.chooseProgress", {
									selected: group.selected.length,
									count: group.choose,
								})}
							</span>
						</div>
						<div className="flex flex-wrap items-center gap-1.5">
							{group.pool.map((entry) => {
								const selectedEntry = selectionMatches(group.selected, entry);
								const chosen = group.selected.find((key) =>
									selectionMatches([key], entry),
								);
								const full =
									group.selected.length >= group.choose && !selectedEntry;
								const label = isFamilyEntry(entry)
									? selectedEntry && chosen
										? coc7e.coc7eSkillLabel(chosen)
										: t("occupation.anySpecialty", {
												family: coc7e.coc7eSkillLabel(entry),
											})
									: coc7e.coc7eSkillLabel(entry);
								if (isFamilyEntry(entry)) {
									return (
										<Coc7eSkillPicker
											key={entry}
											title={t("occupation.pickSpecialty", {
												family: coc7e.coc7eSkillLabel(entry),
											})}
											triggerLabel={label}
											options={coc7eCatalogOptions(entry)}
											className={cn(
												selectedEntry &&
													"border-md-primary bg-md-primary-container text-md-on-primary-container border-solid",
											)}
											onPick={(_key, base) => {
												onAddSkill(_key, base);
												if (selectedEntry && chosen) {
													replaceFamilyMember(group.id, entry, _key);
													return;
												}
												toggleGroupEntry(group.id, _key, group.choose);
											}}
										/>
									);
								}
								return (
									<button
										key={entry}
										type="button"
										aria-pressed={selectedEntry}
										disabled={full}
										className={cn(
											"border-md-outline h-8 rounded-full border px-3 text-label-large transition-colors duration-150",
											selectedEntry
												? "bg-md-primary-container text-md-on-primary-container border-md-primary"
												: "text-foreground-secondary hover:bg-md-on-surface/5",
											full && "opacity-40",
										)}
										onClick={() =>
											toggleGroupEntry(group.id, entry, group.choose)
										}
									>
										{label}
									</button>
								);
							})}
						</div>
					</div>
				))}

				{progress.freeSkillSlots > 0 ? (
					<div className="flex flex-col gap-2">
						<span className="text-foreground-tertiary text-label-medium">
							{t("occupation.freeSkills", {
								count: progress.freeSkillSlots,
							})}
						</span>
						<div className="flex flex-wrap items-center gap-1.5">
							{Array.from(
								{ length: progress.freeSkillSlots },
								(_, index) => index,
							).map((index) => {
								const key = progress.freeSkillKeys[index];
								if (!key) {
									return (
										<Coc7eSkillPicker
											key={`free-${index}`}
											triggerLabel={t("occupation.pickAnySkill")}
											exclude={progress.freeSkillKeys}
											onPick={(picked, base) => {
												onAddSkill(picked, base);
												onChange(
													coc7e.coc7eOccupationWithFreeSkills(occupation, [
														...progress.freeSkillKeys,
														picked,
													]),
												);
											}}
										/>
									);
								}
								return (
									<span
										key={`free-${index}`}
										className="bg-md-secondary-container text-md-on-secondary-container inline-flex h-8 items-center gap-1.5 rounded-full ps-3 pe-1 text-label-large"
									>
										{coc7e.coc7eSkillLabel(key)}
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="size-6 rounded-full"
											aria-label={t("occupation.removeFreeSkill", {
												name: coc7e.coc7eSkillLabel(key),
											})}
											onClick={() =>
												onChange(
													coc7e.coc7eOccupationWithFreeSkills(
														occupation,
														progress.freeSkillKeys.filter(
															(item) => item !== key,
														),
													),
												)
											}
										>
											<XIcon className="size-3.5" />
										</Button>
									</span>
								);
							})}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
