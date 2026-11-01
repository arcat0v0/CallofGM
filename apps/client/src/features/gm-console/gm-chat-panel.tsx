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
import { t } from "@/i18n";

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
      toast.error(t("chat.notConnected"));
      return;
    }
    setDraft("");
  }

  return (
    <div className={cn("bg-md-surface-container-low animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex h-full flex-col duration-500", className)}>
      <ChatPanelHeader browseAllSheets />

      <div className="px-4 pb-2.5">
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList>
            <TabsTrigger value="all">{t("chat.all")}</TabsTrigger>
            <TabsTrigger value="ic">{t("chat.ic")}</TabsTrigger>
            <TabsTrigger value="ooc">{t("chat.ooc")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <MessageList messages={visible} showRoleBadge={false} className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5" />

      <div className="bg-md-surface-container mx-3 mb-3 flex flex-col gap-2.5 rounded-xl px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar size="sm" className="bg-md-primary-container">
              <AvatarFallback className="text-md-on-primary-container text-label-medium">{t("common.gmShort")}</AvatarFallback>
            </Avatar>
            <span className="text-md-on-surface font-sans text-label-large-emph">{t("gm.chat.gmName")}</span>
          </div>
          <MessageModeSwitch value={mode} onValueChange={setMode} />
        </div>

        <DiceTray gm characterId={firstPcId} />

        <MessageInput
          placeholder={t("gm.chat.placeholder")}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
        />

        <p className="text-md-on-surface-variant font-sans text-label-small">{phaseChatHint(phase, "gm")}</p>
      </div>
    </div>
  );
}

export { GmChatPanel };
