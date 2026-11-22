import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type MetricItem = {
	icon: LucideIcon;
	value: React.ReactNode;
	label: string;
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
				"grid gap-2",
				columns === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3",
				className,
			)}
			{...props}
		>
			{items.map(({ icon: Icon, value, label, emphasis = false }) => (
				<div
					key={label}
					className={cn(
						"flex min-w-0 flex-col gap-1.5 rounded-lg-inc bg-md-surface-container-low px-3 py-2.5 sm:px-4",
						emphasis && "bg-accent-soft text-accent-soft-foreground",
					)}
				>
					<div className="flex items-center justify-between gap-3">
						<span
							className={cn(
								"text-label-medium",
								!emphasis && "text-md-on-surface-variant",
							)}
						>
							{label}
						</span>
						<Icon
							aria-hidden
							className={cn(
								"hidden size-4 shrink-0 sm:block",
								!emphasis && "text-md-on-surface-variant",
							)}
						/>
					</div>
					<span
						className={cn(
							"text-headline-small-emph tabular-nums",
							!emphasis && "text-md-on-surface",
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
