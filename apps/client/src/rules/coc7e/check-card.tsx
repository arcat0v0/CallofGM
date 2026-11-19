import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ChatCheckView } from "@/features/chat/types";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import type { RuleCheckCardProps } from "../types";
import { luckSpendOptions } from "./luck";
import { parseCocSheet, parseCocState } from "./sheet-data";

function outcomeStyle(outcome: ChatCheckView["outcome"]) {
	if (outcome === "critical")
		return { color: "var(--ink-gold)", stamp: "stamp-critical" };
	if (outcome === "fumble")
		return { color: "var(--ink-red)", stamp: "stamp-fumble" };
	if (outcome === "failure")
		return { color: "var(--ink-red)", stamp: "stamp-failure" };
	return { color: "var(--ink-olive)", stamp: "stamp-success" };
}

export function CocCheckCard({
	speakerName,
	time,
	eventId,
	check,
	className,
	luckCharacter,
}: RuleCheckCardProps) {
	const tone = outcomeStyle(check.outcome);
	const [pendingPoints, setPendingPoints] = useState<number | null>(null);
	const luck =
		parseCocState(luckCharacter?.state)?.luck ??
		parseCocSheet(luckCharacter?.sheet)?.attributes.luck ??
		0;
	const options =
		luckCharacter &&
		eventId !== undefined &&
		check.skillKey &&
		check.outcomeKey &&
		check.skillKey !== "luck" &&
		check.skillKey !== "san" &&
		check.outcomeKey !== "fumble" &&
		check.outcomeKey !== "critical" &&
		check.luckSpent === undefined &&
		check.pushed !== true
			? luckSpendOptions(
					{
						skillKey: check.skillKey,
						targetValue: check.baseTarget ?? check.target,
						difficulty: check.difficultyKey ?? "regular",
						roll: check.originalRoll ?? check.roll,
						outcome: check.outcomeKey,
						luckSpent: check.luckSpent,
						pushed: check.pushed,
					},
					luck,
				)
			: [];

	function spend(points: number) {
		if (!check.characterId || eventId === undefined) {
			return;
		}
		const sent = sendSessionCommand("check:spend-luck", {
			characterId: check.characterId,
			eventId: eventId,
			points,
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		setPendingPoints(points);
		window.setTimeout(() => setPendingPoints(null), 2000);
	}
	const threshold = Math.max(
		1,
		Math.min(100, Number.isFinite(check.target) ? check.target : 0),
	);
	const rollPosition = Math.max(0, Math.min(100, check.roll));
	const successColor =
		check.outcome === "critical"
			? "rgba(138,100,20,.35)"
			: "rgba(77,100,32,.30)";
	return (
		<>
			<img
				src="/cthulhu/sigil.svg"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute right-2 top-2 size-16 opacity-10"
			/>
			<div
				className={cn("relative z-1 flex min-w-0 flex-col gap-2.5", className)}
			>
				<div className="flex items-center justify-between gap-2 border-b border-[var(--paper-line)] pb-1.5 font-mono text-label-small text-[var(--paper-ink-2)]">
					<span>
						{check.san ? t("chat.sanityCheck") : t("chat.checkRecord")}
					</span>
					{eventId !== undefined ? (
						<span>NO. {String(eventId).padStart(3, "0")}</span>
					) : null}
				</div>
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-serif text-title-large-emph">
							{check.skill}
						</span>
						<span className="truncate font-mono text-label-small text-[var(--paper-ink-2)]">
							{speakerName} · {check.skillNote ? `${check.skillNote} · ` : ""}
							{check.difficulty}
						</span>
					</div>
					{check.luckSpent !== undefined ? (
						<span className="-rotate-3 border border-[var(--ink-red)] px-2 py-0.5 font-mono text-label-small text-[var(--ink-red)]">
							{t("chat.luckStamp", { n: check.luckSpent })}
						</span>
					) : null}
					<img
						src={`/cthulhu/${tone.stamp}.svg`}
						alt={check.label}
						className="-rotate-4 h-14 w-27 max-[420px]:h-12 max-[420px]:w-23"
						style={{ color: tone.color }}
					/>
					<span className="font-mono text-label-small text-[var(--paper-ink-2)]">
						{time}
					</span>
				</div>
				<div className="flex items-baseline gap-1.5">
					<span className="font-serif text-check-roll leading-none tabular-nums">
						{check.roll}
					</span>
					<span className="font-serif text-title-large-emph text-[var(--paper-ink-2)]">
						/ {check.target}
					</span>
					<span className="ml-2 border border-[var(--paper-line)] px-1.5 py-0.5 font-mono text-label-small text-[var(--paper-ink-2)]">
						{check.label}
					</span>
					{check.originalRoll !== undefined && check.luckSpent !== undefined ? (
						<span className="ml-1 font-mono text-label-small text-[var(--paper-ink-2)]">
							{t("chat.originalRoll", { roll: check.originalRoll })}
						</span>
					) : null}
				</div>
				{check.diceModifier ? (
					<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-label-small text-[var(--paper-ink-2)]">
						<span className="border border-[var(--paper-line)] px-1.5 py-0.5">
							{t(
								check.diceModifier.kind === "bonus"
									? "chat.diceBonusLine"
									: "chat.dicePenaltyLine",
								{ count: check.diceModifier.count },
							)}
						</span>
						<span>
							{t("chat.diceCandidates", {
								candidates: check.diceModifier.candidates.join(" / "),
							})}
						</span>
						<span>
							{t("chat.diceKept", { picked: check.diceModifier.picked })}
						</span>
					</div>
				) : null}
				<div className="relative h-7 min-w-0 overflow-hidden">
					<div
						className="absolute inset-x-0 bottom-0 h-6 border-b-[1.5px] border-[rgba(43,38,32,.4)]"
						style={{
							backgroundImage: `linear-gradient(90deg, ${successColor} 0 ${threshold}%, rgba(142,31,42,.30) ${threshold}% 100%), repeating-linear-gradient(90deg, rgba(43,38,32,.45) 0 1px, transparent 1px 10%)`,
						}}
					/>
					<div
						className="absolute bottom-0 h-4 w-0.5 bg-[var(--paper-ink)]"
						style={{ left: `${threshold}%` }}
					/>
					<div
						className="absolute bottom-[3px] size-3.5 -translate-x-1/2 rounded-full border-[2.5px] border-[var(--paper)] bg-[var(--paper-ink)] ring-[1.5px] ring-[var(--paper-ink)]"
						style={{ left: `${rollPosition}%` }}
					/>
				</div>
				<div className="flex items-center justify-between font-mono text-label-small text-[var(--paper-ink-2)]">
					<span>1</span>
					<span>{t("chat.rulerTarget", { value: check.target })}</span>
					<span>100</span>
				</div>
				{check.san ? (
					<div className="flex flex-wrap items-center gap-2 border-t border-[var(--paper-line)] pt-2 font-mono text-body-small">
						<span>{t("chat.sanityValue")}</span>
						<span className="font-serif text-title-medium-emph">
							{check.san.before} → {check.san.after}
						</span>
						<span
							className={cn(
								"px-1.5 py-0.5 text-label-small",
								check.san.loss > 0
									? "bg-[rgba(142,31,42,.14)] text-[var(--ink-red)]"
									: "bg-[rgba(43,38,32,.08)] text-[var(--paper-ink-2)]",
							)}
						>
							{t("chat.sanLoss", { n: check.san.loss })}
						</span>
					</div>
				) : null}
				{options.length > 0 ? (
					<div className="flex flex-col gap-2 border-t border-[var(--paper-line)] pt-2">
						<div className="flex flex-wrap items-baseline justify-between gap-1 font-mono text-label-small text-[var(--paper-ink-2)]">
							<span>{t("chat.spendLuck")}</span>
							<span>{t("chat.currentLuck", { luck })}</span>
						</div>
						<div className="flex flex-wrap gap-1.5">
							{options.map((option) => (
								<Button
									key={option.points}
									type="button"
									variant="tertiary"
									size="sm"
									className="h-auto min-h-11 flex-col items-start gap-0 px-3 py-1.5 text-left"
									disabled={pendingPoints !== null}
									onClick={() => spend(option.points)}
								>
									<span className="font-mono text-label-small">
										−{option.points} · {option.label}
									</span>
									<span className="font-mono text-label-small opacity-70">
										{t("chat.luckAfter", { luck: luck - option.points })}
									</span>
								</Button>
							))}
						</div>
					</div>
				) : null}
			</div>
		</>
	);
}
