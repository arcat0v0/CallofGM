import { Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DialogueBoxProps = {
	speaker: string;
	roleLabel?: string;
	expressionLabel?: string | null;
	text: string;
	className?: string;
	size?: "md" | "sm";
};

function DialogueBox({
	speaker,
	roleLabel,
	expressionLabel,
	text,
	className,
	size = "md",
}: DialogueBoxProps) {
	const compact = size === "sm";

	return (
		<div
			className={cn(
				"animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial relative flex flex-col",
				className,
			)}
		>
			<div className="absolute -top-4 left-5 z-10 flex items-center gap-1.5">
				<span
					className={cn(
						"bg-md-primary-container text-md-on-primary-container shadow-dialogue-name rounded-full font-serif",
						compact
							? "px-3 py-0.5 text-label-large-emph"
							: "px-3.5 py-1 text-title-small-emph",
					)}
				>
					{speaker}
				</span>
				{roleLabel ? (
					<Badge
						variant="soft"
						tone="accent"
						size="sm"
						className="backdrop-blur-md"
					>
						{roleLabel}
					</Badge>
				) : null}
				{expressionLabel ? (
					<Badge
						variant="soft"
						tone="default"
						size="sm"
						className="backdrop-blur-md"
					>
						<Smile className="size-3" />
						{expressionLabel}
					</Badge>
				) : null}
			</div>
			<div
				className={cn(
					"shadow-dialogue border border-md-outline-variant/40 bg-md-surface-container-high/90 relative overflow-hidden rounded-2xl backdrop-blur-xl",
					compact ? "px-4 pt-5 pb-3" : "px-6 pt-6 pb-4",
				)}
			>
				<p
					className={cn(
						"text-md-on-surface font-sans select-text",
						compact ? "text-body-medium" : "text-body-large",
					)}
				>
					{text}
				</p>
			</div>
		</div>
	);
}

export { DialogueBox };
