import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

function AppBar({
	title,
	subtitle,
	leading,
	actions,
	size = "small",
	className,
	...props
}: Omit<ComponentProps<"header">, "title"> & {
	title: ReactNode;
	subtitle?: ReactNode;
	leading?: ReactNode;
	actions?: ReactNode;
	size?: "small" | "medium" | "large";
}) {
	return (
		<header
			data-slot="app-bar"
			data-size={size}
			className={cn(
				"flex flex-wrap items-center gap-4 rounded-xl bg-md-surface-container px-4 py-3",
				className,
			)}
			{...props}
		>
			{leading}
			<div
				className={cn(
					"min-w-0 flex-1",
					size !== "small" && "order-3 basis-full pb-4 pt-6",
				)}
			>
				<h2
					className={cn(
						"font-serif",
						size === "large"
							? "text-display-small-emph"
							: size === "medium"
								? "text-headline-medium"
								: "text-title-large",
					)}
				>
					{title}
				</h2>
				{subtitle && (
					<p className="mt-2 text-body-medium text-foreground-muted">
						{subtitle}
					</p>
				)}
			</div>
			<div className="ms-auto flex items-center gap-2">{actions}</div>
		</header>
	);
}

export { AppBar };
