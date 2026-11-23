import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function ChatEmptyState({
	title,
	description,
	variant = "player",
	className,
}: {
	title: string;
	description?: string;
	variant?: "player" | "gm";
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-col items-center justify-center overflow-y-auto text-center",
				variant === "gm"
					? "flex-1 gap-2 py-8"
					: "flex-1 gap-1.5 px-6 py-2 [@media(max-height:430px)]:gap-1 [@media(max-height:430px)]:px-4",
				className,
			)}
		>
			<MessagesSquare className="text-md-on-surface-variant/35 size-6 shrink-0 [@media(max-height:430px)]:size-5" />
			<p
				className={cn(
					variant === "gm"
						? "text-md-on-surface-variant/85 text-label-medium"
						: "text-md-on-surface-variant font-sans text-title-small-emph",
				)}
			>
				{title}
			</p>
			{description ? (
				<p className="text-md-on-surface-variant/70 text-label-small [@media(max-height:430px)]:hidden">
					{description}
				</p>
			) : null}
		</div>
	);
}

export { ChatEmptyState };
