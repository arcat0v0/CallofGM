import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageInput } from "@/features/chat/message-input";
import { MessageList } from "@/features/chat/message-list";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
import { DiceTray } from "@/features/session-live/dice-tray";
import { sendSessionCommand } from "@/lib/session-socket";
import { phaseChatHint } from "@/lib/format";
import { usePlayStore } from "@/stores/play-store";

function GmChatPanel({ className }: { className?: string }) {
  const [channel, setChannel] = useState("all");
  const [mode, setMode] = useState<MessageMode>("roleplay");
  const [draft, setDraft] = useState("");
  const messages = usePlayStore((state) => state.messages);
  const phase = usePlayStore((state) => state.phase);
  const firstPcId = usePlayStore((state) => state.characters.find((character) => character.kind === "pc")?.characterId);
  const visible = useMemo(() => {
    if (channel === "ic") {
      return messages.filter((message) => message.tone !== "ooc");
    }
    if (channel === "ooc") {
      return messages.filter((message) => message.tone === "ooc");
    }
    return messages;
  }, [channel, messages]);

  function handleSend() {
    const content = draft.trim();
    if (!content) {
      return;
    }
    const sent = sendSessionCommand("chat:send", {
      channel: mode === "ooc" ? "ooc" : "roleplay",
      content,
    });
    if (!sent) {
      toast.error("尚未连接到团");
      return;
    }
    setDraft("");
  }

  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col border-l", className)}>
      <ChatPanelHeader browseAllSheets />

      <div className="px-4 pb-2.5">
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="ic">角色</TabsTrigger>
            <TabsTrigger value="ooc">场外</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <MessageList messages={visible} showRoleBadge={false} className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5" />

      <div className="border-separator-secondary bg-background-tertiary flex flex-col gap-2.5 border-t px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar size="sm" className="bg-accent">
              <AvatarFallback className="text-accent-foreground text-label-medium">KP</AvatarFallback>
            </Avatar>
            <span className="text-foreground font-sans text-label-large-emph">KP（主持人）</span>
          </div>
          <MessageModeSwitch value={mode} onValueChange={setMode} />
        </div>

        <DiceTray gm characterId={firstPcId} />

        <MessageInput
          placeholder="以 KP 身份发言 / 旁白…"
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
        />

        <p className="text-foreground-tertiary font-sans text-label-small">{phaseChatHint(phase, "gm")}</p>
      </div>
    </div>
  );
}

export { GmChatPanel };
