import type {
	ChatCheckView,
	ChatMessage,
	ChatRollView,
} from "@/features/chat/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type SystemMessageView = Omit<ChatMessage, "sortKey"> & {
	sortKey?: number;
};

const PAPER_VARS = {
	"--paper": "#e9dfc6",
	"--paper-2": "#dfd2b2",
	"--paper-edge": "#c9b98f",
	"--paper-ink": "#2b2620",
	"--paper-ink-2": "#5c5344",
	"--paper-ink-3": "#8a7d63",
	"--ink-olive": "#4d6420",
	"--ink-red": "#8e1f2a",
	"--ink-gold": "#8a6414",
	"--paper-line": "rgba(43,38,32,.16)",
} as React.CSSProperties;

const PAPER_SURFACE: React.CSSProperties = {
	backgroundImage: [
		"radial-gradient(120px 60px at 88% 12%, rgba(120,90,40,.14), transparent 70%)",
		"radial-gradient(90px 90px at 8% 88%, rgba(120,90,40,.10), transparent 70%)",
		"repeating-linear-gradient(0deg, transparent 0 26px, rgba(43,38,32,.045) 26px 27px)",
		"linear-gradient(155deg, var(--paper), var(--paper-2))",
	].join(","),
	borderRadius: "3px 14px 4px 12px / 12px 3px 14px 4px",
	boxShadow:
		"0 10px 28px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,250,235,.35)",
};

function Sheet({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="relative min-w-0 overflow-hidden border border-[var(--paper-edge)] px-4 py-3.5 text-[var(--paper-ink)]"
			style={{ ...PAPER_VARS, ...PAPER_SURFACE }}
		>
			<img
				src="/cthulhu/corner-ornament.svg"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute left-1 top-1 size-8 opacity-30"
			/>
			{children}
		</div>
	);
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
			className={cn("flex w-full flex-col items-center gap-2 py-3", className)}
			style={{ ...PAPER_VARS, color: "var(--ink-olive)" }}
		>
			<img
				src="/cthulhu/sigil.svg"
				alt=""
				aria-hidden="true"
				className="size-11 opacity-55"
			/>
			<div className="flex w-full items-center gap-2 text-[var(--paper-ink-3)]">
				<img
					src="/cthulhu/divider-ornament.svg"
					alt=""
					aria-hidden="true"
					className="h-3 min-w-0 flex-1"
				/>
				<span className="shrink-0 font-mono text-label-small tracking-[0.18em] text-[var(--paper-ink-2)]">
					{t("chat.phaseRecord")}
				</span>
				<img
					src="/cthulhu/divider-ornament.svg"
					alt=""
					aria-hidden="true"
					className="h-3 min-w-0 flex-1"
				/>
			</div>
			<h2 className="text-center font-serif text-headline-small-emph tracking-[0.22em] text-[var(--ink-olive)]">
				{message.phase?.label ?? message.body}
			</h2>
			<p className="font-mono text-label-small text-[var(--paper-ink-3)]">
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
						{t("chat.rollPublic")}
					</span>
					<span className="ml-auto shrink-0 font-mono text-label-small text-[var(--paper-ink-2)]">
						{message.time}
					</span>
				</div>
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="font-mono text-body-medium">{roll.expression}</span>
					<span className="font-serif text-display-small-emph leading-none tabular-nums max-[420px]:text-[38px]">
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
					{t("chat.public")}
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
	className,
}: {
	message: SystemMessageView;
	check: ChatCheckView;
	className?: string;
}) {
	const tone = outcomeStyle(check.outcome);
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
							{message.speakerName} · {check.difficulty}
						</span>
					</div>
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
					<span className="font-serif text-display-small-emph leading-none tabular-nums">
						{check.roll}
					</span>
					<span className="font-serif text-title-large-emph text-[var(--paper-ink-2)]">
						/ {check.target}
					</span>
					<span className="ml-2 border border-[var(--paper-line)] px-1.5 py-0.5 font-mono text-label-small text-[var(--paper-ink-2)]">
						{check.label}
					</span>
				</div>
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
				"flex min-w-0 items-center gap-3 rounded-md border-[1.5px] border-dashed border-[rgba(214,220,196,.35)] bg-[rgba(214,220,196,.03)] px-3 py-2.5",
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
				"bg-md-surface-container-high border border-md-outline-variant/40 flex flex-col gap-2 rounded-lg border-l-2 p-3.5",
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
	className,
}: {
	message: SystemMessageView;
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
				className={className}
			/>
		);
	return <LegacySystemMessage message={message} className={className} />;
}

export type { SystemMessageView };
export { SystemMessageCard };
