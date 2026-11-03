import type { PlayViewport } from "@cogm/theme-sdk";
import { useNavigate } from "@tanstack/react-router";
import { History, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	type ChatChannel,
	filterChatMessages,
} from "@/features/chat/channel-filter";
import { ChatEmptyState } from "@/features/chat/chat-empty-state";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageList, type MessageMeta } from "@/features/chat/message-list";
import type { ChatMessage } from "@/features/chat/types";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayStore } from "@/stores/play-store";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

const CHANNEL_OPTIONS = [
	{ value: "all", label: "chat.all" },
	{ value: "ic", label: "chat.ic" },
	{ value: "ooc", label: "chat.ooc" },
] as const;

function PlayerChatPanel({
	sessionId,
	variant,
	compact,
	onCollapse,
	onOpenHistory,
	className,
}: {
	sessionId: string;
	variant: PlayViewport;
	compact: boolean;
	onCollapse?: () => void;
	onOpenHistory?: () => void;
	className?: string;
}) {
	const navigate = useNavigate();
	const [channel, setChannel] = useState<ChatChannel>("all");
	const [leaveOpen, setLeaveOpen] = useState(false);
	const messages = usePlayStore((state) => state.messages);
	const characters = usePlayStore((state) => state.characters);
	const seatRole = usePlayStore((state) => state.viewer.seatRole);
	const historyHasMore = usePlayStore((state) => state.historyHasMore);
	const historyLoading = usePlayStore((state) => state.historyLoading);
	const historyPagesLoaded = usePlayStore((state) => state.historyPagesLoaded);
	const loadOlderHistory = usePlayStore((state) => state.loadOlderHistory);
	const viewerHolderKind = usePlayStore((state) => state.viewer.holderKind);
	const viewerHolderId = usePlayStore((state) => state.viewer.holderId);
	const claimed = characters.find(
		(character) =>
			character.claim?.holderKind === viewerHolderKind &&
			character.claim?.holderId === viewerHolderId &&
			character.claim.role === "pc",
	);
	const isOb = seatRole === "ob";
	const selfName =
		claimed?.name ??
		(isOb ? t("chat.spectatorFallback") : t("chat.playerFallback"));

	async function leaveSeat() {
		try {
			await api(`/sessions/${encodeURIComponent(sessionId)}/release`, {
				method: "POST",
			});
			await navigate({ to: "/join/$sessionId", params: { sessionId } });
		} catch (error) {
			toast.error(errorText(error, "chat.leaveFailed"));
		}
	}

	const visible = useMemo(
		() => filterChatMessages(messages, channel),
		[channel, messages],
	);

	function renderMessage(message: ChatMessage, meta: MessageMeta) {
		return (
			<ThemeSlot
				name="play.chat-message"
				ctx={{
					variant,
					message: {
						id: message.id,
						speakerName: message.speakerName,
						speakerRoleLabel: message.speakerRoleLabel,
						avatarInitials: message.avatarInitials,
						avatarBg: message.avatarBg,
						avatarFg: message.avatarFg,
						time: message.time,
						body: message.body,
						tone: message.tone ?? "ic",
						isSystem: meta.isSystem,
						self: meta.self,
						continued: meta.continued,
						showRoleBadge: true,
						hidden: message.hidden,
						outcome: message.outcome,
						pending: message.pending,
						rejected: message.rejected,
						rejectionReason: message.rejectionReason,
					},
				}}
			/>
		);
	}

	return (
		<div className={cn("flex min-h-0 flex-1 flex-col", className)}>
			<ChatPanelHeader
				compact={compact}
				onCollapse={onCollapse}
				onLeaveSeat={() => setLeaveOpen(true)}
				actions={
					onOpenHistory ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="text-md-on-surface-variant size-8"
							aria-label={t("history.title")}
							title={t("history.title")}
							onClick={onOpenHistory}
						>
							<History className="size-4" />
						</Button>
					) : undefined
				}
			>
				<SegmentedControl
					value={channel}
					options={CHANNEL_OPTIONS.map((option) => ({
						value: option.value,
						label: t(option.label),
					}))}
					onValueChange={setChannel}
					aria-label={t("chat.channelAria")}
					className="bg-md-surface-container-high/55 w-full p-0.5"
					itemClassName="h-7 px-3 text-label-small"
				/>
			</ChatPanelHeader>

			{visible.length === 0 && !historyHasMore ? (
				<ChatEmptyState
					title={t("chat.emptyTitle")}
					description={t("chat.emptyDescription")}
				/>
			) : (
				<MessageList
					messages={visible}
					selfName={selfName}
					onLoadOlder={loadOlderHistory}
					hasOlderHistory={historyHasMore}
					loadingOlder={historyLoading}
					olderLoads={historyPagesLoaded}
					renderMessage={renderMessage}
					stickToBottom
					className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2"
				/>
			)}

			<ConfirmDialog
				open={leaveOpen}
				onOpenChange={setLeaveOpen}
				icon={LogOut}
				confirmIcon={LogOut}
				title={t("chat.leaveTitle")}
				description={t("chat.leaveDescription")}
				confirmLabel={t("chat.leaveConfirm")}
				variant="warning"
				onConfirm={() => {
					setLeaveOpen(false);
					void leaveSeat();
				}}
			/>
		</div>
	);
}

export { PlayerChatPanel };
