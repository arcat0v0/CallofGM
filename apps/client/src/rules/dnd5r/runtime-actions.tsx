import type { SnapshotCharacter } from "@cogm/shared";
import { dnd5r } from "@cogm/shared";
import { HeartPulse, Moon, Play, SkipForward, Square, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
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
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { DndChoiceGrid } from "./editor-controls";
import { conditionLabel, damageLabel } from "./labels";

export function sendDndAction(payload: dnd5r.Action): boolean {
	const sent = sendSessionCommand("rule:action", payload);
	if (!sent) {
		toast.error(t("chat.notConnected"));
		return false;
	}
	return true;
}

export function DndEncounterPanel({
	characters,
	isGm,
	ruleState,
}: {
	characters: SnapshotCharacter[];
	isGm: boolean;
	ruleState: unknown;
}) {
	const parsed = dnd5r.EncounterState.safeParse(ruleState);
	const encounter = parsed.success ? parsed.data : null;
	const [participantIds, setParticipantIds] = useState(() =>
		characters
			.filter((character) => character.kind === "pc")
			.map((character) => character.characterId),
	);
	return (
		<section
			aria-label={t("dnd5r.encounter.title")}
			className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h3 className="text-title-medium-emph text-foreground">
						{t("dnd5r.encounter.title")}
					</h3>
					<p className="text-body-small text-foreground-secondary">
						{encounter
							? t("dnd5r.encounter.round", { round: encounter.round })
							: t("dnd5r.encounter.inactive")}
					</p>
				</div>
				{isGm ? (
					<div className="flex flex-wrap gap-2">
						{!encounter ? (
							<Button
								type="button"
								variant="primary"
								size="sm"
								disabled={
									participantIds.filter((id) =>
										characters.some(
											(character) => character.characterId === id,
										),
									).length === 0
								}
								onClick={() =>
									sendDndAction({
										action: "encounter-start",
										input: {
											characterIds: participantIds.filter((id) =>
												characters.some(
													(character) => character.characterId === id,
												),
											),
										},
									})
								}
							>
								<Play data-icon="inline-start" />
								{t("dnd5r.encounter.start")}
							</Button>
						) : null}
						{encounter ? (
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								onClick={() => sendDndAction({ action: "encounter-next" })}
							>
								<SkipForward data-icon="inline-start" />
								{t("dnd5r.encounter.next")}
							</Button>
						) : null}
						{encounter ? (
							<Button
								type="button"
								variant="dangerSoft"
								size="sm"
								onClick={() => sendDndAction({ action: "encounter-end" })}
							>
								<Square data-icon="inline-start" />
								{t("dnd5r.encounter.end")}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
			{!encounter && isGm ? (
				<DndChoiceGrid
					legend={t("dnd5r.encounter.participants")}
					description={t("dnd5r.encounter.participantsDescription")}
					options={characters.map((character) => ({
						value: character.characterId,
						label: character.name,
						detail: character.kind === "pc" ? t("common.pc") : t("common.npc"),
					}))}
					selected={participantIds}
					onToggle={(id) =>
						setParticipantIds((current) =>
							current.includes(id)
								? current.filter((item) => item !== id)
								: [...current, id],
						)
					}
				/>
			) : null}
			{encounter ? (
				<ol className="flex flex-col gap-1">
					{encounter.combatants.map((combatant, index) => (
						<li
							key={combatant.characterId}
							aria-current={index === encounter.turnIndex ? "true" : undefined}
							className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 ${index === encounter.turnIndex ? "bg-md-primary-container text-md-on-primary-container" : "bg-md-surface-container-high"}`}
						>
							<span className="w-8 text-label-large-emph tabular-nums">
								{combatant.initiative}
							</span>
							<span className="min-w-0 flex-1 truncate">{combatant.name}</span>
							{index === encounter.turnIndex ? (
								<Badge variant="soft" tone="accent" size="sm">
									{t("dnd5r.encounter.currentTurn")}
								</Badge>
							) : null}
						</li>
					))}
				</ol>
			) : (
				<p className="text-body-medium text-foreground-secondary">
					{t("dnd5r.encounter.guide")}
				</p>
			)}
		</section>
	);
}

export function DndStateActions({
	character,
	state,
	gm,
}: {
	character: SnapshotCharacter;
	state: dnd5r.SessionState;
	gm: boolean;
}) {
	const [amount, setAmount] = useState("1");
	const [damageType, setDamageType] = useState<dnd5r.DamageType>("bludgeoning");
	const [hitDice, setHitDice] = useState("1");
	const numericAmount = Number(amount);
	const validAmount =
		Number.isInteger(numericAmount) &&
		numericAmount >= 1 &&
		numericAmount <= 9999;
	const numericHitDice = Number(hitDice);
	const validHitDice =
		Number.isInteger(numericHitDice) &&
		numericHitDice >= 0 &&
		numericHitDice <= 20;
	const conditions = dnd5r.CONDITIONS.filter(
		(condition) => condition !== "exhaustion",
	);

	return (
		<FieldGroup>
			{gm ? (
				<>
					<div className="grid gap-3 sm:grid-cols-3">
						<Field data-invalid={!validAmount}>
							<FieldLabel htmlFor={`dnd-amount-${character.characterId}`}>
								{t("dnd5r.actions.amount")}
							</FieldLabel>
							<Input
								id={`dnd-amount-${character.characterId}`}
								type="number"
								min={1}
								max={9999}
								value={amount}
								aria-invalid={!validAmount}
								onChange={(event) => setAmount(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>{t("dnd5r.actions.damageType")}</FieldLabel>
							<Select
								value={damageType}
								onValueChange={(value) =>
									setDamageType(value as dnd5r.DamageType)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									<SelectGroup>
										{dnd5r.DAMAGE_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{damageLabel(type)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<div className="flex flex-wrap items-end gap-2">
							{gm ? (
								<Button
									type="button"
									variant="dangerSoft"
									disabled={!validAmount}
									onClick={() =>
										sendDndAction({
											action: "damage",
											characterId: character.characterId,
											input: { amount: numericAmount, type: damageType },
										})
									}
								>
									{t("dnd5r.actions.damage")}
								</Button>
							) : null}
							{gm ? (
								<Button
									type="button"
									variant="tertiary"
									disabled={!validAmount}
									onClick={() =>
										sendDndAction({
											action: "heal",
											characterId: character.characterId,
											input: { amount: numericAmount },
										})
									}
								>
									<HeartPulse data-icon="inline-start" />
									{t("dnd5r.actions.heal")}
								</Button>
							) : null}
							<Button
								type="button"
								variant="outline"
								disabled={!validAmount}
								onClick={() =>
									sendDndAction({
										action: "temp-hp",
										characterId: character.characterId,
										input: { amount: numericAmount },
									})
								}
							>
								{t("dnd5r.actions.tempHp")}
							</Button>
						</div>
					</div>
					<div className="flex flex-wrap items-end gap-2 rounded-xl bg-md-surface-container p-3">
						<Field className="w-32" data-invalid={!validHitDice}>
							<FieldLabel htmlFor={`dnd-hit-dice-${character.characterId}`}>
								{t("dnd5r.actions.hitDice")}
							</FieldLabel>
							<Input
								id={`dnd-hit-dice-${character.characterId}`}
								type="number"
								min={0}
								max={20}
								value={hitDice}
								onChange={(event) => setHitDice(event.target.value)}
							/>
							<FieldDescription>
								{t("dnd5r.actions.hitDiceRemaining", {
									current: state.hitDice,
									max: state.maxHitDice,
								})}
							</FieldDescription>
						</Field>
						<Button
							type="button"
							variant="tertiary"
							disabled={!validHitDice}
							onClick={() =>
								sendDndAction({
									action: "short-rest",
									characterId: character.characterId,
									input: { hitDice: numericHitDice },
								})
							}
						>
							<Sun data-icon="inline-start" />
							{t("dnd5r.actions.shortRest")}
						</Button>
						<Button
							type="button"
							variant="tertiary"
							onClick={() =>
								sendDndAction({
									action: "long-rest",
									characterId: character.characterId,
								})
							}
						>
							<Moon data-icon="inline-start" />
							{t("dnd5r.actions.longRest")}
						</Button>
						{state.hp === 0 && !state.deathSaves.stable ? (
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									sendDndAction({
										action: "stabilize",
										characterId: character.characterId,
									})
								}
							>
								{t("dnd5r.actions.stabilize")}
							</Button>
						) : null}
					</div>
				</>
			) : null}
			{state.maxSpellSlots.length > 0 ? (
				<Field>
					<FieldLabel>{t("dnd5r.actions.spellSlots")}</FieldLabel>
					<div className="flex flex-wrap gap-2">
						{Array.from(state.maxSpellSlots.entries()).map(([index, max]) =>
							max > 0 ? (
								<div
									key={index + 1}
									className="flex items-center gap-1 rounded-xl bg-md-surface-container p-2"
								>
									<span className="px-1 text-label-medium">
										{t("dnd5r.spells.level", { level: index + 1 })} ·{" "}
										{state.spellSlots[index] ?? 0}/{max}
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={(state.spellSlots[index] ?? 0) <= 0}
										onClick={() =>
											sendDndAction({
												action: "spell-slot",
												characterId: character.characterId,
												input: { level: index + 1 },
											})
										}
									>
										{t("dnd5r.actions.useSlot")}
									</Button>
									{gm ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={(state.spellSlots[index] ?? 0) >= max}
											onClick={() =>
												sendDndAction({
													action: "spell-slot",
													characterId: character.characterId,
													input: { level: index + 1, restore: true },
												})
											}
										>
											{t("dnd5r.actions.restoreSlot")}
										</Button>
									) : null}
								</div>
							) : null,
						)}
					</div>
				</Field>
			) : null}
			{Object.keys(state.resources).length > 0 ? (
				<Field>
					<FieldLabel>{t("dnd5r.details.resourcesTitle")}</FieldLabel>
					<div className="grid gap-2 sm:grid-cols-2">
						{Object.entries(state.resources).map(([id, resource]) => (
							<div
								key={id}
								className="flex items-center gap-2 rounded-xl bg-md-surface-container px-3 py-2"
							>
								<span className="min-w-0 flex-1 truncate">{resource.name}</span>
								<span className="text-label-medium tabular-nums">
									{resource.current}/{resource.max}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={resource.current <= 0}
									onClick={() =>
										sendDndAction({
											action: "resource",
											characterId: character.characterId,
											input: { id, delta: -1 },
										})
									}
								>
									−1
								</Button>
								{gm ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={resource.current >= resource.max}
										onClick={() =>
											sendDndAction({
												action: "resource",
												characterId: character.characterId,
												input: { id, delta: 1 },
											})
										}
									>
										+1
									</Button>
								) : null}
							</div>
						))}
					</div>
				</Field>
			) : null}
			{gm ? (
				<>
					<DndChoiceGrid
						legend={t("dnd5r.state.conditions")}
						options={conditions.map((condition) => ({
							value: condition,
							label: conditionLabel(condition),
						}))}
						selected={state.conditions}
						onToggle={(condition) =>
							sendDndAction({
								action: "condition",
								characterId: character.characterId,
								input: {
									condition: condition as dnd5r.Condition,
									active: !state.conditions.includes(
										condition as dnd5r.Condition,
									),
								},
							})
						}
					/>
					<Field>
						<FieldLabel>{t("dnd5r.state.exhaustion")}</FieldLabel>
						<Select
							value={String(state.exhaustion)}
							onValueChange={(value) => {
								const level = Number(value);
								sendDndAction({
									action: "condition",
									characterId: character.characterId,
									input: {
										condition: "exhaustion",
										active: level > 0,
										level: Math.max(1, level),
									},
								});
							}}
						>
							<SelectTrigger aria-label={t("dnd5r.state.exhaustion")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{[0, 1, 2, 3, 4, 5, 6].map((level) => (
										<SelectItem key={level} value={String(level)}>
											{level}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				</>
			) : null}
		</FieldGroup>
	);
}
