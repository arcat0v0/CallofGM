import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import type { PlayViewport } from "@cogm/theme-sdk";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageList, type MessageMeta } from "@/features/chat/message-list";
import type { ChatMessage } from "@/features/chat/types";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { useIdentityStore } from "@/stores/identity-store";

type ChatChannel = "all" | "ic" | "ooc";

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
  className,
}: {
  sessionId: string;
  variant: PlayViewport;
  compact: boolean;
  onCollapse?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ChatChannel>("all");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const messages = usePlayStore((state) => state.messages);
  const characters = usePlayStore((state) => state.characters);
  const playerId = useIdentityStore((state) => state.playerId);
  const seatRole = usePlayStore((state) => state.viewer.seatRole);
  const historyHasMore = usePlayStore((state) => state.historyHasMore);
  const historyLoading = usePlayStore((state) => state.historyLoading);
  const historyPagesLoaded = usePlayStore((state) => state.historyPagesLoaded);
  const loadOlderHistory = usePlayStore((state) => state.loadOlderHistory);
  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const isOb = seatRole === "ob";
  const selfName = claimed?.name ?? (isOb ? t("chat.spectatorFallback") : t("chat.playerFallback"));

  async function leaveSeat() {
    try {
      await api(`/sessions/${encodeURIComponent(sessionId)}/release`, { method: "POST" });
      await navigate({ to: "/join/$sessionId", params: { sessionId } });
    } catch (error) {
      toast.error(errorText(error, "chat.leaveFailed"));
    }
  }

  const visible = useMemo(() => {
    if (channel === "ic") {
      return messages.filter((message) => message.tone !== "ooc");
    }
    if (channel === "ooc") {
      return messages.filter((message) => message.tone === "ooc");
    }
    return messages;
  }, [channel, messages]);

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
          },
        }}
      />
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <ChatPanelHeader
        compact={compact}
        onCollapse={variant === "landscape" ? onCollapse : undefined}
        onLeaveSeat={() => setLeaveOpen(true)}
      >
        <div className={cn("flex items-center justify-between", variant === "desktop" ? "px-4 pb-2.5" : "px-3 py-2")}>
          <SegmentedControl
            value={channel}
            options={CHANNEL_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            onValueChange={setChannel}
            aria-label={t("chat.channelAria")}
          />
          {variant === "portrait" && (
            <Badge variant="soft" tone="accent" size="md" className="h-6 px-2.5 text-label-small">
              {t("chat.rotateHint")}
            </Badge>
          )}
        </div>
      </ChatPanelHeader>

      <MessageList
        messages={visible}
        selfName={selfName}
        onLoadOlder={loadOlderHistory}
        hasOlderHistory={historyHasMore}
        loadingOlder={historyLoading}
        olderLoads={historyPagesLoaded}
        renderMessage={renderMessage}
        className={cn("min-h-0 flex-1 overflow-y-auto", variant === "desktop" ? "px-4 py-1.5" : "px-3 py-2")}
      />

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