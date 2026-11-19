import { coc7e } from "@cogm/shared";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import type { RuleDiceTrayProps } from "../types";
import { difficultyLabel, skillKeysFor, skillValue } from "./sheet-data";

function FieldLabel({ children }: { children: string }) {
	return (
		<span className="text-md-on-surface-variant text-label-small">
			{children}
		</span>
	);
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
	const resolvedId = character?.characterId ?? characterId;
	const skills = useMemo(() => skillKeysFor(character), [character]);
	const [skillKey, setSkillKey] = useState(
		skills[0] ?? t("gm.console.defaultSkill"),
	);
	const [difficulty, setDifficulty] = useState<"regular" | "hard" | "extreme">(
		"regular",
	);
	const [bonusDice, setBonusDice] = useState(0);
	const [penaltyDice, setPenaltyDice] = useState(0);
	const value = skillValue(character, skillKey);

	useEffect(() => {
		if (!skills.includes(skillKey)) {
			setSkillKey(skills[0] ?? t("gm.console.defaultSkill"));
		}
	}, [skillKey, skills]);

	function check() {
		if (!resolvedId) {
			onError(t("dice.noCharacter"));
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
			onError(t("chat.notConnected"));
			return;
		}
		onSubmitted?.();
	}

	if (!active) return null;
	return (
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
								{coc7e.coc7eSkillLabel(skill)}
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
								{difficultyLabel(item)}
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
					onClick={() => onHiddenChange(!hidden)}
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
				{value !== null ? t("dice.checkWithValue", { value }) : t("dice.check")}
			</Button>
		</div>
	);
}
