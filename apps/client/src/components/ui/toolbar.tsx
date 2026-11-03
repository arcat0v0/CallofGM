import { Toolbar as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Toolbar({
	className,
	...props
}: ComponentProps<typeof Primitive.Root>) {
	return (
		<Primitive.Root
			data-slot="toolbar"
			className={cn(
				"inline-flex w-fit items-center gap-1 data-[orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}
function ToolbarButton({
	className,
	...props
}: ComponentProps<typeof Primitive.Button>) {
	return (
		<Primitive.Button
			data-slot="icon-button"
			className={cn(
				"grid size-12 place-items-center rounded-full text-foreground outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 [&_svg]:size-6",
				className,
			)}
			{...props}
		/>
	);
}
function ToolbarToggleGroup(
	props: ComponentProps<typeof Primitive.ToggleGroup>,
) {
	return (
		<Primitive.ToggleGroup className="flex items-center gap-1" {...props} />
	);
}
function ToolbarToggleItem({
	className,
	...props
}: ComponentProps<typeof Primitive.ToggleItem>) {
	return (
		<Primitive.ToggleItem
			data-slot="toggle"
			className={cn(
				"min-w-12 rounded-full px-3 data-[state=on]:bg-md-secondary-container",
				className,
			)}
			{...props}
		/>
	);
}
function ToolbarSeparator(props: ComponentProps<typeof Primitive.Separator>) {
	return (
		<Primitive.Separator className="mx-2 h-6 w-px bg-separator" {...props} />
	);
}

export {
	Toolbar,
	ToolbarButton,
	ToolbarSeparator,
	ToolbarToggleGroup,
	ToolbarToggleItem,
};
