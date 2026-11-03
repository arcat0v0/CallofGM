import { coc7e } from "@cogm/shared";
import { Dices, EyeOff, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { skillKeysFor, skillValue } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { GmField, GmPanelShell, GmSelectField } from "./gm-panel-fields";

type CheckType = "skill" | "san";
type DiceMode = "none" | "bonus-1" | "bonus-2" | "penalty-1" | "penalty-2";

function diceModeOf(bonusDice: number, penaltyDice: number): DiceMode {
	if (bonusDice > 0) {
		return bonusDice > 1 ? "bonus-2" : "bonus-1";
	}
	if (penaltyDice > 0) {
		return penaltyDice > 1 ? "penalty-2" : "penalty-1";
	}
	return "none";
}

function CheckPanel({ onClose }: { onClose: () => void }) {
	const characters = usePlayStore((state) => state.characters);
	const [characterId, setCharacterId] = useState("");
	const [type, setType] = useState<CheckType>("skill");
	const [skillKey, setSkillKey] = useState("");
	const [difficulty, setDifficulty] = useState<"regular" | "hard" | "extreme">(
		"regular",
	);
	const [bonusDice, setBonusDice] = useState(0);
	const [penaltyDice, setPenaltyDice] = useState(0);
	const [hidden, setHidden] = useState(true);
	const [sanLoss, setSanLoss] = useState("1/1d6");
	const selected =
		characters.find((character) => character.characterId === characterId) ??
		characters.find((character) => character.kind === "pc") ??
		characters[0] ??
		null;
	const skills = skillKeysFor(selected ?? undefined);
	const resolvedSkill = skills.includes(skillKey)
		? skillKey
		: (skills[0] ?? "");
	const diceMode = diceModeOf(bonusDice, penaltyDice);
	const ready = Boolean(selected);
	const sanReady = sanLoss.trim().length > 0;
	const targetValue =
		selected && type === "skill" ? skillValue(selected, resolvedSkill) : null;
	const summary = selected
		? [
				selected.name,
				type === "san"
					? t("gm.workbench.sanCheck")
					: coc7e.coc7eSkillLabel(resolvedSkill),
				...(type === "skill" ? [coc7e.CheckDifficultyLabel[difficulty]] : []),
				...(hidden ? [t("gm.workbench.hiddenShort")] : []),
			].join(" · ")
		: t("gm.console.targetPlaceholder");

	function send(
		command: "check:perform" | "check:request" | "check:san",
		payload: Record<string, unknown>,
	) {
		const sent = sendSessionCommand(command, payload);
		if (!sent) {
			toast.error(t("chat.notConnected"));
		}
	}

	function perform() {
		if (!selected) {
			return;
		}
		if (type === "san") {
			send("check:san", {
				characterId: selected.characterId,
				sanLossExpression: sanLoss,
				hidden,
			});
			return;
		}
		send("check:perform", {
			characterId: selected.characterId,
			skillKey: resolvedSkill,
			difficulty,
			bonusDice,
			penaltyDice,
			hidden,
		});
	}

	function request() {
		if (!selected) {
			return;
		}
		send("check:request", {
			characterId: selected.characterId,
			skillKey: resolvedSkill,
			difficulty,
			bonusDice,
			penaltyDice,
			hidden,
		});
	}

	function changeDiceMode(value: DiceMode) {
		setBonusDice(value === "bonus-1" ? 1 : value === "bonus-2" ? 2 : 0);
		setPenaltyDice(value === "penalty-1" ? 1 : value === "penalty-2" ? 2 : 0);
	}

	return (
		<div data-rules-target={selected?.characterId ?? ""}>
			<GmPanelShell
				title={t("gm.workbench.checkTitle")}
				subtitle={t("gm.workbench.checkSubtitle")}
				onClose={onClose}
				footer={
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-md-on-surface min-w-0 truncate text-label-medium">
								{summary}
							</p>
							{targetValue != null ? (
								<span className="bg-md-primary-container text-md-on-primary-container shrink-0 rounded-full px-2.5 py-0.5 font-mono text-label-small">
									{t("gm.workbench.targetValue", { value: targetValue })}
								</span>
							) : null}
						</div>
						<div className="flex items-center justify-between gap-2">
							<span className="text-md-on-surface-variant/80 min-w-0 flex-1 text-label-small">
								{type === "skill" && selected?.kind === "npc"
									? t("gm.workbench.npcRequestUnavailable")
									: ""}
							</span>
							<div className="flex shrink-0 items-center gap-2">
								<Button
									type="button"
									variant={
										type === "skill" && selected?.kind === "pc"
											? "ghost"
											: "primary"
									}
									size="sm"
									className="h-12"
									disabled={!ready || (type === "san" && !sanReady)}
									onClick={perform}
								>
									<Dices className="size-4" />
									{type === "san"
										? t("gm.workbench.performSan")
										: hidden
											? t("gm.workbench.performHidden")
											: t("gm.workbench.performDirect")}
								</Button>
								{type === "skill" ? (
									<Button
										type="button"
										variant="primary"
										size="sm"
										className="h-12 px-4"
										disabled={!ready || selected?.kind !== "pc"}
										onClick={request}
									>
										<Send className="size-4" />
										{t("gm.workbench.sendRequest")}
									</Button>
								) : null}
							</div>
						</div>
					</div>
				}
			>
				<div className="flex items-stretch gap-2">
					<GmSelectField
						label={t("gm.workbench.checkType")}
						value={type}
						className="flex-1"
						onValueChange={(value) => setType(value as CheckType)}
					>
						<SelectItem value="skill">
							{t("gm.workbench.skillCheck")}
						</SelectItem>
						<SelectItem value="san">{t("gm.workbench.sanCheck")}</SelectItem>
					</GmSelectField>
					<GmSelectField
						label={t("gm.workbench.checkTarget")}
						value={selected?.characterId ?? ""}
						className="flex-1"
						onValueChange={setCharacterId}
						placeholder={t("gm.console.targetPlaceholder")}
						disabled={characters.length === 0}
					>
						{characters.map((character) => (
							<SelectItem
								key={character.characterId}
								value={character.characterId}
							>
								{character.name}
							</SelectItem>
						))}
					</GmSelectField>
				</div>

				{type === "skill" ? (
					<>
						<GmSelectField
							label={t("gm.workbench.skillOrAttribute")}
							value={resolvedSkill}
							onValueChange={setSkillKey}
							disabled={!selected}
						>
							{skills.map((key) => (
								<SelectItem key={key} value={key}>
									{coc7e.coc7eSkillLabel(key)}
								</SelectItem>
							))}
						</GmSelectField>
						<div className="flex items-stretch gap-2">
							<GmSelectField
								label={t("gm.workbench.difficulty")}
								value={difficulty}
								className="flex-1"
								onValueChange={(value) =>
									setDifficulty(value as typeof difficulty)
								}
							>
								{(["regular", "hard", "extreme"] as const).map((item) => (
									<SelectItem key={item} value={item}>
										{coc7e.CheckDifficultyLabel[item]}
									</SelectItem>
								))}
							</GmSelectField>
							<GmSelectField
								label={t("gm.workbench.diceModifier")}
								value={diceMode}
								className="flex-1"
								onValueChange={(value) => changeDiceMode(value as DiceMode)}
							>
								<SelectItem value="none">
									{t("gm.workbench.diceNone")}
								</SelectItem>
								<SelectItem value="bonus-1">
									{t("dice.bonus", { count: 1 })}
								</SelectItem>
								<SelectItem value="bonus-2">
									{t("dice.bonus", { count: 2 })}
								</SelectItem>
								<SelectItem value="penalty-1">
									{t("dice.penalty", { count: 1 })}
								</SelectItem>
								<SelectItem value="penalty-2">
									{t("dice.penalty", { count: 2 })}
								</SelectItem>
							</GmSelectField>
						</div>
					</>
				) : (
					<GmField label={t("gm.workbench.sanLoss")}>
						<Input
							value={sanLoss}
							aria-label={t("gm.console.sanLossAria")}
							className="h-7 rounded-none border-0 bg-transparent px-0 py-0 text-label-large hover:bg-transparent focus-visible:ring-0"
							onChange={(event) => setSanLoss(event.target.value)}
						/>
					</GmField>
				)}

				<div className="bg-md-primary-container/40 border-md-primary/25 flex items-center gap-3 rounded-lg border p-3.5 2xl:gap-4 2xl:p-4">
					<EyeOff className="text-md-primary size-5 shrink-0" />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-md-on-primary-container text-title-small-emph 2xl:text-title-medium-emph">
							{t("gm.workbench.hiddenCheck")}
						</span>
						<span className="text-md-on-primary-container/85 text-label-small 2xl:text-label-medium">
							{t("gm.workbench.hiddenCheckDescription")}
						</span>
					</div>
					<Switch
						checked={hidden}
						aria-label={t("gm.workbench.hiddenCheck")}
						onCheckedChange={(checked) => setHidden(Boolean(checked))}
					/>
				</div>
			</GmPanelShell>
		</div>
	);
}

export { CheckPanel };
