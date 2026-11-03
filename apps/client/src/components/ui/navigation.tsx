import type { ComponentProps, ReactNode } from "react";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { cn } from "@/lib/utils";

function Navigation({
	variant = "rail",
	className,
	children,
	...props
}: ComponentProps<"nav"> & { variant?: "bar" | "rail" | "drawer" }) {
	return (
		<nav
			data-slot="navigation"
			data-variant={variant}
			className={cn(
				"bg-md-surface-container-low p-3",
				variant === "bar"
					? "flex w-full items-center justify-around gap-2 rounded-xl"
					: variant === "rail"
						? "flex w-m3-rail flex-col items-center gap-3 rounded-xl-inc"
						: "flex w-m3-drawer max-w-full flex-col gap-1 rounded-xl p-4",
				className,
			)}
			{...props}
		>
			<SelectionIndicator
				axis={variant === "bar" ? "horizontal" : "vertical"}
				selector={
					variant === "drawer"
						? '[data-slot="navigation-item"][aria-current="page"]'
						: '[aria-current="page"] [data-slot="navigation-icon"]'
				}
			/>
			{children}
		</nav>
	);
}
function NavigationItem({
	active = false,
	icon,
	children,
	className,
	...props
}: ComponentProps<"a"> & {
	active?: boolean;
	icon: ReactNode;
}) {
	return (
		<a
			data-slot="navigation-item"
			aria-current={active ? "page" : undefined}
			className={cn(
				"group flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 text-label-medium text-foreground-muted outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 [[data-variant=drawer]_&]:flex-row [[data-variant=drawer]_&]:justify-start [[data-variant=drawer]_&]:px-4",
				className,
			)}
			{...props}
		>
			<span
				data-slot="navigation-icon"
				className="grid h-8 w-14 place-items-center [&_svg]:size-6"
			>
				{icon}
			</span>
			<span data-slot="navigation-label">{children}</span>
		</a>
	);
}

export { Navigation, NavigationItem };
