import type { JoinSeatCardCtx, JoinSeatView } from "@cogm/theme-sdk";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function SeatStatus({
	seat,
	selected,
}: {
	seat: JoinSeatView;
	selected: boolean;
}) {
	if (seat.claimed) {
		return (
			<Badge variant="soft" tone="default" size="sm">
				{t("join.claimed")}
			</Badge>
		);
	}
	if (selected) {
		return (
			<Badge variant="solid" tone="accent" size="sm">
				{t("join.selected")}
			</Badge>
		);
	}
	if (seat.kind === "spectator") {
		return (
			<Badge variant="soft" tone="default" size="sm">
				{t("join.unlimited")}
			</Badge>
		);
	}
	return (
		<Badge variant="soft" tone="success" size="sm">
			{t("join.available")}
		</Badge>
	);
}

export function JoinSeatCard({
	seat,
	selected,
	disabled,
	onSelect,
	variant,
	className,
}: JoinSeatCardCtx) {
	const active = selected && !seat.claimed;

	if (variant === "row") {
		return (
			<button
				type="button"
				onClick={onSelect}
				role="radio"
				aria-checked={selected}
				className={cn(
					"flex w-full max-w-xl items-center gap-3 rounded-2xl px-5 py-3.5 text-left transition-all duration-350 ease-expressive-fast-spatial focus-visible:outline-none",
					selected
						? "bg-md-surface-container-high ring-md-primary ring-2"
						: "bg-md-surface-container-low hover:bg-md-surface-container focus-visible:ring-md-primary focus-visible:ring-2",
					className,
				)}
			>
				<span className="bg-md-surface-container-highest text-md-on-surface-variant flex size-9 shrink-0 items-center justify-center rounded-full">
					<Eye className="size-4" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="text-title-small-emph text-md-on-surface">
						{seat.name}
					</span>
					<span className="text-body-small text-md-on-surface-variant">
						{seat.detail}
					</span>
				</span>
				<SeatStatus seat={seat} selected={selected} />
			</button>
		);
	}

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onSelect}
			role="radio"
			aria-checked={active}
			className={cn(
				"flex w-52 flex-col items-center gap-3 rounded-2xl px-5 pt-5 pb-6 text-center transition-all duration-350 ease-expressive-fast-spatial focus-visible:outline-none",
				seat.claimed
					? "cursor-not-allowed bg-md-surface-container border border-md-outline-variant/40 opacity-65"
					: active
						? "bg-md-primary-container text-md-on-primary-container shadow-card ring-md-primary cursor-pointer ring-2"
						: "bg-md-surface-container-low hover:bg-md-surface-container focus-visible:ring-md-primary cursor-pointer focus-visible:ring-2",
				className,
			)}
		>
			<span
				className={cn(
					"flex size-16 items-center justify-center rounded-t-full rounded-b-xl transition-colors duration-350 ease-expressive-fast-effects",
					active
						? "bg-md-primary text-md-on-primary"
						: "bg-md-surface-container-high text-md-on-surface-variant",
				)}
			>
				{seat.initial ? (
					<span className="font-serif text-title-large-emph">
						{seat.initial}
					</span>
				) : (
					<Eye className="size-5" />
				)}
			</span>
			<span
				className={cn(
					"text-title-medium-emph",
					active ? "text-md-on-primary-container" : "text-md-on-surface",
				)}
			>
				{seat.name}
			</span>
			<span
				className={cn(
					"text-body-small",
					active
						? "text-md-on-primary-container"
						: "text-md-on-surface-variant",
				)}
			>
				{seat.detail}
			</span>
			<SeatStatus seat={seat} selected={active} />
		</button>
	);
}
