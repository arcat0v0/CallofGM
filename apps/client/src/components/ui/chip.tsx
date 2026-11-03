import { CheckIcon, XIcon } from "lucide-react";
import { Toggle as TogglePrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const chipStyle =
	"inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-md-outline px-3 text-label-large outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:opacity-40";
function Chip({
	className,
	children,
	icon,
	...props
}: ComponentProps<"button"> & { icon?: ReactNode }) {
	return (
		<button
			type="button"
			data-slot="chip"
			className={cn(chipStyle, className)}
			{...props}
		>
			{icon}
			{children}
		</button>
	);
}
function FilterChip({
	className,
	children,
	...props
}: ComponentProps<typeof TogglePrimitive.Root>) {
	return (
		<TogglePrimitive.Root
			data-slot="chip"
			className={cn(
				chipStyle,
				"group data-[state=on]:border-transparent data-[state=on]:bg-md-secondary-container data-[state=on]:text-md-on-secondary-container",
				className,
			)}
			{...props}
		>
			<CheckIcon className="hidden size-4 group-data-[state=on]:block" />
			{children}
		</TogglePrimitive.Root>
	);
}
function InputChip({
	children,
	onRemove,
	removeLabel,
}: {
	children: ReactNode;
	onRemove: () => void;
	removeLabel: string;
}) {
	return (
		<span
			data-slot="input-chip"
			className={cn(
				chipStyle,
				"bg-md-secondary-container text-md-on-secondary-container border-transparent pe-1",
			)}
		>
			{children}
			<button
				type="button"
				onClick={onRemove}
				aria-label={removeLabel}
				className="grid size-6 place-items-center rounded-full hover:bg-md-on-secondary-container/10 focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				<XIcon className="size-4" />
			</button>
		</span>
	);
}

export { Chip, FilterChip, InputChip };
