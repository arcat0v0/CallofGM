import { useState } from "react";
import { PanelRightClose, ScrollText, Users, VenetianMask } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterSheetPanel } from "@/features/session-live/character-sheet-panel";
import { HandoutLibrary } from "@/features/session-live/handout-library";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

function ChatPanelHeader({
  compact = false,
  onCollapse,
  browseAllSheets = false,
}: {
  compact?: boolean;
  onCollapse?: () => void;
  browseAllSheets?: boolean;
}) {
  const [handoutsOpen, setHandoutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const handouts = usePlayStore((state) => state.handouts);
  const presence = usePlayStore((state) => state.presence);
  const characters = usePlayStore((state) => state.characters);

  return (
    <header
      className={cn(
        "relative flex items-center justify-between",
        compact ? "border-separator h-10 border-b px-3" : "h-[52px] px-4",
      )}
    >
      <h2 className={cn("text-foreground font-sans font-semibold", compact ? "text-[13px]" : "text-[15px]")}>文字频道</h2>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="人物卡" onClick={() => setSheetOpen(true)}>
          <VenetianMask />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="在线玩家" onClick={() => setPresenceOpen((value) => !value)}>
          <Users />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="情报" onClick={() => setHandoutsOpen(true)}>
          <ScrollText />
        </Button>
        {compact && onCollapse ? (
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
        ) : null}
      </div>
      {presenceOpen ? (
        <div className="border-separator bg-surface absolute top-full right-3 z-20 mt-1 w-56 rounded-xl border p-3 text-xs">
          {presence.length === 0 ? "暂无在线列表" : presence.map((player) => {
            const claimed = characters.find((character) => character.characterId === player.characterId);
            return (
              <div key={player.playerId} className="flex justify-between py-1">
                <span>{claimed?.name ?? player.playerId.slice(0, 8)}</span>
                <span>{player.role === "ob" ? "OB" : "PC"}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <HandoutLibrary handouts={handouts} open={handoutsOpen} onOpenChange={setHandoutsOpen} />
      <CharacterSheetPanel open={sheetOpen} onOpenChange={setSheetOpen} browseAll={browseAllSheets} />
    </header>
  );
}

export { ChatPanelHeader };
