import { Ellipsis, LogOut, PanelRightClose } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

function ChatPanelHeader({
	compact = false,
	onCollapse,
	onLeaveSeat,
	title = t("chat.title"),
	status,
	statusPosition = "inline",
	actions,
	padded = true,
	className,
	children,
}: {
	compact?: boolean;
	onCollapse?: () => void;
	onLeaveSeat?: () => void;
	title?: string;
	status?: ReactNode;
	statusPosition?: "inline" | "end";
	actions?: ReactNode;
	padded?: boolean;
	className?: string;
	children?: ReactNode;
}) {
	const connected = usePlayStore((state) => state.connected);
	const sessionStatus = usePlayStore((state) => state.status);
	const ended = sessionStatus === "ended";
	const statusNode = status ?? (
		<span className="text-md-on-surface-variant/70 flex items-center gap-1 text-label-small">
			<span
				className={cn(
					"size-1.5 rounded-full",
					ended ? "bg-md-outline" : connected ? "bg-success" : "bg-warning",
				)}
			/>
			{ended
				? t("status.ended")
				: connected
					? t("chat.realtime")
					: t("chat.reconnecting")}
		</span>
	);

	return (
		<header
			className={cn(
				"relative flex shrink-0 flex-col",
				padded &&
					(compact ? "gap-1.5 px-3 pt-2.5 pb-1.5" : "gap-2.5 px-3.5 pt-3 pb-2"),
				className,
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<h2
						className={cn(
							"text-foreground shrink-0 font-sans whitespace-nowrap",
							compact ? "text-title-small-emph" : "text-title-medium-emph",
						)}
					>
						{title}
					</h2>
					{statusPosition === "inline" ? statusNode : null}
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					{statusPosition === "end" ? statusNode : null}
					{actions}
					{onCollapse ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={onCollapse}
							aria-label={t("chat.collapse")}
							title={t("chat.collapse")}
							className="text-md-on-surface-variant size-8"
						>
							<PanelRightClose className="size-4" />
						</Button>
					) : null}
					{onLeaveSeat ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("chat.moreActions")}
									title={t("chat.moreActions")}
									className="text-md-on-surface-variant size-8"
								>
									<Ellipsis className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuItem variant="destructive" onSelect={onLeaveSeat}>
									<LogOut />
									{t("chat.leaveSeat")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
			</div>
			{children}
		</header>
	);
}

export { ChatPanelHeader };
