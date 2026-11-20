import type { ComponentProps, ReactNode } from "react";
import { FilterChip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

/** 掷骰面板的单选快选胶囊：选中态用强调色，不显示勾选图标以免宽度跳动。 */
function QuickPickChip({
	selected,
	onSelect,
	value,
	children,
	className,
	...props
}: Omit<ComponentProps<typeof FilterChip>, "pressed" | "onPressedChange"> & {
	selected: boolean;
	onSelect: () => void;
	value?: ReactNode;
}) {
	return (
		<FilterChip
			pressed={selected}
			onPressedChange={() => onSelect()}
			className={cn(
				"bg-md-surface-container text-md-on-surface border-md-outline-variant h-8 gap-1.5 rounded-full px-3 text-label-medium [&>svg]:hidden!",
				"data-[state=on]:bg-accent-soft data-[state=on]:text-accent-soft-foreground data-[state=on]:font-semibold",
				className,
			)}
			{...props}
		>
			{children}
			{value !== undefined ? (
				<span className="font-mono tabular-nums">{value}</span>
			) : null}
		</FilterChip>
	);
}

export { QuickPickChip };
