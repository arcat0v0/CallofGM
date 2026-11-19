import { Dices, EyeOff } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { showCommandError, usePlayStore } from "@/stores/play-store";

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

export { DiceTray };
