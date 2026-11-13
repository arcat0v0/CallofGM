import { Dices, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { skillKeysFor, skillValue } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";

const DICE_PRESETS = ["1d100", "1d6", "1d4", "1d8", "1d10", "3d6"];

function FieldLabel({ children }: { children: string }) {
	return (
		<span className="text-md-on-surface-variant text-label-small">
			{children}
		</span>
	);
}

function DiceTray({
	characterId,
	className,
	gm = false,
	disabled = false,
	onSubmitted,
}: {
	characterId?: string | null;
	className?: string;
	gm?: boolean;
	disabled?: boolean;
	onSubmitted?: () => void;
}) {
	const characters = usePlayStore((state) => state.characters);
	const [tab, setTab] = useState<"roll" | "check">("roll");
	const [selectedId, setSelectedId] = useState(characterId ?? "");
	const resolvedId = gm
		? selectedId || characterId || characters[0]?.characterId
		: characterId;
	const character = characters.find((item) => item.characterId === resolvedId);
	const rule = getRuleComponent(character?.ruleId);
	const skills = useMemo(() => skillKeysFor(character), [character]);
	const [expression, setExpression] = useState("1d100");
	const [comment, setComment] = useState("");
	const [skillKey, setSkillKey] = useState(
		skills[0] ?? t("gm.console.defaultSkill"),
	);
	const [difficulty, setDifficulty] = useState<"regular" | "hard" | "extreme">(
		"regular",
	);
	const [bonusDice, setBonusDice] = useState(0);
	const [penaltyDice, setPenaltyDice] = useState(0);
	const [hidden, setHidden] = useState(false);
	const value = skillValue(character, skillKey);

	useEffect(() => {
		if (!skills.includes(skillKey)) {
			setSkillKey(skills[0] ?? t("gm.console.defaultSkill"));
		}
	}, [skillKey, skills]);

	function roll() {
		const sent = sendSessionCommand("dice:roll", {
			expression,
			...(comment.trim() ? { comment: comment.trim() } : {}),
			...(gm && hidden ? { hidden: true } : {}),
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		onSubmitted?.();
	}

	function check() {
		if (!resolvedId) {
			toast.error(t("dice.noCharacter"));
			return;
		}
		const sent = sendSessionCommand("check:perform", {
			characterId: resolvedId,
			skillKey,
			difficulty,
			bonusDice,
			penaltyDice,
			...(gm && hidden ? { hidden: true } : {}),
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		onSubmitted?.();
	}

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<SegmentedControl
				value={tab}
				options={[
					{ value: "roll", label: t("dice.tabRoll") },
					{ value: "check", label: t("dice.tabCheck") },
				]}
				onValueChange={setTab}
				aria-label={t("dice.panelTitle")}
				className="bg-md-surface-container-high/70 w-full p-0.5"
				itemClassName="h-8 px-3 text-label-medium"
			/>

			{tab === "roll" ? (
				<div className="flex flex-col gap-2.5">
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.presets")}</FieldLabel>
						<div className="grid grid-cols-6 gap-1">
							{DICE_PRESETS.map((preset) => {
								const active = expression === preset;
								return (
									<Button
										key={preset}
										type="button"
										variant={active ? "accentSoft" : "tertiary"}
										size="xs"
										disabled={disabled}
										aria-pressed={active}
										onClick={() => setExpression(preset)}
										className="h-8 px-0 text-label-small"
									>
										{preset}
									</Button>
								);
							})}
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.expression")}</FieldLabel>
						<Input
							value={expression}
							aria-label={t("dice.expression")}
							onChange={(event) => setExpression(event.target.value)}
							disabled={disabled}
							className="h-9 text-label-medium"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.comment")}</FieldLabel>
						<Input
							value={comment}
							aria-label={t("dice.comment")}
							onChange={(event) => setComment(event.target.value)}
							placeholder={t("dice.comment")}
							disabled={disabled}
							className="h-9 text-label-medium"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							variant="primary"
							size="sm"
							className="h-10 flex-1"
							disabled={disabled}
							onClick={roll}
						>
							<Dices className="size-4" />
							{t("dice.roll")}
						</Button>
						{gm ? (
							<Button
								type="button"
								variant={hidden ? "dangerSoft" : "tertiary"}
								size="xs"
								className="h-10 shrink-0 px-3 text-label-small"
								disabled={disabled}
								onClick={() => setHidden((value) => !value)}
							>
								<EyeOff className="size-3.5" />
								{hidden ? t("dice.hidden") : t("dice.public")}
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{gm ? (
						<div className="flex flex-col gap-1.5">
							<FieldLabel>{t("dice.target")}</FieldLabel>
							<Select value={resolvedId ?? ""} onValueChange={setSelectedId}>
								<SelectTrigger
									className="h-9 w-full text-label-medium"
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
											{item.name} · {item.kind === "npc" ? "NPC" : "PC"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.skill")}</FieldLabel>
						<Select
							value={skillKey}
							onValueChange={setSkillKey}
							disabled={disabled}
						>
							<SelectTrigger
								className="h-9 w-full text-label-medium"
								aria-label={t("dice.skillAria")}
							>
								<SelectValue
									placeholder={t("dice.skill")}
									className="min-w-0 truncate"
								/>
							</SelectTrigger>
							<SelectContent>
								{skills.map((skill) => (
									<SelectItem key={skill} value={skill}>
										{rule.skillLabel(skill)}
										{skillValue(character, skill) !== null
											? ` ${skillValue(character, skill)}`
											: ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.difficulty")}</FieldLabel>
						<Select
							value={difficulty}
							onValueChange={(next) => setDifficulty(next as typeof difficulty)}
							disabled={disabled}
						>
							<SelectTrigger
								className="h-9 w-full text-label-medium"
								aria-label={t("dice.difficultyAria")}
							>
								<SelectValue className="min-w-0 truncate" />
							</SelectTrigger>
							<SelectContent>
								{(["regular", "hard", "extreme"] as const).map((item) => (
									<SelectItem key={item} value={item}>
										{rule.difficultyLabel(item)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.modifier")}</FieldLabel>
						<div className="grid grid-cols-2 gap-1.5">
							<Button
								type="button"
								size="xs"
								variant={bonusDice ? "accentSoft" : "tertiary"}
								className="h-9"
								disabled={disabled}
								onClick={() => setBonusDice((n) => (n + 1) % 3)}
							>
								{t("dice.bonus", { count: bonusDice })}
							</Button>
							<Button
								type="button"
								size="xs"
								variant={penaltyDice ? "dangerSoft" : "tertiary"}
								className="h-9"
								disabled={disabled}
								onClick={() => setPenaltyDice((n) => (n + 1) % 3)}
							>
								{t("dice.penalty", { count: penaltyDice })}
							</Button>
						</div>
					</div>
					{gm ? (
						<Button
							type="button"
							size="xs"
							variant={hidden ? "dangerSoft" : "tertiary"}
							className="h-8 self-start px-3 text-label-small"
							disabled={disabled}
							onClick={() => setHidden((value) => !value)}
						>
							{hidden ? t("dice.hidden") : t("dice.public")}
						</Button>
					) : null}
					<Button
						type="button"
						variant="primary"
						size="sm"
						className="h-10 w-full"
						onClick={check}
						disabled={disabled || !resolvedId}
					>
						{value !== null
							? t("dice.checkWithValue", { value })
							: t("dice.check")}
					</Button>
				</div>
			)}
		</div>
	);
}

export { DiceTray };
