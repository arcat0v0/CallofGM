import { t } from "@/i18n";
import type { RuleCheckCardProps } from "../types";
import { damageLabel, signed } from "./labels";

export function DndCheckCard({
	speakerName,
	eventId,
	check,
}: RuleCheckCardProps) {
	const d20 = check.d20;
	return (
		<div className="relative z-1 flex min-w-0 flex-col gap-3">
			<div className="flex items-center justify-between gap-2 border-b border-[var(--paper-line)] pb-1.5 font-mono text-label-small text-[var(--paper-ink-2)]">
				<span>{t("chat.checkRecord")}</span>
				{eventId !== undefined ? (
					<span>NO. {String(eventId).padStart(3, "0")}</span>
				) : null}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="font-sans text-title-large-emph">{check.skill}</p>
					<p className="text-label-small text-[var(--paper-ink-2)]">
						{speakerName} · {check.difficulty}
					</p>
				</div>
				<span className="rounded-full border border-[var(--paper-line)] px-2 py-1 text-label-medium">
					{check.label}
				</span>
			</div>
			<div className="flex items-baseline gap-2">
				<strong className="font-serif text-check-roll leading-none tabular-nums">
					{d20?.total ?? check.roll}
				</strong>
				<span className="font-mono text-body-medium text-[var(--paper-ink-2)]">
					{d20
						? `${d20.rolls.join(" / ")} · ${signed(d20.modifier)}${d20.dc === null ? "" : ` · DC ${d20.dc}`}`
						: null}
				</span>
			</div>
			{d20?.damage ? (
				<p className="text-body-medium">
					{t("chat.d20Damage", {
						total: d20.damage.total,
						type: damageLabel(d20.damage.type),
					})}
				</p>
			) : null}
		</div>
	);
}
