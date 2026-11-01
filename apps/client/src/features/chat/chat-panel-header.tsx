import {
  Dices,
  LogOut,
  PanelRightClose,
  ScrollText,
  ShieldBan,
  Users,
  UserX,
  VenetianMask,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { CharacterSheetPanel } from "@/features/session-live/character-sheet-panel";
import { HandoutLibrary } from "@/features/session-live/handout-library";
import { sendSessionCommand } from "@/lib/session-socket";
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
  const [banPlayerId, setBanPlayerId] = useState<string | null>(null);
  const handouts = usePlayStore((state) => state.handouts);
  const presence = usePlayStore((state) => state.presence);
  const presenceAvailable = usePlayStore((state) => state.presenceAvailable);
  const characters = usePlayStore((state) => state.characters);
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const resumeChecks = usePlayStore((state) => state.resumeChecks);
  const banTarget = presence.find((player) => player.playerId === banPlayerId);
  const banName =
    characters.find(
      (character) => character.characterId === banTarget?.characterId,
    )?.name ??
    banTarget?.playerId.slice(0, 8) ??
    "玩家";

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
        <div
          className={cn(
            "flex shrink-0 items-center",
            compact ? "gap-0.5" : "gap-1",
          )}
        >
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="人物卡"
            onClick={() => setSheetOpen(true)}
          >
            <VenetianMask />
          </Button>
          {presenceAvailable ? (
            <PopoverTrigger asChild>
              <Button variant="tertiary" size="icon-sm" aria-label="在线玩家">
                <Users />
              </Button>
            </PopoverTrigger>
          ) : null}
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="情报"
            onClick={() => setHandoutsOpen(true)}
          >
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
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="离开座位"
              onClick={onLeaveSeat}
            >
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
        <HandoutLibrary
          handouts={handouts}
          open={handoutsOpen}
          onOpenChange={setHandoutsOpen}
        />
        <CharacterSheetPanel open={sheetOpen} onOpenChange={setSheetOpen} />
      </header>
      {presenceAvailable ? (
        <>
          {children ? <PopoverAnchor>{children}</PopoverAnchor> : null}
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            collisionPadding={8}
            className="w-64 p-0 text-body-small"
          >
            <div className="flex max-h-[min(60dvh,320px)] flex-col">
              <p className="text-label-medium-emph px-3 pt-3 pb-1.5">
                在线玩家 · {presence.length}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {presence.length === 0 ? (
                  <p className="text-md-on-surface-variant px-1 py-1 text-label-small">
                    暂无在线玩家
                  </p>
            ) : (
              presence.map((player) => {
                    const claimed = characters.find(
                      (character) =>
                        character.characterId === player.characterId,
                    );
                    const name = claimed?.name ?? player.playerId.slice(0, 8);
                return (
                      <div
                        key={player.playerId}
                        className="flex items-center gap-1.5 rounded-lg px-1 py-1"
                      >
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        <Badge
                          variant="soft"
                          tone="accent"
                          size="sm"
                          className="shrink-0"
                        >
                          {player.role === "ob" ? "OB" : "PC"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger-soft-foreground size-7 shrink-0"
                          aria-label={`踢出 ${name}`}
                          title="踢出"
                          onClick={() =>
                            sendSessionCommand("player:kick", {
                              playerId: player.playerId,
                            })
                          }
                        >
                          <UserX className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-md-on-surface-variant size-7 shrink-0"
                          aria-label={`拉黑 ${name}`}
                          title="拉黑"
                          onClick={() => setBanPlayerId(player.playerId)}
                        >
                          <ShieldBan className="size-3.5" />
                        </Button>
                  </div>
                );
              })
            )}
              </div>
            </div>
          </PopoverContent>
          <BanPlayerDialog
            open={banPlayerId !== null}
            onOpenChange={(open) => {
              if (!open) setBanPlayerId(null);
            }}
            playerName={banName}
            roleLabel={banTarget?.role === "ob" ? "OB" : "玩家"}
            defaultPlayerId={banPlayerId ?? ""}
            onBan={(input) => {
              sendSessionCommand("player:ban", {
                playerId: input.playerId,
                reason: input.reason,
                ...(input.durationSeconds
                  ? { durationSeconds: input.durationSeconds }
                  : {}),
              });
            }}
          />
        </>
      ) : (
        children
      )}
    </Popover>
  );
}

export { ChatPanelHeader };
