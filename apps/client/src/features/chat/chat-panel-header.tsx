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
import { t } from "@/i18n";
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
    t("common.player");

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
          {t("chat.title")}
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
            aria-label={t("chat.sheet")}
            onClick={() => setSheetOpen(true)}
          >
            <VenetianMask />
          </Button>
          {presenceAvailable ? (
            <PopoverTrigger asChild>
              <Button variant="tertiary" size="icon-sm" aria-label={t("chat.presence")}>
                <Users />
              </Button>
            </PopoverTrigger>
          ) : null}
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label={t("chat.handouts")}
            onClick={() => setHandoutsOpen(true)}
          >
            <ScrollText />
          </Button>
          {pendingChecks.length > 0 ? (
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label={t("chat.pendingChecks", { count: pendingChecks.length })}
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
              aria-label={t("chat.leaveSeat")}
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
              aria-label={t("chat.collapse")}
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
                {t("chat.presenceTitle", { count: presence.length })}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {presence.length === 0 ? (
                  <p className="text-md-on-surface-variant px-1 py-1 text-label-small">
                    {t("chat.noPresence")}
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
                          {player.role === "ob" ? t("common.ob") : t("common.pc")}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger-soft-foreground size-7 shrink-0"
                          aria-label={t("chat.kickLabel", { name })}
                          title={t("chat.kick")}
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
                          aria-label={t("chat.banLabel", { name })}
                          title={t("chat.ban")}
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
            roleLabel={banTarget?.role === "ob" ? t("common.ob") : t("common.player")}
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
