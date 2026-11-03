import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-sans whitespace-nowrap outline-none select-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-m3-disabled-container disabled:text-md-on-surface-variant/70 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				primary: "bg-accent text-accent-foreground text-label-large-emph",
				secondary: "bg-md-secondary-container text-md-on-secondary-container",
				accentSoft: "bg-accent-soft text-accent-soft-foreground",
				outline: "border border-border bg-transparent text-accent",
				ghost: "text-accent",
				danger: "bg-danger text-danger-foreground text-label-large-emph",
				dangerSoft: "bg-danger-soft text-danger-soft-foreground",
				tertiary: "bg-default text-default-foreground",
				filled: "bg-accent text-accent-foreground",
				tonal: "bg-md-secondary-container text-md-on-secondary-container",
				elevated: "bg-md-surface-container-low text-accent shadow-card",
				text: "bg-transparent text-accent",
			},
			size: {
				sm: "h-m3-button-sm gap-2 px-4 text-label-large [&_svg]:size-5",
				md: "h-m3-button-md gap-2 px-6 text-title-medium [&_svg]:size-6",
				lg: "h-m3-button-lg gap-3 px-12 text-headline-small [&_svg]:size-8",
				"icon-sm": "size-10 [&_svg]:size-5",
				"icon-md": "size-14 [&_svg]:size-6",
				"icon-lg": "size-24 [&_svg]:size-9",
				xs: "h-m3-button-xs gap-2 px-4 text-label-large [&_svg]:size-5",
				xl: "h-m3-button-xl gap-4 px-16 text-headline-large [&_svg]:size-10",
			},
		},
		compoundVariants: [
			{
				variant: "ghost",
				size: ["icon-sm", "icon-md", "icon-lg"],
				className: "text-foreground-secondary",
			},
			{
				variant: "outline",
				size: ["icon-sm", "icon-md", "icon-lg"],
				className: "text-foreground-secondary",
			},
		],
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
);

function Button({
	className,
	"data-slot": slot = "button",
	variant = "primary",
	size = "md",
	shape = "round",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		"data-slot"?: string;
		asChild?: boolean;
		shape?: "round" | "square";
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot={slot}
			data-button={slot === "button" ? "" : undefined}
			data-variant={variant}
			data-size={size}
			data-shape={shape}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
