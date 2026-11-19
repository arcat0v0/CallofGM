import type { SnapshotCharacter } from "@cogm/shared";
import type {
	ChatCheckView,
	ChatMessage,
	ChatRollView,
} from "@/features/chat/types";
import { t } from "@/i18n";
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

function CheckVerdict({
	message,
	check,
	allowLuckSpend,
	className,
}: {
	message: SystemMessageView;
	check: ChatCheckView;
	allowLuckSpend: boolean;
	className?: string;
}) {
	const characters = usePlayStore((state) => state.characters);
	const viewer = usePlayStore((state) => state.viewer);
	const messages = usePlayStore((state) => state.messages);
	const sessionRuleId = usePlayStore((state) => state.ruleId);
	const target = characters.find(
		(character) =>
			character.characterId === (check.characterId ?? message.characterId),
	);
	const rule = getRuleComponent(
		message.ruleId ?? target?.ruleId ?? sessionRuleId,
	);
	const CheckCard = rule.renderCheckCardExtra;
	let luckCharacter: SnapshotCharacter | undefined;
	if (
		allowLuckSpend &&
		rule.capabilities?.luck &&
		check.characterId &&
		target?.claim?.role === "pc" &&
		target.claim.holderKind === viewer.holderKind &&
		target.claim.holderId === viewer.holderId &&
		message.sortKey !== undefined
	) {
		let latest = -Infinity;
		for (const item of messages)
			if (item.check?.characterId === check.characterId)
				latest = Math.max(latest, item.sortKey);
		if (latest === message.sortKey) luckCharacter = target;
	}
	return CheckCard ? (
		<Sheet>
			<CheckCard
				check={check}
				speakerName={message.speakerName}
				time={message.time}
				eventId={message.eventId}
				className={className}
				luckCharacter={luckCharacter}
			/>
		</Sheet>
	) : (
		<LegacySystemMessage message={message} className={className} />
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
