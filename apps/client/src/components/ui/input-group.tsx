import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="input-group"
			className={cn(
				"flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-field-border bg-field px-3.5 transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects hover:border-field-border-hover hover:bg-field-hover focus-within:border-field-border-focus focus-within:ring-4 focus-within:ring-focus-ring/35",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupAddon({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="input-group-addon"
			className={cn(
				"flex shrink-0 items-center justify-center text-field-placeholder [&_svg]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupInput({
	className,
	...props
}: React.ComponentProps<"input">) {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"h-auto flex-1 rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupButton({
	className,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<Button
			data-slot="input-group-button"
			variant="ghost"
			size="icon-sm"
			className={cn(
				"-mr-2 size-8 text-foreground-tertiary [&_svg]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput };
