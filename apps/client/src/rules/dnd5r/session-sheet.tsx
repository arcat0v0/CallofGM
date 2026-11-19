import { dnd5r } from "@cogm/shared";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/i18n";
import type { RuleSessionSheetProps } from "../types";
import { DndSourceCredit } from "./catalog-picker";
import { DndDerivedGrid, namedRecordRows } from "./editor-controls";
import {
	ABILITIES,
	abilityLabel,
	backgroundLabel,
	classLabel,
	conditionLabel,
	damageLabel,
	SKILLS,
	signed,
	skillLabel,
	speciesLabel,
} from "./labels";
import { DndEncounterPanel, DndStateActions } from "./runtime-actions";

export function DndSessionSheet({
	target,
	characters,
	isGm,
	ruleState,
	canPerform,
	onPerform,
}: RuleSessionSheetProps) {
	const parsed = dnd5r.CharacterSheet.safeParse(target.sheet);
	const stateParsed = dnd5r.SessionState.safeParse(target.state);
	const [search, setSearch] = useState("");
	const derived = parsed.success ? dnd5r.deriveCharacter(parsed.data) : null;
	const visibleSkills = useMemo(() => {
		const keyword = search.trim().toLocaleLowerCase();
		return SKILLS.filter(
			(skill) =>
				!keyword ||
				`${skillLabel(skill)} ${skill}`.toLocaleLowerCase().includes(keyword),
		);
	}, [search]);

	if (!parsed.success || !derived) {
		return (
			<p className="text-body-medium text-foreground-secondary">
				{t("sheet.empty")}
			</p>
		);
	}
	const sheet = parsed.data;
	const state = stateParsed.success ? stateParsed.data : null;

	return (
		<div className="flex flex-col gap-4">
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
			{state ? (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div className="rounded-xl bg-md-error-container px-3 py-2 text-md-on-error-container">
						<span className="text-label-small">HP</span>
						<p className="text-title-medium-emph tabular-nums">
							{state.hp}/{state.maxHp}
							{state.tempHp > 0 ? ` +${state.tempHp}` : ""}
						</p>
					</div>
					<div className="rounded-xl bg-md-secondary-container px-3 py-2 text-md-on-secondary-container">
						<span className="text-label-small">{t("dnd5r.state.hitDice")}</span>
						<p className="text-title-medium-emph tabular-nums">
							{state.hitDice}/{state.maxHitDice}
						</p>
					</div>
					<div className="rounded-xl bg-md-tertiary-container px-3 py-2 text-md-on-tertiary-container">
						<span className="text-label-small">
							{t("dnd5r.state.deathSaves")}
						</span>
						<p className="text-title-medium-emph tabular-nums">
							✓ {state.deathSaves.successes} · ✕ {state.deathSaves.failures}
						</p>
					</div>
					<Button
						type="button"
						variant="tertiary"
						disabled={!canPerform}
						onClick={() => onPerform("death")}
						className="h-auto flex-col"
					>
						<span className="text-label-small">{t("dnd5r.check.death")}</span>
						<span className="text-title-medium-emph">d20</span>
					</Button>
				</div>
			) : null}
			{state &&
			(state.conditions.length > 0 ||
				state.exhaustion > 0 ||
				state.deathSaves.stable ||
				state.deathSaves.dead) ? (
				<div className="flex flex-wrap gap-2">
					{state.conditions.map((condition) => (
						<Badge key={condition} variant="soft" tone="danger">
							{conditionLabel(condition)}
						</Badge>
					))}
					{state.exhaustion > 0 ? (
						<Badge variant="soft" tone="danger">
							{t("dnd5r.state.exhaustionLevel", { level: state.exhaustion })}
						</Badge>
					) : null}
					{state.deathSaves.stable ? (
						<Badge variant="soft" tone="accent">
							{t("dnd5r.state.stable")}
						</Badge>
					) : null}
					{state.deathSaves.dead ? (
						<Badge variant="soft" tone="danger">
							{t("dnd5r.state.dead")}
						</Badge>
					) : null}
				</div>
			) : null}
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
			<Tabs defaultValue="checks" className="gap-3">
				<TabsList className="w-full">
					<TabsTrigger value="checks">{t("dnd5r.session.checks")}</TabsTrigger>
					<TabsTrigger value="actions">
						{t("dnd5r.session.actions")}
					</TabsTrigger>
					<TabsTrigger value="records">{t("sheet.recordsTab")}</TabsTrigger>
				</TabsList>
				<TabsContent value="checks" className="flex flex-col gap-4">
					<Button
						type="button"
						variant="primary"
						disabled={!canPerform}
						onClick={() => onPerform("initiative")}
					>
						{t("dnd5r.check.initiative")} · {signed(derived.initiative)}
					</Button>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{ABILITIES.map((ability) => (
							<Button
								key={ability}
								type="button"
								variant="tertiary"
								className="h-auto flex-col px-3 py-2"
								disabled={!canPerform}
								onClick={() => onPerform(`ability:${ability}`)}
							>
								<span>
									{abilityLabel(ability)} · {derived.abilities[ability]}
								</span>
								<span className="text-title-medium-emph tabular-nums">
									{signed(derived.abilityModifiers[ability])}
								</span>
							</Button>
						))}
					</div>
					<section className="flex flex-col gap-2">
						<h3 className="text-title-medium-emph">
							{t("dnd5r.abilities.saves")}
						</h3>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{ABILITIES.map((ability) => (
								<Button
									key={ability}
									type="button"
									variant="outline"
									disabled={!canPerform}
									onClick={() => onPerform(`save:${ability}`)}
								>
									{abilityLabel(ability)} ·{" "}
									{signed(derived.savingThrows[ability])}
								</Button>
							))}
						</div>
					</section>
					<section className="flex flex-col gap-2">
						<h3 className="text-title-medium-emph">
							{t("dnd5r.review.attacks")}
						</h3>
						<div className="grid gap-2 sm:grid-cols-2">
							{derived.attacks.map((attack) => (
								<Button
									key={attack.id}
									type="button"
									variant="tertiary"
									className="h-auto justify-between px-3 py-2"
									disabled={!canPerform}
									onClick={() => onPerform(`attack:${attack.id}`)}
								>
									<span className="flex flex-col text-left">
										<span>{attack.name}</span>
										<span className="text-body-small">
											{attack.damage.count}d{attack.damage.sides}
											{signed(attack.damageBonus)}{" "}
											{damageLabel(attack.damage.type)}
										</span>
									</span>
									<span className="text-title-medium-emph tabular-nums">
										{signed(attack.attackBonus)}
									</span>
								</Button>
							))}
						</div>
					</section>
					<InputGroup>
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
						<InputGroupInput
							value={search}
							aria-label={t("sheet.searchSkills")}
							placeholder={t("sheet.searchSkills")}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</InputGroup>
					<div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
						{visibleSkills.map((skill) => (
							<Button
								key={skill}
								type="button"
								variant="ghost"
								className="justify-between"
								disabled={!canPerform}
								onClick={() => onPerform(`skill:${skill}`)}
							>
								<span>{skillLabel(skill)}</span>
								<span className="tabular-nums">
									{signed(derived.skillModifiers[skill])}
								</span>
							</Button>
						))}
					</div>
				</TabsContent>
				<TabsContent value="actions" className="flex flex-col gap-4">
					<DndEncounterPanel
						characters={characters}
						isGm={isGm}
						ruleState={ruleState}
					/>
					{state && canPerform ? (
						<DndStateActions character={target} state={state} gm={isGm} />
					) : (
						<p className="text-body-medium text-foreground-secondary">
							{t("dnd5r.session.actionsReadOnly")}
						</p>
					)}
				</TabsContent>
				<TabsContent value="records" className="flex flex-col gap-4">
					<section>
						<h3 className="text-title-medium-emph">
							{t("dnd5r.spells.title")}
						</h3>
						{sheet.spellIds.length + sheet.customSpells.length === 0 ? (
							<p className="text-body-medium text-foreground-secondary">
								{t("dnd5r.session.noSpells")}
							</p>
						) : (
							<div className="grid gap-2 sm:grid-cols-2">
								{sheet.spellIds.map((id) => (
									<div
										key={id}
										className="rounded-xl bg-md-surface-container p-3"
									>
										<p className="text-label-large-emph">
											{dnd5r.SPELLS[id]?.name ?? id}
										</p>
										<p className="text-body-small text-foreground-secondary">
											{t("dnd5r.spells.level", {
												level: dnd5r.SPELLS[id]?.level ?? 0,
											})}{" "}
											· {dnd5r.SPELLS[id]?.school}
										</p>
									</div>
								))}
								{sheet.customSpells.map((spell) => (
									<div
										key={spell.name}
										className="rounded-xl bg-md-surface-container p-3"
									>
										<p className="text-label-large-emph">{spell.name}</p>
										<p className="text-body-small text-foreground-secondary">
											{t("dnd5r.spells.level", { level: spell.level })}
										</p>
									</div>
								))}
							</div>
						)}
					</section>
					<section>
						<h3 className="text-title-medium-emph">
							{t("dnd5r.tabs.equipment")}
						</h3>
						<div className="grid gap-2 sm:grid-cols-2">
							{namedRecordRows(sheet.inventory).map(({ item, key }) => (
								<div
									key={key}
									className="rounded-xl bg-md-surface-container p-3"
								>
									{item.name} · {item.quantity}
								</div>
							))}
						</div>
					</section>
					<section>
						<h3 className="text-title-medium-emph">
							{t("dnd5r.proficiencies.feats")}
						</h3>
						<div className="flex flex-wrap gap-2">
							{sheet.feats.map((feat) => (
								<Badge key={feat} variant="soft" tone="default">
									{feat}
								</Badge>
							))}
						</div>
					</section>
					{sheet.notes ? (
						<section>
							<h3 className="text-title-medium-emph">
								{t("dnd5r.details.notesTitle")}
							</h3>
							<p className="whitespace-pre-wrap text-body-medium text-foreground-secondary">
								{sheet.notes}
							</p>
						</section>
					) : null}
					<DndSourceCredit />
				</TabsContent>
			</Tabs>
		</div>
	);
}
