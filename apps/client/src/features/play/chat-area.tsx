import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageList } from "@/features/chat/message-list";
import { api, isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { useIdentityStore } from "@/stores/identity-store";
import { Composer } from "./composer";

type ChatAreaProps = {
  variant: "desktop" | "portrait" | "landscape";
  onCollapse?: () => void;
  className?: string;
};

type ChatChannel = "all" | "ic" | "ooc";

const CHANNEL_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "ic", label: "角色" },
  { value: "ooc", label: "场外" },
] as const;

function ChatArea({ variant, onCollapse, className }: ChatAreaProps) {
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ChatChannel>("all");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const compact = variant !== "desktop";
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
  const selfName = claimed?.name ?? (isOb ? "观战" : "玩家");

  async function leaveSeat() {
    try {
      await api(`/sessions/${encodeURIComponent(sessionId)}/release`, { method: "POST" });
      await navigate({ to: "/join/$sessionId", params: { sessionId } });
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "离开座位失败");
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

  return (
    <div className={cn("bg-md-surface-container-low flex h-full flex-col", className)}>
      <ChatPanelHeader
        compact={compact}
        onCollapse={variant === "landscape" ? onCollapse : undefined}
        onLeaveSeat={() => setLeaveOpen(true)}
      >
        <div className={cn("flex items-center justify-between", variant === "desktop" ? "px-4 pb-2.5" : "px-3 py-2")}>
          <SegmentedControl
            value={channel}
            options={CHANNEL_OPTIONS}
            onValueChange={setChannel}
            aria-label="聊天频道"
          />
          {variant === "portrait" && (
            <Badge variant="soft" tone="accent" size="md" className="h-6 px-2.5 text-label-small">
              旋转到横屏体验更佳
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
        className={cn("min-h-0 flex-1 overflow-y-auto", variant === "desktop" ? "px-4 py-1.5" : "px-3 py-2")}
      />

      <Composer compact={compact} />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        icon={LogOut}
        confirmIcon={LogOut}
        title="离开座位"
        description="离开后将释放当前座位，可稍后重新认领。聊天与情报进度不受影响。"
        confirmLabel="离开"
        variant="warning"
        onConfirm={() => {
          setLeaveOpen(false);
          void leaveSeat();
        }}
      />
    </div>
  );
}

export { ChatArea };
