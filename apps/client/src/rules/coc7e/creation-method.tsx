import { coc7e } from "@cogm/shared";
import { Check, Clover, Dices, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import type {
	RuleCreationOptionsEditorProps,
	RuleCreationReviewProps,
	RuleCreationRollContext,
} from "../types";

type Attributes = coc7e.Coc7eAttributes;
type AttributeKey = coc7e.Coc7eAttributeKey;

const ALL_KEYS: AttributeKey[] = [
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

function abbr(key: AttributeKey): string {
	return coc7e.COC7E_ATTRIBUTE_LABELS[key]?.abbr ?? key.toUpperCase();
}

function isYoung(age: number | null): boolean {
	return age !== null && age >= 15 && age < 20;
}

function parseOptions(value: unknown): coc7e.Coc7eCreationOptions | null {
	const parsed = coc7e.Coc7eCreationOptions.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseResult(value: unknown): coc7e.Coc7eCreationRollResult | null {
	const parsed = coc7e.Coc7eCreationRollResult.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function describeCoc7eCreationOptions(value: unknown): string | null {
	const options = parseOptions(value);
	if (!options) {
		return null;
	}
	return options.method === "destiny"
		? t("characterCreation.method.destinyTitle", { count: options.count })
		: t("characterCreation.method.pointBuyTitle", { points: options.points });
}

/* ------------------------------------------------------------------ */
/* GM：提交链接上的车卡方式                                            */
/* ------------------------------------------------------------------ */

type MethodValue = "manual" | "destiny" | "pointBuy";

export function Coc7eCreationOptionsEditor({
	value,
	onChange,
	disabled,
}: RuleCreationOptionsEditorProps) {
	const options = parseOptions(value);
	const method: MethodValue = options?.method ?? "manual";
	const [count, setCount] = useState(
		options?.method === "destiny" ? options.count : coc7e.COC7E_DESTINY_DEFAULT,
	);
	const [points, setPoints] = useState(
		options?.method === "pointBuy"
			? options.points
			: coc7e.COC7E_POINT_BUY_DEFAULT_TOTAL,
	);

	function selectMethod(next: MethodValue) {
		if (next === "manual") {
			onChange(null);
		} else if (next === "destiny") {
			onChange({ method: "destiny", count });
		} else {
			onChange({ method: "pointBuy", points });
		}
	}

	function clampInt(text: string, min: number, max: number, fallback: number) {
		const parsed = Number.parseInt(text, 10);
		if (!Number.isFinite(parsed)) {
			return fallback;
		}
		return Math.min(max, Math.max(min, parsed));
	}

	return (
		<div className="flex flex-col gap-3">
			<Label>{t("characterCreation.method.label")}</Label>
			<SegmentedControl
				value={method}
				onValueChange={selectMethod}
				options={[
					{
						value: "manual",
						label: t("characterCreation.method.manual"),
						disabled,
					},
					{
						value: "destiny",
						label: t("characterCreation.method.destiny"),
						disabled,
					},
					{
						value: "pointBuy",
						label: t("characterCreation.method.pointBuy"),
						disabled,
					},
				]}
			/>
			{method === "destiny" ? (
				<div className="flex flex-wrap items-center gap-3">
					<NumberStepper
						label={t("characterCreation.method.destinyCount")}
						value={String(count)}
						min={coc7e.COC7E_DESTINY_MIN}
						max={coc7e.COC7E_DESTINY_MAX}
						disabled={disabled}
						size="sm"
						onValueChange={(text) => {
							const next = clampInt(
								text,
								coc7e.COC7E_DESTINY_MIN,
								coc7e.COC7E_DESTINY_MAX,
								count,
							);
							setCount(next);
							onChange({ method: "destiny", count: next });
						}}
					/>
					<span className="text-body-small text-foreground-secondary">
						{t("characterCreation.method.destinyCount")}
					</span>
				</div>
			) : method === "pointBuy" ? (
				<div className="flex flex-wrap items-center gap-3">
					<NumberStepper
						label={t("characterCreation.method.pointBuyTotal")}
						value={String(points)}
						min={coc7e.COC7E_POINT_BUY_MIN_TOTAL}
						max={coc7e.COC7E_POINT_BUY_MAX_TOTAL}
						step={10}
						disabled={disabled}
						size="sm"
						onValueChange={(text) => {
							const next = clampInt(
								text,
								coc7e.COC7E_POINT_BUY_MIN_TOTAL,
								coc7e.COC7E_POINT_BUY_MAX_TOTAL,
								points,
							);
							setPoints(next);
							onChange({ method: "pointBuy", points: next });
						}}
					/>
					<span className="text-body-small text-foreground-secondary">
						{t("characterCreation.method.pointBuyTotal")}
					</span>
				</div>
			) : null}
			<p className="text-body-small text-foreground-tertiary">
				{method === "destiny"
					? t("characterCreation.method.destinyHint", { count })
					: method === "pointBuy"
						? t("characterCreation.method.pointBuyHint", {
								points,
								min: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MIN,
								max: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MAX,
							})
						: t("characterCreation.method.manualHint")}
			</p>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* 玩家：车卡页的掷骰面板                                              */
/* ------------------------------------------------------------------ */

function AttributeGrid({
	attributes,
	highlight,
}: {
	attributes: Attributes;
	highlight?: ReadonlySet<AttributeKey>;
}) {
	return (
		<dl className="grid grid-cols-3 gap-x-3 gap-y-1">
			{ALL_KEYS.map((key) => (
				<div key={key} className="flex items-baseline justify-between gap-1">
					<dt className="text-label-small text-foreground-tertiary">
						{abbr(key)}
					</dt>
					<dd
						className={cn(
							"font-mono text-label-large tabular-nums text-foreground",
							highlight?.has(key) && "text-warning",
						)}
					>
						{attributes[key]}
					</dd>
				</div>
			))}
		</dl>
	);
}

function SetSummary({ attributes }: { attributes: Attributes }) {
	const summary = coc7e.coc7eAttributeSetSummary(attributes);
	return (
		<p
			className="font-mono text-label-small tabular-nums text-foreground-secondary"
			title={t("characterCreation.method.setTotalsHint")}
		>
			{t("characterCreation.method.hp", { hp: summary.hp })} ·{" "}
			{t("characterCreation.method.db", { db: summary.damageBonus })} ·{" "}
			{t("characterCreation.method.setTotals", {
				without: summary.totalWithoutLuck,
				with: summary.totalWithLuck,
			})}
		</p>
	);
}

function appliedAttributes(set: coc7e.Coc7eDestinySet, age: number | null) {
	return isYoung(age)
		? {
				...set.attributes,
				luck: Math.max(set.attributes.luck, set.youngLuck),
			}
		: set.attributes;
}

export function Coc7eCreationRollPanel({
	creation,
	attributes,
	age,
	onApplyAttributes,
}: {
	creation: RuleCreationRollContext;
	attributes: Attributes;
	age: number | null;
	onApplyAttributes: (attributes: Attributes) => void;
}) {
	const options = parseOptions(creation.options);
	if (!options) {
		return null;
	}
	return options.method === "destiny" ? (
		<DestinyPanel
			count={options.count}
			creation={creation}
			age={age}
			onApplyAttributes={onApplyAttributes}
		/>
	) : (
		<PointBuyPanel
			points={options.points}
			creation={creation}
			attributes={attributes}
			age={age}
			onApplyAttributes={onApplyAttributes}
		/>
	);
}

function DestinyPanel({
	count,
	creation,
	age,
	onApplyAttributes,
}: {
	count: number;
	creation: RuleCreationRollContext;
	age: number | null;
	onApplyAttributes: (attributes: Attributes) => void;
}) {
	const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
	const result = parseResult(creation.roll?.result);
	const sets = result?.method === "destiny" ? result.sets : [];
	const chosenIndex = creation.roll?.chosenIndex ?? null;

	async function confirmChoice(index: number) {
		setConfirmIndex(null);
		const updated = await creation.onChoose(index);
		const set = sets[index];
		if (updated && set) {
			onApplyAttributes(appliedAttributes(set, age));
		}
	}

	return (
		<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="font-sans text-title-small-emph text-foreground">
						{t("characterCreation.method.destinyTitle", { count })}
					</span>
					<p className="text-body-small text-foreground-secondary">
						{t("characterCreation.method.destinyIntro", { count })}
					</p>
				</div>
				{creation.roll ? null : (
					<Button
						type="button"
						variant="primary"
						size="sm"
						disabled={creation.pending}
						onClick={() => void creation.onRoll()}
					>
						<Dices />
						{t("characterCreation.method.destinyRoll", { count })}
					</Button>
				)}
			</div>

			{sets.length > 0 ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{sets.map((set, index) => {
						const chosen = chosenIndex === index;
						const dimmed = chosenIndex !== null && !chosen;
						return (
							<div
								key={index}
								className={cn(
									"flex flex-col gap-2.5 rounded-xl border bg-md-surface-container-low p-3.5",
									chosen
										? "border-accent"
										: "border-md-outline-variant/30",
									dimmed && "opacity-50",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="font-sans text-label-large text-foreground">
										{t("characterCreation.method.setTitle", {
											index: index + 1,
										})}
									</span>
									{chosen ? (
										<Badge variant="soft" tone="accent" size="sm">
											<Check className="size-3" />
											{t("characterCreation.method.chosen")}
										</Badge>
									) : null}
								</div>
								<AttributeGrid attributes={set.attributes} />
								<SetSummary attributes={set.attributes} />
								{isYoung(age) ? (
									<p className="text-label-small text-foreground-tertiary">
										{t("characterCreation.method.youngLuck", {
											luck: set.youngLuck,
										})}
									</p>
								) : null}
								{chosenIndex === null ? (
									<Button
										type="button"
										variant="accentSoft"
										size="sm"
										disabled={creation.pending}
										onClick={() => setConfirmIndex(index)}
									>
										{t("characterCreation.method.choose")}
									</Button>
								) : chosen ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											onApplyAttributes(appliedAttributes(set, age))
										}
									>
										<RotateCcw />
										{t("characterCreation.method.reapply")}
									</Button>
								) : null}
							</div>
						);
					})}
				</div>
			) : null}

			<ConfirmDialog
				open={confirmIndex !== null}
				onOpenChange={(open) => {
					if (!open) {
						setConfirmIndex(null);
					}
				}}
				icon={Check}
				variant="warning"
				title={t("characterCreation.method.chooseConfirmTitle", {
					index: (confirmIndex ?? 0) + 1,
				})}
				description={t("characterCreation.method.chooseConfirmBody")}
				confirmLabel={t("characterCreation.method.chooseConfirm")}
				onConfirm={() => {
					if (confirmIndex !== null) {
						void confirmChoice(confirmIndex);
					}
				}}
			/>
		</div>
	);
}

function pointBuyLuck(
	result: Extract<coc7e.Coc7eCreationRollResult, { method: "pointBuy" }>,
	age: number | null,
): number {
	return isYoung(age) ? Math.max(result.luck, result.youngLuck) : result.luck;
}

function PointBuyPanel({
	points,
	creation,
	attributes,
	age,
	onApplyAttributes,
}: {
	points: number;
	creation: RuleCreationRollContext;
	attributes: Attributes;
	age: number | null;
	onApplyAttributes: (attributes: Attributes) => void;
}) {
	const spent = coc7e.coc7ePointBuySpent(attributes);
	const remaining = points - spent;
	const outOfRange = coc7e.COC7E_POINT_BUY_KEYS.filter(
		(key) =>
			attributes[key] < coc7e.COC7E_POINT_BUY_ATTRIBUTE_MIN ||
			attributes[key] > coc7e.COC7E_POINT_BUY_ATTRIBUTE_MAX,
	);
	const result = parseResult(creation.roll?.result);
	const luckResult = result?.method === "pointBuy" ? result : null;

	async function roll() {
		const rolled = await creation.onRoll();
		const parsed = parseResult(rolled?.result);
		if (parsed?.method === "pointBuy") {
			onApplyAttributes({ ...attributes, luck: pointBuyLuck(parsed, age) });
		}
	}

	return (
		<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
			<div className="flex flex-col gap-1">
				<span className="font-sans text-title-small-emph text-foreground">
					{t("characterCreation.method.pointBuyTitle", { points })}
				</span>
				<p className="text-body-small text-foreground-secondary">
					{t("characterCreation.method.pointBuyIntro", {
						points,
						min: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MIN,
						max: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MAX,
					})}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge
					variant="soft"
					tone={remaining === 0 ? "success" : remaining < 0 ? "danger" : "warning"}
					size="sm"
				>
					{t("characterCreation.method.pointBuySpent", { spent, points })}
				</Badge>
				<span className="text-label-small text-foreground-tertiary">
					{remaining >= 0
						? t("characterCreation.method.pointBuyRemaining", { remaining })
						: t("characterCreation.method.pointBuyOver", { over: -remaining })}
				</span>
				{outOfRange.length > 0 ? (
					<span className="text-label-small text-warning">
						{t("characterCreation.method.pointBuyOutOfRange", {
							names: outOfRange.map(abbr).join("/"),
							min: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MIN,
							max: coc7e.COC7E_POINT_BUY_ATTRIBUTE_MAX,
						})}
					</span>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-3">
				{luckResult ? (
					<>
						<Badge variant="soft" tone="accent" size="sm">
							<Clover className="size-3" />
							{t("characterCreation.method.luckResult", {
								luck: luckResult.luck,
							})}
						</Badge>
						{isYoung(age) ? (
							<span className="text-label-small text-foreground-tertiary">
								{t("characterCreation.method.youngLuck", {
									luck: luckResult.youngLuck,
								})}
							</span>
						) : null}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								onApplyAttributes({
									...attributes,
									luck: pointBuyLuck(luckResult, age),
								})
							}
						>
							<RotateCcw />
							{t("characterCreation.method.applyLuck")}
						</Button>
					</>
				) : (
					<Button
						type="button"
						variant="primary"
						size="sm"
						disabled={creation.pending}
						onClick={() => void roll()}
					>
						<Dices />
						{t("characterCreation.method.rollLuck")}
					</Button>
				)}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* GM：审核比对                                                        */
/* ------------------------------------------------------------------ */

export function Coc7eCreationReviewSummary({
	roll,
	submittedSheet,
}: RuleCreationReviewProps) {
	const options = parseOptions(roll.options);
	const result = parseResult(roll.result);
	if (!options || !result) {
		return null;
	}
	const sheet = coc7e.Coc7eCharacterSheet.safeParse(submittedSheet);
	const submitted = sheet.success ? sheet.data : null;
	const differences = submitted
		? coc7e.coc7eCreationDifferences(
				result,
				roll.chosenIndex,
				submitted.attributes,
				submitted.age,
			)
		: [];
	const diffKeys = new Set(differences.map((item) => item.key));

	let heading: string;
	if (options.method === "destiny") {
		heading =
			roll.chosenIndex === null
				? t("characterCreation.method.reviewDestinyUnchosen", {
						count: options.count,
					})
				: t("characterCreation.method.reviewDestiny", {
						count: options.count,
						index: roll.chosenIndex + 1,
					});
	} else {
		heading = t("characterCreation.method.reviewPointBuy", {
			points: options.points,
			spent: submitted ? coc7e.coc7ePointBuySpent(submitted.attributes) : "—",
		});
	}

	const chosenSet =
		result.method === "destiny" && roll.chosenIndex !== null
			? result.sets[roll.chosenIndex]
			: undefined;

	return (
		<div className="flex flex-col gap-2 rounded-xl bg-md-surface-container-low px-3.5 py-3">
			<div className="flex flex-wrap items-center gap-2">
				<Dices className="size-4 text-foreground-tertiary" />
				<span className="text-label-large text-foreground">{heading}</span>
				{submitted ? (
					<Badge
						variant="soft"
						tone={differences.length === 0 ? "success" : "warning"}
						size="sm"
					>
						{differences.length === 0
							? t("characterCreation.method.reviewMatch")
							: String(differences.length)}
					</Badge>
				) : null}
			</div>
			{chosenSet ? (
				<AttributeGrid attributes={chosenSet.attributes} highlight={diffKeys} />
			) : null}
			{result.method === "pointBuy" ? (
				<span className="text-label-small text-foreground-secondary">
					{t("characterCreation.method.luckResult", { luck: result.luck })} ·{" "}
					{t("characterCreation.method.youngLuck", {
						luck: result.youngLuck,
					})}
				</span>
			) : null}
			{submitted === null ? (
				<span className="text-label-small text-foreground-tertiary">
					{t("characterCreation.method.reviewSheetStale")}
				</span>
			) : (
				differences.map((item) => (
					<span key={item.key} className="text-label-small text-warning">
						{t("characterCreation.method.reviewDiff", {
							name: abbr(item.key),
							expected: item.expected,
							submitted: item.submitted,
						})}
					</span>
				))
			)}
		</div>
	);
}
