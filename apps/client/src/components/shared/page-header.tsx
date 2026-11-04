import type * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	eyebrow?: React.ReactNode;
	actions?: React.ReactNode;
};

function PageHeader({
	title,
	description,
	eyebrow,
	actions,
	className,
	...props
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
				className,
			)}
			{...props}
		>
			<div className="flex min-w-0 flex-col gap-2">
				{eyebrow}
				<h1 className="font-sans text-display-small-emph text-balance text-foreground">
					{title}
				</h1>
				{description ? (
					<p className="max-w-3xl text-pretty text-body-large text-md-on-surface-variant">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:pb-1">
					{actions}
				</div>
			) : null}
		</header>
	);
}

export { PageHeader };
