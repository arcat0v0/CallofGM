import { Ban, Clock3, Smile } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SystemMessageCard } from "@/features/chat/system-message-card";
import type { ChatMessage } from "@/features/chat/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type ChatMessageCardData = Omit<ChatMessage, "sortKey"> & {
	sortKey?: number;
};

function ChatMessageCard({
	message,
	self = false,
	continued = false,
	showRoleBadge = true,
	variant = "bubble",
	className,
}: {
	message: ChatMessageCardData;
	self?: boolean;
	continued?: boolean;
	showRoleBadge?: boolean;
	variant?: "bubble" | "flat";
	className?: string;
}) {
	if (message.isSystem) {
		return <SystemMessageCard message={message} className={className} />;
	}

	if (variant === "flat") {
		return (
			<div className={cn("flex gap-2.5", className)}>
				<Avatar size="sm" className={cn("size-7 shrink-0", message.avatarBg)}>
					<AvatarFallback className={cn("text-label-small", message.avatarFg)}>
						{message.avatarInitials}
					</AvatarFallback>
				</Avatar>
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<div className="flex items-center gap-2">
						<span className="text-md-on-surface text-label-medium-emph">
							{message.speakerName}
						</span>
						{message.tone === "ooc" ? (
							<Badge variant="soft" tone="default" size="sm">
								{t("chat.ooc")}
							</Badge>
						) : null}
						{message.expressionLabel ? (
							<Badge variant="soft" tone="accent" size="sm">
								<Smile className="size-3" />
								{message.expressionLabel}
							</Badge>
						) : null}
						<span className="text-md-outline font-mono text-label-small">
							{message.time}
						</span>
					</div>
					<p className="text-md-on-surface-variant whitespace-pre-wrap break-words text-body-medium select-text">
						{message.body}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial flex w-full gap-2",
				self && "flex-row-reverse",
				continued && "-mt-1.5",
				className,
			)}
		>
			{self ? null : continued ? (
				<span className="size-7 shrink-0" />
			) : (
				<Avatar size="sm" className={cn("size-7 shrink-0", message.avatarBg)}>
					<AvatarFallback
						className={cn("font-sans text-label-small", message.avatarFg)}
					>
						{message.avatarInitials}
					</AvatarFallback>
				</Avatar>
			)}
			<div
				className={cn(
					"flex min-w-0 max-w-[86%] flex-col gap-1",
					self ? "items-end" : "items-start",
				)}
			>
				{!continued ? (
					<div
						className={cn(
							"flex items-center gap-1.5",
							self && "flex-row-reverse",
						)}
					>
						<span className="text-md-on-surface text-label-medium-emph">
							{message.speakerName}
						</span>
						{showRoleBadge &&
						(message.tone === "ooc" ||
							message.speakerRoleLabel === t("chat.role.gm") ||
							message.speakerRoleLabel === t("common.npc")) ? (
							<Badge variant="soft" tone="default" size="sm">
								{message.speakerRoleLabel}
							</Badge>
						) : null}
						{message.expressionLabel ? (
							<Badge variant="soft" tone="accent" size="sm">
								<Smile className="size-3" />
								{message.expressionLabel}
							</Badge>
						) : null}
						<span className="text-md-outline text-label-small tabular-nums">
							{message.time}
						</span>
					</div>
				) : null}
				<p
					className={cn(
						"w-fit rounded-2xl px-3.5 py-2 font-sans text-body-medium select-text",
						self
							? "bg-md-primary-container text-md-on-primary-container rounded-tr-md"
							: cn(
									"bg-md-surface-container-high/70 rounded-tl-md",
									message.tone === "ooc"
										? "text-md-on-surface-variant"
										: "text-md-on-surface",
								),
						message.rejected && "opacity-60",
					)}
				>
					{message.body}
				</p>
				{message.pending || message.rejected ? (
					<div className="flex max-w-full flex-wrap items-center gap-1.5">
						{message.pending ? (
							<Badge variant="soft" tone="warning" size="sm">
								<Clock3 className="size-3" />
								{t("chat.pendingReview")}
							</Badge>
						) : null}
						{message.rejected ? (
							<Badge variant="soft" tone="danger" size="sm">
								<Ban className="size-3" />
								{t("chat.rejected")}
							</Badge>
						) : null}
						<span
							className={cn(
								"text-label-small",
								message.rejected
									? "text-danger-soft-foreground"
									: "text-md-on-surface-variant/70",
							)}
						>
							{message.pending
								? t("chat.pendingReviewHint")
								: message.rejectionReason
									? t("chat.rejectionReason", {
											reason: message.rejectionReason,
										})
									: t("chat.rejectionNoReason")}
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}

export { ChatMessageCard };
