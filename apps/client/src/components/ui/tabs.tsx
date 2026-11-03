import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { cn } from "@/lib/utils";

function Tabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function TabsList({
	className,
	children,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"inline-flex h-10 w-fit items-center justify-center rounded-full bg-surface-tertiary p-1",
				className,
			)}
			{...props}
		>
			<SelectionIndicator
				selector='[data-slot="tabs-trigger"][data-state="active"]'
				axis="auto"
			/>
			{children}
		</TabsPrimitive.List>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-4 font-sans text-label-large whitespace-nowrap text-muted outline-none transition-all duration-200 ease-expressive-default-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:pointer-events-none disabled:opacity-50 data-active:bg-segment data-active:text-segment-foreground data-active:shadow-tab [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
