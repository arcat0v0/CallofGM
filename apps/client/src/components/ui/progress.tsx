import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { Wave } from "@/components/ui/wave";
import { cn } from "@/lib/utils";

function Progress({
	className,
	value,
	max = 100,
	wavy = false,
	playing = true,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
	wavy?: boolean;
	playing?: boolean;
}) {
	const limit = Number.isFinite(max) && max > 0 ? max : 100;
	const determinate = typeof value === "number" && Number.isFinite(value);
	const normalized = determinate ? Math.min(limit, Math.max(0, value)) : null;
	const fraction = normalized === null ? 0.4 : normalized / limit;
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			data-wave={wavy}
			data-playing={playing}
			value={normalized}
			max={limit}
			className={cn("w-full items-center", className)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-active"
				style={determinate ? { width: `${fraction * 100}%` } : undefined}
			>
				{wavy && (
					<Wave
						playing={playing}
						flat={determinate && (fraction <= 0.1 || fraction >= 0.95)}
					/>
				)}
			</ProgressPrimitive.Indicator>
			{fraction < 1 && <span data-slot="progress-track" aria-hidden="true" />}
		</ProgressPrimitive.Root>
	);
}

function CircularProgress({
	value,
	max = 100,
	wavy = false,
	className,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { wavy?: boolean }) {
	const limit = Number.isFinite(max) && max > 0 ? max : 100;
	const normalized =
		typeof value === "number" && Number.isFinite(value)
			? Math.min(limit, Math.max(0, value))
			: null;
	const points = Array.from({ length: 181 }, (_, index) => {
		const angle = (index / 180) * Math.PI * 2;
		const radius = 18 + (wavy ? Math.sin(angle * 8) * 1.6 : 0);
		return `${index === 0 ? "M" : "L"}${24 + Math.sin(angle) * radius},${24 - Math.cos(angle) * radius}`;
	}).join(" ");
	const percent = normalized === null ? 28 : (normalized / limit) * 100;
	return (
		<ProgressPrimitive.Root
			data-slot="circular-progress"
			value={normalized}
			max={limit}
			className={cn("size-12 text-accent", className)}
			{...props}
		>
			<svg aria-hidden="true" viewBox="0 0 48 48" className="size-full">
				<path
					d={points}
					pathLength="100"
					fill="none"
					className="stroke-md-secondary-container"
					strokeWidth="4"
					strokeDasharray={`${Math.max(0, 100 - percent - 8)} 100`}
					strokeDashoffset={-percent - 4}
					strokeLinecap="round"
				/>
				<path
					d={points}
					pathLength="100"
					fill="none"
					stroke="currentColor"
					strokeWidth="4"
					strokeDasharray={`${percent} 100`}
					strokeLinecap="round"
				/>
			</svg>
		</ProgressPrimitive.Root>
	);
}

export { CircularProgress, Progress };
