import { Dices } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { HiddenRollSwitch } from "./hidden-roll-switch";
import { QuickPickChip } from "./quick-pick-chip";
import { showCommandError, usePlayStore } from "@/stores/play-store";

const DICE_PRESETS = ["1d100", "1d6", "1d4", "1d8", "1d10", "3d6"];

function FieldLabel({ children }: { children: string }) {
	return (
		<span className="text-md-on-surface-variant px-0.5 text-label-medium">
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
	const resolvedId = gm
		? characterId || characters[0]?.characterId
		: characterId;
	const character = characters.find((item) => item.characterId === resolvedId);
	const ruleId = usePlayStore((state) => state.ruleId);
	const ruleState = usePlayStore((state) => state.ruleState);
	const CheckTray = getRuleComponent(character?.ruleId ?? ruleId).diceTray;
	const [expression, setExpression] = useState("1d100");
	const [comment, setComment] = useState("");
	const [hidden, setHidden] = useState(false);
	function roll() {
		const sent = sendSessionCommand("dice:roll", {
			expression,
			...(comment.trim() ? { comment: comment.trim() } : {}),
			...(gm && hidden ? { hidden: true } : {}),
		});
		if (!sent) {
			showCommandError(t("chat.notConnected"));
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
				className="bg-md-surface-container w-full gap-1"
				itemClassName="h-9 px-3 text-label-large"
			/>

			{tab === "roll" ? (
				<div className="flex flex-col gap-3.5">
					<div className="flex flex-col gap-1.5">
						<FieldLabel>{t("dice.presets")}</FieldLabel>
						<div className="flex flex-wrap gap-1.5">
							{DICE_PRESETS.map((preset) => (
								<QuickPickChip
									key={preset}
									selected={expression === preset}
									disabled={disabled}
									className="font-mono"
									onSelect={() => setExpression(preset)}
								>
									{preset}
								</QuickPickChip>
							))}
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
							placeholder={t("dice.commentPlaceholder")}
							disabled={disabled}
							className="h-9 text-label-medium"
						/>
					</div>
					{gm ? (
							<HiddenRollSwitch
								checked={hidden}
								disabled={disabled}
								onCheckedChange={setHidden}
							/>
						) : null}
						<Button
							type="button"
							variant="primary"
							size="sm"
							className="h-11 w-full"
							disabled={disabled}
							onClick={roll}
						>
							<Dices data-icon="inline-start" />
							{t("dice.roll")}
						</Button>
				</div>
			) : null}
			<CheckTray
				active={tab === "check"}
				characterId={resolvedId}
				character={character}
				characters={characters}
				gm={gm}
				disabled={disabled}
				hidden={hidden}
				onHiddenChange={setHidden}
				onError={showCommandError}
				ruleState={ruleState}
				onSubmitted={onSubmitted}
			/>
		</div>
	);
}

/** 弹层内输入框有内容时，Esc 先交给输入框清空，而不是关闭弹层。 */
function keepEscapeForFilledInput(event: KeyboardEvent) {
	const target = event.target;
	if (target instanceof HTMLInputElement && target.value !== "") {
		event.preventDefault();
	}
}

export { DiceTray, keepEscapeForFilledInput };
