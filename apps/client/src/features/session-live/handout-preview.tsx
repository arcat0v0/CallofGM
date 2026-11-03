import { ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type HandoutPreviewVariant = "compact" | "detail";

const IMAGE_CLASS: Record<HandoutPreviewVariant, string> = {
	compact: "h-32 object-cover",
	detail: "aspect-video object-contain",
};

const CONTENT_CLASS: Record<HandoutPreviewVariant, string> = {
	compact: "max-h-36 overflow-y-auto text-body-medium",
	detail: "text-body-large",
};

function HandoutScopeBadge({
	isPublic,
	className,
}: {
	isPublic: boolean;
	className?: string;
}) {
	return (
		<Badge
			variant="soft"
			tone={isPublic ? "accent" : "warning"}
			size="sm"
			className={className}
		>
			{isPublic ? t("handout.public") : t("handout.secret")}
		</Badge>
	);
}

function HandoutPreview({
	title,
	content,
	imageAssetId,
	imageAlt,
	imageActions,
	variant = "compact",
	className,
}: {
	title: string;
	content: string;
	imageAssetId?: string | null;
	imageAlt?: string;
	imageActions?: ReactNode;
	variant?: HandoutPreviewVariant;
	className?: string;
}) {
	const image = mediaUrl(imageAssetId);

	return (
		<div
			className={cn(
				"bg-md-surface-container border-md-outline-variant/50 flex flex-col gap-2 rounded-lg-inc border p-5",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<ScrollText className="text-md-on-surface-variant size-5 shrink-0" />
				<span className="text-md-on-surface min-w-0 flex-1 font-serif text-title-medium-emph">
					{title}
				</span>
			</div>
			{image ? (
				<div className="bg-md-surface-container-high relative w-full overflow-hidden rounded-xl">
					<img
						src={image}
						alt={imageAlt ?? t("handout.imageAlt", { title })}
						className={cn("w-full", IMAGE_CLASS[variant])}
					/>
					{imageActions ? (
						<div className="absolute right-2 bottom-2 flex gap-2">
							{imageActions}
						</div>
					) : null}
				</div>
			) : null}
			<p
				className={cn(
					"text-md-on-surface-variant whitespace-pre-wrap select-text",
					CONTENT_CLASS[variant],
				)}
			>
				{content}
			</p>
		</div>
	);
}

export { HandoutPreview, HandoutScopeBadge };
