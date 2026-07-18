import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanelHeader } from "@/features/chat/chat-panel-header";
import { MessageList } from "@/features/chat/message-list";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { messages } from "./mock-data";

type ChatAreaProps = {
  variant: "desktop" | "portrait" | "landscape";
  onCollapse?: () => void;
  className?: string;
};

function ChatArea({ variant, onCollapse, className }: ChatAreaProps) {
  const [channel, setChannel] = useState("all");
  const compact = variant !== "desktop";

  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col border-l", className)}>
      {variant === "desktop" && (
        <ChatPanelHeader />
      )}

      {variant === "landscape" && (
        <ChatPanelHeader compact onCollapse={onCollapse} />
      )}

      <div className={cn("flex items-center justify-between", variant === "desktop" ? "px-4 pb-2.5" : "px-3 py-2")}>
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="ic">角色</TabsTrigger>
            <TabsTrigger value="ooc">场外</TabsTrigger>
          </TabsList>
        </Tabs>
        {variant === "portrait" && (
          <Badge variant="soft" tone="accent" size="md" className="h-6 px-2.5 text-[11px]">
            旋转到横屏体验更佳
          </Badge>
        )}
      </div>

      <MessageList
        messages={messages}
        className={cn("min-h-0 flex-1 overflow-y-auto", variant === "desktop" ? "px-4 py-1.5" : "px-3 py-2")}
      />

      <Composer compact={compact} />
    </div>
  );
}

export { ChatArea };
