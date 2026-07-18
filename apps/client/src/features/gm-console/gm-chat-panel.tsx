import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageInput } from "@/features/chat/message-input";
import { MessageList } from "@/features/chat/message-list";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
import { gmMessages } from "./mock-data";

function GmChatPanel({ className }: { className?: string }) {
  const [channel, setChannel] = useState("all");
  const [mode, setMode] = useState<MessageMode>("roleplay");

  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col border-l", className)}>
      <ChatPanelHeader />

      <div className="px-4 pb-2.5">
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="ic">角色</TabsTrigger>
            <TabsTrigger value="ooc">场外</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <MessageList messages={gmMessages} showRoleBadge={false} className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5" />

      <div className="border-separator-secondary bg-background-tertiary flex flex-col gap-2.5 border-t px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar size="sm" className="bg-accent">
              <AvatarFallback className="text-accent-foreground font-chip text-xs">KP</AvatarFallback>
            </Avatar>
            <span className="text-foreground font-sans text-[13px] font-semibold">KP（主持人）</span>
          </div>
          <MessageModeSwitch value={mode} onValueChange={setMode} />
        </div>

        <MessageInput placeholder="以 KP 身份发言 / 旁白…" />

        <p className="text-foreground-tertiary font-sans text-[11px]">演绎时间 · 玩家需申请发言，由你逐条授权</p>
      </div>
    </div>
  );
}

export { GmChatPanel };
