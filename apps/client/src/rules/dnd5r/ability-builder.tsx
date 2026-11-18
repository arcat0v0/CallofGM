import { dnd5r } from "@cogm/shared";
import { Check, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { SheetSection } from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/i18n";
import {
	ABILITIES,
	abilityLabel,
	type DndAbility,
	type DndSheet,
	signed,
} from "./labels";

export type AbilityMethod = "standard" | "point-buy" | "manual";
export type BoostMode = "two-plus-one" | "three-plus-one";
export type AbilityScores = Record<DndAbility, number>;
export type AbilityBoosts = Record<DndAbility, number>;

const STANDARD_SCORES = [15, 14, 13, 12, 10, 8] as const;
const POINT_COSTS: Record<number, number> = {
	8: 0,
	9: 1,
	10: 2,
	11: 3,
	12: 4,
	13: 5,
	14: 7,
	15: 9,
};

function zeroBoosts(): AbilityBoosts {
	return Object.fromEntries(
		ABILITIES.map((ability) => [ability, 0]),
	) as AbilityBoosts;
}

function standardScores(): AbilityScores {
	return Object.fromEntries(
		ABILITIES.map((ability, index) => [ability, STANDARD_SCORES[index]]),
	) as AbilityScores;
}

function pointBuyScores(): AbilityScores {
	return Object.fromEntries(
		ABILITIES.map((ability) => [ability, 8]),
	) as AbilityScores;
}

export function abilityPointCost(score: number): number | null {
	return POINT_COSTS[score] ?? null;
}

export function abilityPointTotal(scores: AbilityScores): number {
	return ABILITIES.reduce(
		(total, ability) => total + (abilityPointCost(scores[ability]) ?? 99),
		0,
	);
}

export function previewAbilityScores(
	base: AbilityScores,
	boosts: AbilityBoosts,
): AbilityScores {
	return Object.fromEntries(
		ABILITIES.map((ability) => [ability, base[ability] + boosts[ability]]),
	) as AbilityScores;
}

export function abilityBuildError({
	method,
	base,
	boosts,
	allowed,
}: {
	method: AbilityMethod;
	base: AbilityScores;
	boosts: AbilityBoosts;
	allowed: readonly DndAbility[];
}): string | null {
	if (method === "point-buy" && abilityPointTotal(base) > 27) {
		return t("dnd5r.abilities.pointBuyInvalid");
	}
	if (method === "standard") {
		const values = ABILITIES.map((ability) => base[ability]);
		if (
			new Set(values).size !== ABILITIES.length ||
			values.some(
				(value) =>
					!STANDARD_SCORES.includes(value as (typeof STANDARD_SCORES)[number]),
			)
		) {
			return t("dnd5r.abilities.standardInvalid");
		}
	}
	const active = ABILITIES.filter((ability) => boosts[ability] > 0);
	if (
		active.some((ability) => !allowed.includes(ability) || boosts[ability] > 2)
	) {
		return t("dnd5r.abilities.boostInvalid");
	}
	const twos = active.filter((ability) => boosts[ability] === 2).length;
	const ones = active.filter((ability) => boosts[ability] === 1).length;
	if ((twos === 1 && ones === 1) || (twos === 0 && ones === 3)) {
		return null;
	}
	return t("dnd5r.abilities.boostRequired");
}

export function DndAbilityBuilder({
	sheet,
	onChange,
	showValidation,
	onDirtyChange,
}: {
	sheet: DndSheet;
	onChange: (patch: Partial<DndSheet>) => void;
	showValidation: boolean;
	onDirtyChange?: (dirty: boolean) => void;
}) {
	const [method, setMethod] = useState<AbilityMethod>("standard");
	const [boostMode, setBoostMode] = useState<BoostMode>("two-plus-one");
	const [base, setBase] = useState<AbilityScores>(() => standardScores());
	const [boosts, setBoosts] = useState<AbilityBoosts>(zeroBoosts);
	const [attempted, setAttempted] = useState(false);
	const [appliedSignature, setAppliedSignature] = useState<string | null>(null);
	const [touched, setTouched] = useState(false);
	const background = dnd5r.BACKGROUNDS[sheet.backgroundId];
	const allowed = background?.abilities ?? ABILITIES;
	const preview = useMemo(
		() => previewAbilityScores(base, boosts),
		[base, boosts],
	);
	const signature = useMemo(
		() => JSON.stringify({ base, boosts }),
		[base, boosts],
	);
	const error = abilityBuildError({ method, base, boosts, allowed });
	const applied = appliedSignature === signature;

	function markDirty() {
		setTouched(true);
		onDirtyChange?.(true);
	}
	function updateBase(ability: DndAbility, value: number) {
		setBase((current) => {
			if (method === "standard") {
				const previous = current[ability];
				const other = ABILITIES.find(
					(key) => key !== ability && current[key] === value,
				);
				return {
					...current,
					[ability]: value,
					...(other ? { [other]: previous } : {}),
				};
			}
			return { ...current, [ability]: value };
		});
		setAppliedSignature(null);
		markDirty();
	}

	function changeMethod(next: AbilityMethod) {
		setMethod(next);
		setBase(
			next === "standard"
				? standardScores()
				: next === "point-buy"
					? pointBuyScores()
					: { ...sheet.abilities },
		);
		setAppliedSignature(null);
		markDirty();
	}

	function apply() {
		setAttempted(true);
		if (error) {
			return;
		}
		onChange({ abilities: preview });
		setAppliedSignature(signature);
		setTouched(false);
		onDirtyChange?.(false);
		setAttempted(false);
	}

	return (
		<SheetSection
			title={t("dnd5r.abilities.title")}
			description={t("dnd5r.abilities.description")}
			actions={
				<Button
					type="button"
					variant="primary"
					disabled={applied}
					onClick={apply}
				>
					<Check data-icon="inline-start" />
					{t("dnd5r.abilities.apply")}
				</Button>
			}
		>
			<FieldGroup>
				<Field>
					<FieldLabel>{t("dnd5r.abilities.method")}</FieldLabel>
					<ToggleGroup
						type="single"
						value={method}
						onValueChange={(value) =>
							value && changeMethod(value as AbilityMethod)
						}
						className="w-full flex-wrap"
					>
						<ToggleGroupItem value="standard" className="min-h-11 flex-1">
							{t("dnd5r.abilities.standard")}
						</ToggleGroupItem>
						<ToggleGroupItem value="point-buy" className="min-h-11 flex-1">
							{t("dnd5r.abilities.pointBuy")}
						</ToggleGroupItem>
						<ToggleGroupItem value="manual" className="min-h-11 flex-1">
							{t("dnd5r.abilities.manual")}
						</ToggleGroupItem>
					</ToggleGroup>
					<FieldDescription>
						{t(`dnd5r.abilities.${method}Hint`)}
					</FieldDescription>
				</Field>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{ABILITIES.map((ability) => (
						<Field key={ability}>
							<FieldLabel htmlFor={`ability-${ability}`}>
								{abilityLabel(ability)}
							</FieldLabel>
							{method === "manual" ? (
								<input
									id={`ability-${ability}`}
									type="number"
									min={1}
									max={30}
									value={base[ability]}
									aria-invalid={base[ability] < 1 || base[ability] > 30}
									onChange={(event) =>
										updateBase(ability, Number(event.target.value))
									}
									className="border-field-border bg-field text-field-foreground focus-visible:border-field-border-focus focus-visible:ring-focus-ring/35 h-10 rounded-md border px-3 outline-none focus-visible:ring-4"
								/>
							) : (
								<Select
									value={String(base[ability])}
									onValueChange={(value) => updateBase(ability, Number(value))}
								>
									<SelectTrigger id={`ability-${ability}`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent position="popper">
										<SelectGroup>
											{(method === "standard"
												? STANDARD_SCORES
												: Object.keys(POINT_COSTS).map(Number)
											).map((score) => (
												<SelectItem key={score} value={String(score)}>
													{score}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							)}
							<FieldDescription>
								{t("dnd5r.abilities.preview", {
									score: preview[ability],
									modifier: signed(dnd5r.abilityModifier(preview[ability])),
								})}
							</FieldDescription>
						</Field>
					))}
				</div>
				{method === "point-buy" ? (
					<Badge
						variant="soft"
						tone={abilityPointTotal(base) > 27 ? "danger" : "accent"}
					>
						{t("dnd5r.abilities.pointBudget", {
							used: abilityPointTotal(base),
							total: 27,
						})}
					</Badge>
				) : null}
				<Field>
					<FieldLabel>{t("dnd5r.abilities.originTitle")}</FieldLabel>
					<FieldDescription>
						{t("dnd5r.abilities.originDescription", {
							background: background?.name ?? t("dnd5r.custom.background"),
							abilities: allowed
								.map(abilityLabel)
								.join(t("common.listSeparator")),
						})}
					</FieldDescription>
					<ToggleGroup
						type="single"
						value={boostMode}
						onValueChange={(value) => {
							if (value) {
								const nextMode = value as BoostMode;
								setBoostMode(nextMode);
								setBoosts(
									nextMode === "three-plus-one" && allowed.length === 3
										? Object.assign(
												zeroBoosts(),
												Object.fromEntries(
													allowed.map((ability) => [ability, 1]),
												),
											)
										: zeroBoosts(),
								);
								markDirty();
							}
						}}
						className="w-full flex-wrap"
					>
						<ToggleGroupItem value="two-plus-one" className="min-h-11 flex-1">
							{t("dnd5r.abilities.boostTwoPlusOne")}
						</ToggleGroupItem>
						<ToggleGroupItem value="three-plus-one" className="min-h-11 flex-1">
							{t("dnd5r.abilities.boostThreePlusOne")}
						</ToggleGroupItem>
					</ToggleGroup>
				</Field>
				<div className="grid gap-3 sm:grid-cols-3">
					{allowed.map((ability) => (
						<Field key={ability}>
							<FieldLabel>
								{t("dnd5r.abilities.boostFor", { name: abilityLabel(ability) })}
							</FieldLabel>
							<Select
								value={String(boosts[ability])}
								onValueChange={(value) => {
									setBoosts((current) => ({
										...current,
										[ability]: Number(value),
									}));
									setAppliedSignature(null);
									markDirty();
								}}
							>
								<SelectTrigger
									aria-label={t("dnd5r.abilities.boostFor", {
										name: abilityLabel(ability),
									})}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									<SelectGroup>
										<SelectItem value="0">
											{t("dnd5r.abilities.noBoost")}
										</SelectItem>
										<SelectItem value="1">+1</SelectItem>
										{boostMode === "two-plus-one" ? (
											<SelectItem value="2">+2</SelectItem>
										) : null}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					))}
				</div>
				{!applied && (showValidation || attempted) ? (
					<FieldError>
						{touched ? (error ?? t("dnd5r.abilities.pending")) : error}
					</FieldError>
				) : null}
				{applied ? (
					<p role="status" className="text-success text-body-medium">
						{t("dnd5r.abilities.applied", {
							scores: ABILITIES.map(
								(ability) => `${abilityLabel(ability)} ${preview[ability]}`,
							).join(t("common.listSeparator")),
						})}
					</p>
				) : null}
				<Button
					type="button"
					variant="ghost"
					className="self-start"
					onClick={() => {
						setBase({ ...sheet.abilities });
						setBoosts(zeroBoosts());
						setAppliedSignature(null);
						setTouched(false);
						onDirtyChange?.(false);
					}}
				>
					<RotateCcw data-icon="inline-start" />
					{t("dnd5r.abilities.resetToSheet")}
				</Button>
			</FieldGroup>
		</SheetSection>
	);
}
