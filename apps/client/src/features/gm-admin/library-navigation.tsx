import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LibraryNavigation({ children }: { children: ReactNode }) {
	return (
		<aside
			data-scroll
			className="flex max-h-full w-44 shrink-0 flex-col self-start overflow-y-auto rounded-xl bg-md-surface-container-low p-2 xl:w-52"
		>
			{children}
		</aside>
	);
}

export function FolderGroup({
	label,
	children,
}: {
	label?: string;
	children: ReactNode;
}) {
	return (
		<fieldset className="min-w-0">
			{label ? (
				<legend className="px-3 pt-1.5 text-label-medium text-md-on-surface-variant">
					{label}
				</legend>
			) : null}
			<div className="flex flex-col gap-0.5 py-1.5">{children}</div>
		</fieldset>
	);
}

export function FolderItem({
	label,
	hint,
	count,
	active,
	onClick,
}: {
	label: string;
	hint?: string;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			title={hint}
			onClick={onClick}
			className={cn(
				"flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-left outline-none transition-colors duration-150 ease-standard-fast-effects motion-reduce:transition-none max-lg:h-11",
				"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
				active
					? "bg-accent-soft text-accent-soft-foreground"
					: "text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-on-surface",
			)}
		>
			<span
				className={cn(
					"min-w-0 flex-1 truncate",
					active ? "text-label-large-emph" : "text-label-large",
				)}
			>
				{label}
			</span>
			<span className="text-label-medium tabular-nums">{count}</span>
		</button>
	);
}
