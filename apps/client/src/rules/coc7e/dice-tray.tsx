import { coc7e } from "@cogm/shared";
import { Check, Dices, EyeOff, Search, UserX } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { HiddenRollSwitch } from "@/features/session-live/hidden-roll-switch";
import { QuickPickChip } from "@/features/session-live/quick-pick-chip";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import type { RuleDiceTrayProps } from "../types";
import {
	difficultyLabel,
	difficultyThreshold,
	skillKeysFor,
	skillValue,
} from "./sheet-data";

/** 跑团中最常发起的调查/行动技能，作为一键快选。 */
const QUICK_SKILLS = [
	"侦查",
	"聆听",
	"图书馆",
	"心理学",
	"说服",
	"潜行",
	"闪避",
	"luck",
] as const;
const DEFAULT_SKILL = QUICK_SKILLS[0];
const DIFFICULTIES = ["regular", "hard", "extreme"] as const;
const MODIFIERS = ["-2", "-1", "0", "1", "2"] as const;
type Modifier = (typeof MODIFIERS)[number];

function Field({
	label,
	aside,
	children,
}: {
	label: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<div className="flex items-baseline justify-between gap-2 px-0.5">
				<span className="text-md-on-surface-variant text-label-medium">
					{label}
				</span>
				{aside}
			</div>
			{children}
		</div>
	);
}

function modifierLabel(value: Modifier) {
	const count = Math.abs(Number(value));
	if (count === 0) {
		return { short: t("dice.modifierNone"), full: t("dice.modifierNone") };
	}
	return Number(value) > 0
		? {
				short: t("dice.bonusShort", { count }),
				full: t("dice.bonusFull", { count }),
			}
		: {
				short: t("dice.penaltyShort", { count }),
				full: t("dice.penaltyFull", { count }),
			};
}

export function CocDiceTray({
	active,
	character: initial,
	characterId,
	characters,
	gm,
	disabled,
	hidden,
	onHiddenChange,
	onSubmitted,
	onError,
}: RuleDiceTrayProps) {
	const [selectedId, setSelectedId] = useState(initial?.characterId ?? "");
	const character = gm
		? (characters.find((item) => item.characterId === selectedId) ?? initial)
		: initial;
	const resolvedId = character?.characterId ?? characterId ?? null;
	const skills = useMemo(() => skillKeysFor(character), [character]);
	const [skillKey, setSkillKey] = useState<string>(DEFAULT_SKILL);
	const [query, setQuery] = useState("");
	const [difficulty, setDifficulty] = useState<coc7e.CheckDifficulty>(
		"regular",
	);
	const [modifier, setModifier] = useState<Modifier>("0");
	const value = skillValue(character, skillKey);
	const threshold =
		value === null ? null : difficultyThreshold(value, difficulty);

	useEffect(() => {
		if (!skills.includes(skillKey)) {
			setSkillKey(
				skills.includes(DEFAULT_SKILL) ? DEFAULT_SKILL : (skills[0] ?? DEFAULT_SKILL),
			);
		}
	}, [skillKey, skills]);

	const quickSkills = useMemo(() => {
		const keys = QUICK_SKILLS.filter((key) => skills.includes(key)) as string[];
		return keys.includes(skillKey) ? keys : [...keys, skillKey];
	}, [skillKey, skills]);

	const needle = query.trim().toLowerCase();
	const searching = needle !== "";
	const [activeIndex, setActiveIndex] = useState(0);
	const listId = useId();
	const results = useMemo(
		() =>
			needle === ""
				? []
				: skills.filter((key) =>
						[key, coc7e.coc7eSkillLabel(key)].some((text) =>
							text.toLowerCase().includes(needle),
						),
					),
		[needle, skills],
	);

	function pickSkill(key: string) {
		setSkillKey(key);
		setQuery("");
	}

	function check() {
		if (!resolvedId) {
			onError(t("dice.noCharacter"));
			return;
		}
		const amount = Number(modifier);
		const sent = sendSessionCommand("check:perform", {
			characterId: resolvedId,
			skillKey,
			difficulty,
			bonusDice: Math.max(amount, 0),
			penaltyDice: Math.max(-amount, 0),
			...(gm && hidden ? { hidden: true } : {}),
		});
		if (!sent) {
			onError(t("chat.notConnected"));
			return;
		}
		onSubmitted?.();
	}

	if (!active) return null;

	if (!resolvedId) {
		return (
			<div
				role="status"
				className="bg-md-surface-container flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center"
			>
				<UserX
					className="text-md-on-surface-variant size-6"
					aria-hidden="true"
				/>
				<p className="text-md-on-surface text-title-small-emph">
					{t("dice.noCharacter")}
				</p>
				<p className="text-md-on-surface-variant text-pretty text-body-small">
					{gm ? t("dice.noCharacterGmHint") : t("dice.noCharacterPlayerHint")}
				</p>
			</div>
		);
	}

	const skillName = coc7e.coc7eSkillLabel(skillKey);
	const modifierCount = Number(modifier);
	const submitDetail = [
		gm ? skillName : t("dice.checkSkill", { skill: skillName }),
		threshold === null
			? difficultyLabel(difficulty)
			: `${difficultyLabel(difficulty)} ${threshold}`,
		modifierCount === 0 ? null : modifierLabel(modifier).short,
	]
		.filter(Boolean)
		.join(" · ");
	const submitName = gm ? (character?.name ?? null) : null;
	const submitLabel = [
		gm && hidden ? t("dice.hidden") : null,
		submitName,
		submitDetail,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex min-w-0 flex-col gap-3.5">
			{gm ? (
				<Field label={t("dice.target")}>
					<Select value={resolvedId} onValueChange={setSelectedId}>
						<SelectTrigger
							className="h-10 w-full text-label-large"
							aria-label={t("dice.target")}
						>
							<SelectValue
								placeholder={t("dice.target")}
								className="min-w-0 truncate"
							/>
						</SelectTrigger>
						<SelectContent>
							{characters.map((item) => (
								<SelectItem key={item.characterId} value={item.characterId}>
									<span className="truncate">{item.name}</span>
									<Badge
										variant="soft"
										tone={item.kind === "npc" ? "warning" : "default"}
										size="sm"
									>
										{item.kind === "npc" ? "NPC" : "PC"}
									</Badge>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			) : null}

			<Field
				label={t("dice.skill")}
				aside={
					searching ? (
						<span className="text-md-on-surface-variant text-label-medium">
							{t("dice.currentSkill", { skill: skillName })}
							<span className="ml-1 font-mono tabular-nums">
								{value ?? "—"}
							</span>
						</span>
					) : null
				}
			>
				<InputGroup className="h-10">
					<InputGroupAddon>
						<Search aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						role="combobox"
						aria-expanded={searching}
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={
							searching && results[activeIndex]
								? `${listId}-${activeIndex}`
								: undefined
						}
						value={query}
						disabled={disabled}
						aria-label={t("dice.skillSearch")}
						placeholder={t("dice.skillSearchPlaceholder")}
						className="text-label-large"
						onInput={(event) => {
							setQuery(event.currentTarget.value);
							setActiveIndex(0);
						}}
						onKeyDown={(event) => {
							if (!searching || event.nativeEvent.isComposing) return;
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								if (results.length === 0) return;
								const step = event.key === "ArrowDown" ? 1 : -1;
								setActiveIndex(
									(index) => (index + step + results.length) % results.length,
								);
							} else if (event.key === "Enter") {
								event.preventDefault();
								const key = results[activeIndex];
								if (key) pickSkill(key);
							} else if (event.key === "Escape") {
								event.preventDefault();
								event.stopPropagation();
								setQuery("");
							}
						}}
					/>
				</InputGroup>
				{!searching ? (
					<div
						role="group"
						aria-label={t("dice.quickSkills")}
						className="flex flex-wrap gap-1.5"
					>
						{quickSkills.map((key) => (
							<QuickPickChip
								key={key}
								selected={key === skillKey}
								disabled={disabled}
								value={skillValue(character, key) ?? "—"}
								onSelect={() => pickSkill(key)}
							>
								{coc7e.coc7eSkillLabel(key)}
							</QuickPickChip>
						))}
					</div>
				) : results.length === 0 ? (
					<div
						role="status"
						className="bg-md-surface-container flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg px-3 py-3 text-center"
					>
						<p className="text-md-on-surface-variant text-body-small">
							{t("dice.skillNoMatch")}
						</p>
						<Button
							type="button"
							variant="text"
							size="xs"
							onClick={() => setQuery("")}
						>
							{t("dice.clearSkillSearch")}
						</Button>
					</div>
				) : (
					<ul
						id={listId}
						role="listbox"
						aria-label={t("dice.skillResults")}
						className="bg-md-surface-container flex max-h-44 min-h-24 flex-col overflow-y-auto overscroll-contain rounded-lg p-1 [scrollbar-width:thin]"
					>
						{results.map((key, index) => {
							const selected = key === skillKey;
							const highlighted = index === activeIndex;
							return (
								<li
									key={key}
									id={`${listId}-${index}`}
									role="option"
									aria-selected={highlighted}
									className={cn(
										"text-md-on-surface flex h-9 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 text-label-large",
										highlighted
											? "bg-md-on-surface/12"
											: "hover:bg-md-on-surface/8",
									)}
									onMouseEnter={() => setActiveIndex(index)}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => pickSkill(key)}
								>
									<span className="flex min-w-0 items-center gap-2">
										<Check
											className={cn(
												"text-accent size-4 shrink-0",
												!selected && "invisible",
											)}
											aria-hidden="true"
										/>
										<span className="truncate">
											{coc7e.coc7eSkillLabel(key)}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-2">
										{highlighted ? (
											<kbd className="text-md-on-surface-variant border-md-outline-variant rounded border px-1 font-sans text-label-small">
												Enter
											</kbd>
										) : null}
										<span className="text-md-on-surface-variant font-mono tabular-nums">
											{skillValue(character, key) ?? "—"}
										</span>
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</Field>

			<Field label={t("dice.difficulty")}>
				<SegmentedControl<coc7e.CheckDifficulty>
					aria-label={t("dice.difficultyAria")}
					value={difficulty}
					onValueChange={setDifficulty}
					className="bg-md-surface-container w-full gap-1"
					itemClassName="h-auto min-h-11 flex-col gap-0 px-2 py-1"
					options={DIFFICULTIES.map((item) => ({
						value: item,
						disabled,
						label: (
							<>
								<span className="text-label-medium">
									{difficultyLabel(item)}
								</span>
								<span className="font-mono text-label-large tabular-nums">
									{value === null ? "—" : difficultyThreshold(value, item)}
								</span>
							</>
						),
					}))}
				/>
			</Field>

			<Field label={t("dice.modifier")}>
				<SegmentedControl<Modifier>
					aria-label={t("dice.modifier")}
					value={modifier}
					onValueChange={setModifier}
					className="bg-md-surface-container w-full gap-1"
					itemClassName={cn("h-9 px-1 text-label-medium")}
					options={MODIFIERS.map((item) => {
						const label = modifierLabel(item);
						return {
							value: item,
							disabled,
							label: (
								<>
									<span aria-hidden="true">{label.short}</span>
									<span className="sr-only">{label.full}</span>
								</>
							),
						};
					})}
				/>
			</Field>

			{gm ? (
				<HiddenRollSwitch
					checked={hidden}
					disabled={disabled}
					onCheckedChange={onHiddenChange}
				/>
			) : null}

			<Button
				type="button"
				variant={gm && hidden ? "warning" : "primary"}
				size="sm"
				className="h-11 w-full gap-1"
				aria-label={submitLabel}
				onClick={check}
				disabled={disabled}
			>
				{gm && hidden ? (
					<EyeOff data-icon="inline-start" />
				) : (
					<Dices data-icon="inline-start" />
				)}
				{submitName ? (
					<>
						<span className="min-w-0 truncate">{submitName}</span>
						<span aria-hidden="true" className="opacity-60">
							｜
						</span>
					</>
				) : null}
				<span className="shrink-0">{submitDetail}</span>
			</Button>
		</div>
	);
}
