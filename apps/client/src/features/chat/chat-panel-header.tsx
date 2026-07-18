import { PanelRightClose, ScrollText, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ChatPanelHeader({ compact = false, onCollapse }: { compact?: boolean; onCollapse?: () => void }) {
  return (
    <header
      className={cn(
        "flex items-center justify-between",
        compact ? "border-separator h-10 border-b px-3" : "h-[52px] px-4",
      )}
    >
      <h2 className={cn("text-foreground font-sans font-semibold", compact ? "text-[13px]" : "text-[15px]")}>文字频道</h2>
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCollapse}
          aria-label="收起文字频道"
          className="size-7 text-foreground-secondary"
        >
          <PanelRightClose />
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="在线玩家">
            <Users />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="聊天记录">
            <ScrollText />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="频道设置">
            <Settings />
          </Button>
        </div>
      )}
    </header>
  );
}

export { ChatPanelHeader };
