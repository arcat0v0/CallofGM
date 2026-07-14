import { PanelRightClose, ScrollText, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { messages } from "./mock-data";
import { MessageList } from "./message-list";

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
        <div className="flex h-[52px] items-center justify-between px-4">
          <span className="text-foreground font-sans text-[15px] font-semibold">文字频道</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm">
              <Users />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <ScrollText />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <Settings />
            </Button>
          </div>
        </div>
      )}

      {variant === "landscape" && (
        <div className="border-separator flex h-10 items-center justify-between border-b px-3">
          <span className="text-foreground font-sans text-[13px] font-semibold">文字频道</span>
          <button type="button" onClick={onCollapse} className="text-foreground-secondary flex size-7 items-center justify-center">
            <PanelRightClose className="size-[15px]" />
          </button>
        </div>
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
          <span className="bg-accent-soft text-accent-soft-foreground flex h-6 items-center rounded-full px-2.5 font-sans text-[11px] font-medium">
            旋转到横屏体验更佳
          </span>
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
