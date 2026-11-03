import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva("shadow-card flex flex-col gap-3 rounded-lg p-4", {
	variants: {
		variant: {
			elevated: "bg-md-surface-container-low text-foreground shadow-card",
			outlined: "bg-background text-foreground border border-border",
			default: "bg-surface text-surface-foreground",
			secondary: "bg-surface-secondary text-surface-secondary-foreground",
			tertiary: "bg-surface-tertiary text-surface-tertiary-foreground",
			transparent: "bg-surface-transparent text-surface-foreground shadow-none",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function Card({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
	return (
		<div
			data-slot="card"
			data-variant={variant}
			className={cn(cardVariants({ variant }), className)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn("flex flex-col gap-1", className)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn("font-sans text-title-medium text-foreground", className)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("font-sans text-body-medium text-muted", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("font-sans text-body-medium text-muted", className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

export {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};
