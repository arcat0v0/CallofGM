import { useState } from "react";
import { toast } from "sonner";
import { coc7e } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import type {
	ChatCheckView,
	ChatMessage,
	ChatRollView,
} from "@/features/chat/types";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import { PAPER_VARS, PaperSheet as Sheet } from "./paper-sheet";

type SystemMessageView = Omit<ChatMessage, "sortKey"> & {
	sortKey?: number;
};

function ornamentMask(src: string): React.CSSProperties {
	const maskImage = `url("${src}")`;
	return {
		maskImage,
		WebkitMaskImage: maskImage,
		maskRepeat: "no-repeat",
		WebkitMaskRepeat: "no-repeat",
		maskPosition: "center",
		WebkitMaskPosition: "center",
		maskSize: "100% 100%",
		WebkitMaskSize: "100% 100%",
	};
}

function PhaseDivider({
	message,
	className,
}: {
	message: SystemMessageView;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex w-full flex-col items-center gap-2 rounded-xl border border-[#c9b98f]/35 bg-[#15130f]/78 px-3 py-4 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-sm",
				className,
			)}
			style={{ ...PAPER_VARS, color: "var(--phase-olive)" }}
		>
			<span
				aria-hidden="true"
				data-phase-ornament="sigil"
				className="block size-11 bg-[var(--phase-olive)] opacity-90"
				style={ornamentMask("/cthulhu/sigil.svg")}
			/>
			<div className="flex w-full items-center gap-2 text-[var(--phase-ink-2)]">
				<span
					aria-hidden="true"
					data-phase-ornament="divider"
					className="block h-3 min-w-0 flex-1 bg-[var(--phase-ink-2)] opacity-90"
					style={ornamentMask("/cthulhu/divider-ornament.svg")}
				/>
				<span className="shrink-0 rounded-full border border-[#c9b98f]/45 bg-[#211d15]/90 px-2.5 py-1 font-mono text-label-small font-semibold tracking-[0.14em] text-[var(--phase-ink)] shadow-[0_1px_0_rgba(255,255,255,.08)]">
					{t("chat.phaseRecord")}
				</span>
				<span
					aria-hidden="true"
					data-phase-ornament="divider"
					className="block h-3 min-w-0 flex-1 bg-[var(--phase-ink-2)] opacity-90"
					style={ornamentMask("/cthulhu/divider-ornament.svg")}
				/>
			</div>
			<h2 className="text-center font-serif text-headline-small-emph tracking-[0.22em] text-[var(--phase-olive)] drop-shadow-[0_1px_6px_rgba(0,0,0,.65)]">
				{message.phase?.label ?? message.body}
			</h2>
			<p className="font-mono text-label-small text-[var(--phase-ink-2)]">
				{message.time}
			</p>
		</div>
	);
}

function DiceTicket({
	message,
	roll,
	className,
}: {
	message: SystemMessageView;
	roll: ChatRollView;
	className?: string;
}) {
	const diceFaces = /^(\d+)d(\d+)/i.exec(roll.expression);
	const dieLabel = diceFaces
		? `d${diceFaces[2] ?? ""}`
		: t("message.diceFallback");
	const chips =
		roll.dice.length > 0 || roll.modifier !== undefined
			? [
					...roll.dice.map((value, index) => ({
						key: `die-${index}`,
						label: String(value),
					})),
					...(roll.modifier !== undefined
						? [
								{
									key: "modifier",
									label:
										roll.modifier >= 0
											? `+${roll.modifier}`
											: String(roll.modifier),
								},
							]
						: []),
				]
			: [{ key: "single", label: t("chat.singleNoModifier") }];
	return (
		<Sheet>
			<div className={cn("relative z-1 flex flex-col gap-2", className)}>
				<div className="flex items-center gap-2 border-b border-[var(--paper-line)] pb-2">
					<span className="truncate font-mono text-label-large-emph">
						{message.speakerName}
					</span>
					<span className="font-mono text-label-small text-[var(--paper-ink-2)]">
						{message.hidden ? t("chat.rollPrivate") : t("chat.rollPublic")}
					</span>
					<span className="ml-auto shrink-0 font-mono text-label-small text-[var(--paper-ink-2)]">
						{message.time}
					</span>
				</div>
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="font-mono text-body-medium">{roll.expression}</span>
					<span className="font-serif text-ticket-total leading-none tabular-nums">
						{roll.total}
					</span>
					<span className="-rotate-3 border border-[var(--paper-line)] px-1.5 py-0.5 font-serif text-body-medium text-[var(--paper-ink-2)]">
						{dieLabel}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					{chips.map((chip) => (
						<span
							key={chip.key}
							className="border border-[var(--paper-line)] bg-[rgba(255,250,235,.32)] px-2 py-0.5 font-mono text-label-small text-[var(--paper-ink-2)]"
						>
							{chip.label}
						</span>
					))}
				</div>
				{roll.comment ? (
					<p className="break-words font-mono text-label-small text-[var(--paper-ink-2)]">
						{roll.comment}
					</p>
				) : null}
				<span className="-rotate-3 self-end border border-[var(--ink-olive)] px-2 py-0.5 font-mono text-label-small text-[var(--ink-olive)] opacity-80">
					{message.hidden ? t("chat.private") : t("chat.public")}
				</span>
			</div>
		</Sheet>
	);
}

function outcomeStyle(outcome: ChatCheckView["outcome"]) {
	if (outcome === "critical")
		return { color: "var(--ink-gold)", stamp: "stamp-critical" };
	if (outcome === "fumble")
		return { color: "var(--ink-red)", stamp: "stamp-fumble" };
	if (outcome === "failure")
		return { color: "var(--ink-red)", stamp: "stamp-failure" };
	return { color: "var(--ink-olive)", stamp: "stamp-success" };
}

function CheckVerdict({
	message,
	check,
	allowLuckSpend = false,
	className,
}: {
	message: SystemMessageView;
	check: ChatCheckView;
	allowLuckSpend?: boolean;
	className?: string;
}) {
	const tone = outcomeStyle(check.outcome);
	const characters = usePlayStore((state) => state.characters);
	const viewer = usePlayStore((state) => state.viewer);
	const messages = usePlayStore((state) => state.messages);
	const settings = usePlayStore((state) => state.settings);
	const sessionRules = coc7e.parseCoc7eSessionRules(
		settings.ruleSettings?.coc7e,
	);
	const [pendingPoints, setPendingPoints] = useState<number | null>(null);
	const claimed = characters.find(
		(character) =>
			character.claim?.holderKind === viewer.holderKind &&
			character.claim?.holderId === viewer.holderId &&
			character.claim.role === "pc",
	);
	const isOwn = Boolean(
		check.characterId && claimed?.characterId === check.characterId,
	);
	let latestSortKey: number | null = null;
	for (const item of messages) {
		if (item.check?.characterId !== check.characterId) {
			continue;
		}
		latestSortKey =
			latestSortKey === null
				? item.sortKey
				: Math.max(latestSortKey, item.sortKey);
	}
	const isLatest =
		isOwn && message.sortKey !== undefined && latestSortKey === message.sortKey;
	const rule = getRuleComponent(claimed?.ruleId);
	const characterState = rule.parseState(claimed?.state);
	const luck =
		characterState?.luck ??
		(claimed?.sheet ? rule.deriveStats(claimed.sheet)?.luck : null) ??
		0;
	const canSpendLuck =
		allowLuckSpend &&
		sessionRules.allowLuckSpend &&
		isOwn &&
		isLatest &&
		message.eventId !== undefined &&
		check.skillKey !== "luck" &&
		check.skillKey !== "san" &&
		check.outcomeKey !== "fumble" &&
		check.outcomeKey !== "critical" &&
		check.luckSpent === undefined &&
		check.pushed !== true;
	const options =
		canSpendLuck && check.skillKey && check.outcomeKey
			? rule.luckSpendOptions(
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
		if (!check.characterId || message.eventId === undefined) {
			return;
		}
		const sent = sendSessionCommand("check:spend-luck", {
			characterId: check.characterId,
			eventId: message.eventId,
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
		<Sheet>
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
					{message.eventId !== undefined ? (
						<span>NO. {String(message.eventId).padStart(3, "0")}</span>
					) : null}
				</div>
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-serif text-title-large-emph">
							{check.skill}
						</span>
						<span className="truncate font-mono text-label-small text-[var(--paper-ink-2)]">
							{message.speakerName} ·{" "}
							{check.skillNote ? `${check.skillNote} · ` : ""}
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
						{message.time}
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
		</Sheet>
	);
}

function Sealed({
	message,
	className,
}: {
	message: SystemMessageView;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center gap-3 rounded-md border-[1.5px] border-dashed border-[rgba(214,220,196,.35)] bg-[rgba(214,220,196,.03)] px-3 py-2.5",
				className,
			)}
			style={{ ...PAPER_VARS, color: "var(--ink-red)" }}
		>
			<img
				src="/cthulhu/wax-seal.svg"
				alt=""
				aria-hidden="true"
				className="size-8 shrink-0"
			/>
			<div className="flex min-w-0 flex-col">
				<span className="truncate text-body-medium text-md-on-surface">
					<b>{message.speakerName}</b> {t("chat.sealedRoll")}
				</span>
				<span className="font-mono text-label-small text-md-on-surface-variant">
					SEALED · {t("chat.sealedOnlyGM")}
				</span>
			</div>
			<span className="ml-auto shrink-0 font-mono text-label-small text-md-on-surface-variant">
				{message.time}
			</span>
		</div>
	);
}

function LegacySystemMessage({
	message,
	className,
}: {
	message: SystemMessageView;
	className?: string;
}) {
	const accent =
		message.outcome === "failure"
			? "text-danger border-l-danger"
			: message.outcome === "success"
				? "text-md-primary border-l-md-primary"
				: "text-md-on-surface-variant border-l-md-outline";
	return (
		<div
			className={cn(
				"bg-md-surface-container-high border border-md-outline-variant/40 flex w-full flex-col gap-2 rounded-lg border-l-2 p-3.5",
				accent,
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate text-label-medium">
					{message.speakerName} · {message.speakerRoleLabel}
				</span>
				<span className="text-md-outline shrink-0 font-mono text-label-small">
					{message.time}
				</span>
			</div>
			<p className="text-md-on-surface text-body-medium font-semibold whitespace-pre-wrap text-pretty break-words select-text">
				{message.body}
			</p>
		</div>
	);
}

function SystemMessageCard({
	message,
	allowLuckSpend = false,
	className,
}: {
	message: SystemMessageView;
	allowLuckSpend?: boolean;
	className?: string;
}) {
	if (message.hidden && !message.gmVisible)
		return <Sealed message={message} className={className} />;
	if (message.phase)
		return <PhaseDivider message={message} className={className} />;
	if (message.roll)
		return (
			<DiceTicket message={message} roll={message.roll} className={className} />
		);
	if (message.check)
		return (
			<CheckVerdict
				message={message}
				check={message.check}
				allowLuckSpend={allowLuckSpend}
				className={className}
			/>
		);
	return <LegacySystemMessage message={message} className={className} />;
}

export type { SystemMessageView };
export { SystemMessageCard };
