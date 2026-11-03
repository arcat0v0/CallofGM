import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
	"shadow-card bg-surface flex w-full gap-4 rounded-lg px-4 py-3",
	{
		variants: {
			variant: {
				default:
					"[&_[data-slot=alert-icon]]:text-foreground [&_[data-slot=alert-title]]:text-foreground",
				accent:
					"[&_[data-slot=alert-icon]]:text-accent [&_[data-slot=alert-title]]:text-accent",
				success:
					"[&_[data-slot=alert-icon]]:text-success [&_[data-slot=alert-title]]:text-success",
				warning:
					"[&_[data-slot=alert-icon]]:text-warning [&_[data-slot=alert-title]]:text-warning",
				danger:
					"[&_[data-slot=alert-icon]]:text-danger [&_[data-slot=alert-title]]:text-danger",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			data-variant={variant ?? "default"}
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertIcon({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-icon"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function AlertContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-content"
			className={cn("flex flex-1 flex-col gap-1", className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("font-sans text-title-small-emph", className)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("text-muted font-sans text-body-medium", className)}
			{...props}
		/>
	);
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-action"
			className={cn("shrink-0", className)}
			{...props}
		/>
	);
}

export {
	Alert,
	AlertAction,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
};
