import type * as React from "react";
import { Button } from "@/components/ui/button";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
	value: T;
	label: React.ReactNode;
	disabled?: boolean;
	ariaDisabled?: boolean;
};

type SegmentedControlProps<T extends string> = Omit<
	React.ComponentProps<"div">,
	"onChange"
> & {
	value: T;
	options: readonly SegmentedOption<T>[];
	onValueChange: (value: T) => void;
	itemClassName?: string;
};

function SegmentedControl<T extends string>({
	value,
	options,
	onValueChange,
	className,
	itemClassName,
	...props
}: SegmentedControlProps<T>) {
	return (
		<div
			data-slot="segmented-control"
			role="radiogroup"
			className={cn(
				"relative isolate flex items-center gap-0.5 rounded-full bg-surface-tertiary p-1",
				className,
			)}
			{...props}
		>
			<SelectionIndicator
				selector='[role="radio"][aria-checked="true"]'
				axis="horizontal"
			/>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						aria-disabled={option.ariaDisabled || undefined}
						disabled={option.disabled}
						variant="tertiary"
						size="sm"
						onClick={() => onValueChange(option.value)}
						className={cn(
							"relative z-1 h-8 flex-1 rounded-full bg-transparent px-4",
							"disabled:bg-transparent! disabled:opacity-60",
							selected
								? "font-semibold text-segment-foreground hover:bg-transparent disabled:text-segment-foreground!"
								: "font-medium text-foreground-secondary hover:bg-surface-hover disabled:text-foreground-secondary!",
							itemClassName,
						)}
					>
						{option.label}
					</Button>
				);
			})}
		</div>
	);
}

export type { SegmentedOption };
export { SegmentedControl };
