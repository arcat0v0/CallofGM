import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 rounded-2xl bg-md-surface-container px-6 py-14 text-center",
				className,
			)}
		>
			<Icon
				className="text-foreground-tertiary size-7"
				strokeWidth={1.5}
				aria-hidden
			/>
			<div className="flex max-w-md flex-col gap-1">
				<h2 className="text-md-on-surface font-sans text-title-large-emph">
					{title}
				</h2>
				{description ? (
					<p className="text-md-on-surface-variant text-pretty text-body-medium">
						{description}
					</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

function ListSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div
			role="status"
			aria-label={t("common.loading")}
			className="overflow-hidden rounded-2xl bg-md-surface-container"
		>
			{SKELETON_KEYS.slice(0, rows).map((key) => (
				<div
					key={key}
					className="border-separator-secondary/60 flex items-center gap-3.5 border-b px-5 py-4 last:border-b-0"
				>
					<div className="bg-md-surface-container-high size-10 shrink-0 rounded-full" />
					<div className="flex flex-1 flex-col gap-2">
						<div className="bg-md-surface-container-high h-3.5 w-36 rounded-full" />
						<div className="bg-md-surface-container-high/70 h-3 w-24 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}

export { EmptyState, ListSkeleton };
