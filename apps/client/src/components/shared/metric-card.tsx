import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type MetricItem = {
	icon: LucideIcon;
	value: React.ReactNode;
	label: React.ReactNode;
	emphasis?: boolean;
};

type MetricStripProps = React.ComponentProps<"div"> & {
	items: MetricItem[];
	columns?: 3 | 4;
};

function MetricStrip({
	items,
	columns = 4,
	className,
	...props
}: MetricStripProps) {
	return (
		<div
			className={cn(
				"bg-md-outline-variant/40 border-md-outline-variant/50 shadow-card grid gap-px overflow-hidden rounded-3xl border",
				columns === 4
					? "grid-cols-2 lg:grid-cols-4"
					: "grid-cols-1 sm:grid-cols-3",
				className,
			)}
			{...props}
		>
			{items.map(({ icon: Icon, value, label, emphasis = false }, index) => (
				<div
					key={index}
					className="bg-md-surface-container flex min-w-0 flex-col gap-3 p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<span className="text-md-on-surface-variant truncate text-label-medium">
							{label}
						</span>
						<Icon
							className={cn(
								"size-4 shrink-0",
								emphasis ? "text-md-primary" : "text-md-outline",
							)}
						/>
					</div>
					<span
						className={cn(
							"font-serif text-[clamp(2rem,3vw,3rem)] leading-none font-semibold tabular-nums",
							emphasis ? "text-md-primary" : "text-md-on-surface",
						)}
					>
						{value}
					</span>
				</div>
			))}
		</div>
	);
}

export type { MetricItem };
export { MetricStrip };
