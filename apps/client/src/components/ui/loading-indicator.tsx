import type { ComponentProps } from "react";
import shapes from "@/lib/expressive-shapes.json";
import { cn } from "@/lib/utils";

function Shape({
	shape = "softBurst",
	className,
	...props
}: ComponentProps<"svg"> & { shape?: keyof typeof shapes }) {
	return (
		<svg
			data-slot="shape"
			viewBox="0 0 100 100"
			aria-hidden="true"
			className={cn("size-12 fill-current text-accent", className)}
			{...props}
		>
			<path d={shapes[shape].path} />
		</svg>
	);
}
function LoadingIndicator({
	contained = false,
	label = "加载中",
	className,
	...props
}: ComponentProps<"div"> & { contained?: boolean; label?: string }) {
	return (
		<div
			data-slot="loading-indicator"
			role="status"
			aria-label={label}
			className={cn(
				"grid size-12 place-items-center rounded-full",
				contained && "bg-accent-soft",
				className,
			)}
			{...props}
		>
			<span className="block size-m3-loading">
				<span
					data-slot="loading-shape"
					className={cn(
						"block size-full",
						contained ? "bg-accent-soft-foreground" : "bg-accent",
					)}
				/>
			</span>
			<span className="sr-only">{label}</span>
		</div>
	);
}
function Spinner({
	className,
	...props
}: ComponentProps<typeof LoadingIndicator>) {
	return (
		<LoadingIndicator
			className={cn("size-5 [&>span]:size-4", className)}
			{...props}
		/>
	);
}

export { LoadingIndicator, Shape, Spinner };
