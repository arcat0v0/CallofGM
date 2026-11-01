import { useState, type ReactNode } from "react";
import { Dices, LogOut, PanelRightClose, ScrollText, Users, VenetianMask } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CharacterSheetPanel } from "@/features/session-live/character-sheet-panel";
import { HandoutLibrary } from "@/features/session-live/handout-library";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

function ChatPanelHeader({
  compact = false,
  onCollapse,
  onLeaveSeat,
  children,
}: {
  compact?: boolean;
  onCollapse?: () => void;
  onLeaveSeat?: () => void;
  children?: ReactNode;
}) {
  const [handoutsOpen, setHandoutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const handouts = usePlayStore((state) => state.handouts);
  const presence = usePlayStore((state) => state.presence);
  const presenceAvailable = usePlayStore((state) => state.presenceAvailable);
  const characters = usePlayStore((state) => state.characters);
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const resumeChecks = usePlayStore((state) => state.resumeChecks);

  return (
    <Popover>
      <header
        className={cn(
          "relative flex items-center justify-between",
          compact ? "h-10 px-3" : "h-[52px] px-4",
        )}
      >
        <h2
          className={cn(
            "text-foreground shrink-0 font-serif whitespace-nowrap",
            compact ? "text-title-small-emph" : "text-title-medium-emph",
          )}
        >
          文字频道
        </h2>
        <div className={cn("flex shrink-0 items-center", compact ? "gap-0.5" : "gap-1")}>
          <Button variant="tertiary" size="icon-sm" aria-label="人物卡" onClick={() => setSheetOpen(true)}>
            <VenetianMask />
          </Button>
          {presenceAvailable ? (
            <PopoverTrigger asChild>
              <Button variant="tertiary" size="icon-sm" aria-label="在线玩家">
                <Users />
              </Button>
            </PopoverTrigger>
          ) : null}
          <Button variant="tertiary" size="icon-sm" aria-label="情报" onClick={() => setHandoutsOpen(true)}>
            <ScrollText />
          </Button>
          {pendingChecks.length > 0 ? (
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label={`待处理鉴定 ${pendingChecks.length}`}
              onClick={resumeChecks}
              className="relative"
            >
              <Dices />
              <span className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[10px] leading-none tabular-nums">
                {pendingChecks.length}
              </span>
            </Button>
          ) : null}
          {onLeaveSeat ? (
            <Button variant="tertiary" size="icon-sm" aria-label="离开座位" onClick={onLeaveSeat}>
              <LogOut />
            </Button>
          ) : null}
          {compact && onCollapse ? (
            <Button
              type="button"
              variant="tertiary"
              size="icon-sm"
              onClick={onCollapse}
              aria-label="收起文字频道"
              className="size-7"
            >
              <PanelRightClose />
            </Button>
          ) : null}
        </div>
        <HandoutLibrary handouts={handouts} open={handoutsOpen} onOpenChange={setHandoutsOpen} />
        <CharacterSheetPanel open={sheetOpen} onOpenChange={setSheetOpen} />
      </header>
      {children}
      {presenceAvailable ? (
        <>
          <PopoverAnchor asChild>
            <div aria-hidden className="pointer-events-none mr-3 h-0" />
          </PopoverAnchor>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            avoidCollisions={false}
            className="w-56 p-3 text-body-small"
          >
            <p className="text-label-medium-emph mb-1">在线玩家 · {presence.length}</p>
            {presence.length === 0 ? (
              <p className="text-md-on-surface-variant text-label-small">暂无在线玩家</p>
            ) : (
              presence.map((player) => {
                const claimed = characters.find((character) => character.characterId === player.characterId);
                return (
                  <div key={player.playerId} className="flex justify-between py-1">
                    <span>{claimed?.name ?? player.playerId.slice(0, 8)}</span>
                    <span>{player.role === "ob" ? "OB" : "PC"}</span>
                  </div>
                );
              })
            )}
          </PopoverContent>
        </>
      ) : null}
    </Popover>
  );
}

export { ChatPanelHeader };
