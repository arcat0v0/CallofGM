import type { SessionStatus } from "@cogm/shared";
import {
	Check,
	ChevronsUpDown,
	Clock3,
	type LucideIcon,
	Play,
	Settings2,
	SquarePower,
	X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { t } from "@/i18n";
import { sessionStatusLabel } from "@/i18n/labels";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: ReadonlyArray<{
	key: SessionStatus;
	icon: LucideIcon;
}> = [
	{ key: "waiting", icon: Clock3 },
	{ key: "preparing", icon: Settings2 },
	{ key: "active", icon: Play },
	{ key: "ended", icon: SquarePower },
];

const TRIGGER_TONES: Record<Exclude<SessionStatus, "ended">, string> = {
	waiting:
		"bg-md-surface-container-low text-md-on-surface border-md-outline-variant/50",
	preparing:
		"bg-md-secondary-container text-md-on-secondary-container border-md-secondary/30",
	active: "bg-accent-soft text-accent-soft-foreground border-md-primary/30",
};

const DOT_TONES: Record<Exclude<SessionStatus, "ended">, string> = {
	waiting: "bg-md-outline",
	preparing: "bg-md-secondary",
	active: "bg-md-primary",
};

function canReachStatus(
	current: SessionStatus,
	target: SessionStatus,
): boolean {
	if (current === "waiting") {
		return target === "preparing" || target === "active";
	}
	if (current === "preparing") {
		return target === "active";
	}
	if (current === "active") {
		return target === "ended";
	}
	return false;
}

function GmSessionStatusControl({
	status,
	pending = false,
	onSelectStatus,
	onRequestEnd,
}: {
	status: SessionStatus | null;
	pending?: boolean;
	onSelectStatus: (target: SessionStatus) => void;
	onRequestEnd: () => void;
}) {
	const [open, setOpen] = useState(false);

	if (!status) {
		return null;
	}

	if (status === "ended") {
		return (
			<Badge
				variant="soft"
				tone="warning"
				size="lg"
				className="h-10 px-4 text-label-large-emph"
			>
				{sessionStatusLabel(status)}
			</Badge>
		);
	}

	const currentIndex = STATUS_OPTIONS.findIndex(
		(option) => option.key === status,
	);

	function handleSelect(target: SessionStatus) {
		if (!status || !canReachStatus(status, target) || pending) {
			return;
		}
		setOpen(false);
		if (target === "ended") {
			onRequestEnd();
			return;
		}
		onSelectStatus(target);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					disabled={pending}
					aria-label={t("gm.workbench.statusSwitchAria", {
						status: sessionStatusLabel(status),
					})}
					title={open ? undefined : t("gm.workbench.statusTitle")}
					className={cn(
						"h-9 gap-1.5 rounded-full border px-2.5 text-label-medium sm:gap-2 sm:px-3.5 lg:h-10 lg:text-label-large-emph",
						TRIGGER_TONES[status],
					)}
				>
					<span
						aria-hidden
						className={cn("size-2 shrink-0 rounded-full", DOT_TONES[status])}
					/>
					<span>{sessionStatusLabel(status)}</span>
					<ChevronsUpDown className="size-4 opacity-75" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={10}
				className="bg-md-surface-container-high shadow-overlay max-h-[70dvh] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl p-3"
			>
				<div className="flex h-10 items-center justify-between gap-3 px-3">
					<span className="text-md-on-surface text-title-small-emph">
						{t("gm.workbench.statusTitle")}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-8"
						aria-label={t("common.close")}
						onClick={() => setOpen(false)}
					>
						<X className="size-4" />
					</Button>
				</div>
				<div className="flex flex-col gap-1">
					{STATUS_OPTIONS.map((option, index) => {
						const selected = option.key === status;
						const passed = index < currentIndex;
						const reachable = canReachStatus(status, option.key);
						const isEndOption = option.key === "ended";
						const disabled = pending || selected || !reachable;
						return (
							<button
								key={option.key}
								type="button"
								disabled={disabled}
								aria-current={selected ? "true" : undefined}
								onClick={() => handleSelect(option.key)}
								className={cn(
									"flex min-h-18 w-full items-center gap-3 rounded-lg-inc px-3.5 py-2.5 text-left outline-none transition-colors duration-200 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
									selected
										? "bg-md-primary-container text-md-on-primary-container"
										: reachable
											? isEndOption
												? "text-danger hover:bg-danger-soft"
												: "text-md-on-surface hover:bg-md-on-surface/8"
											: "text-md-on-surface-variant cursor-not-allowed opacity-50",
								)}
							>
								<option.icon className="size-5 shrink-0" />
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="flex items-center gap-2">
										<span className="text-title-small-emph">
											{sessionStatusLabel(option.key)}
										</span>
										{passed ? (
											<span className="text-md-on-surface-variant text-label-small">
												{t("gm.workbench.statusStatePassed")}
											</span>
										) : isEndOption && !reachable ? (
											<span className="text-md-on-surface-variant text-label-small">
												{t("gm.workbench.statusStateRequiresActive")}
											</span>
										) : null}
									</span>
									<span
										className={cn(
											"text-label-small",
											selected
												? "text-md-on-primary-container"
												: isEndOption && reachable
													? "text-danger/85"
													: "text-md-on-surface-variant",
										)}
									>
										{t(`gm.workbench.statusDetail.${option.key}`)}
									</span>
								</span>
								{selected ? (
									<Check className="size-5 shrink-0" />
								) : reachable ? (
									<span
										aria-hidden
										className={cn(
											"size-4 shrink-0 rounded-full border-2",
											isEndOption
												? "border-danger/60"
												: "border-md-outline-variant",
										)}
									/>
								) : null}
							</button>
						);
					})}
				</div>
				<p className="text-md-on-surface-variant px-3 pt-2.5 text-label-small">
					{t("gm.workbench.statusRuleHint")}
				</p>
			</PopoverContent>
		</Popover>
	);
}

export { GmSessionStatusControl };
