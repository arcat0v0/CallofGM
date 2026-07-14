import { ScrollText, Send, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { gmMessages } from "./mock-data";

function GmChatPanel({ className }: { className?: string }) {
  const [channel, setChannel] = useState("all");
  const [mode, setMode] = useState<"roleplay" | "ooc">("roleplay");

  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col border-l", className)}>
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

      <div className="px-4 pb-2.5">
        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="ic">角色</TabsTrigger>
            <TabsTrigger value="ooc">场外</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5">
        <div className="flex flex-col gap-3.5">
          {gmMessages.map((message) => (
            <div key={message.id} className="flex w-full gap-2.5">
              <Avatar size="sm" className={cn("shrink-0", message.avatarBg)}>
                <AvatarFallback className={cn("font-sans text-xs", message.avatarFg)}>
                  {message.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-sans text-[13px] font-semibold">{message.speakerName}</span>
                  <span className="text-foreground-tertiary font-chip text-[11px]">{message.time}</span>
                </div>
                <p
                  className={cn(
                    "font-sans text-[13px] leading-[1.65]",
                    message.tone === "ic" ? "text-[#E8E6DF]" : "text-foreground-secondary",
                  )}
                >
                  {message.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-separator-secondary bg-background-tertiary flex flex-col gap-2.5 border-t px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar size="sm" className="bg-accent">
              <AvatarFallback className="text-accent-foreground font-chip text-xs">KP</AvatarFallback>
            </Avatar>
            <span className="text-foreground font-sans text-[13px] font-semibold">KP（主持人）</span>
          </div>
          <div className="bg-default flex items-center gap-0.5 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setMode("roleplay")}
              className={cn(
                "flex h-6 items-center justify-center rounded-full px-3 font-sans text-xs font-semibold",
                mode === "roleplay"
                  ? "from-accent to-accent-hover text-accent-foreground bg-gradient-to-b"
                  : "text-foreground-secondary font-medium",
              )}
            >
              角色扮演
            </button>
            <button
              type="button"
              onClick={() => setMode("ooc")}
              className={cn(
                "flex h-6 items-center justify-center rounded-full px-3 font-sans text-xs font-semibold",
                mode === "ooc"
                  ? "from-accent to-accent-hover text-accent-foreground bg-gradient-to-b"
                  : "text-foreground-secondary font-medium",
              )}
            >
              场外
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="border-separator-secondary flex h-10 flex-1 items-center rounded-xl border bg-field px-3.5">
            <input
              type="text"
              placeholder="以 KP 身份发言 / 旁白…"
              className="text-field-foreground placeholder:text-field-placeholder w-full bg-transparent font-sans text-[13px] outline-none"
            />
          </div>
          <button
            type="button"
            className="from-accent to-accent-hover flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br"
          >
            <Send className="text-accent-foreground size-[17px]" />
          </button>
        </div>

        <p className="text-foreground-tertiary font-sans text-[11px]">演绎时间 · 玩家需申请发言，由你逐条授权</p>
      </div>
    </div>
  );
}

export { GmChatPanel };
