import { useState } from "react";
import { ShieldBan, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { PresenceList } from "@/features/session-live/presence-list";
import { formatClock } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { t } from "@/i18n";

function GmOnlinePopover() {
  const presence = usePlayStore((state) => state.presence);
  const kickedPlayers = usePlayStore((state) => state.kickedPlayers);
  const characters = usePlayStore((state) => state.characters);
  const [banPlayerId, setBanPlayerId] = useState<string | null>(null);
  const banTarget = presence.find((player) => player.playerId === banPlayerId);
  const banName =
    characters.find((character) => character.characterId === banTarget?.characterId)?.name ??
    banTarget?.playerId.slice(0, 8) ??
    t("common.player");

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="tertiary" size="sm" className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 h-10 gap-2 rounded-full px-4">
            <Users className="size-5" />
            {t("gm.workbench.onlineCount", { count: presence.length })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="bg-md-surface-container-low w-80 p-0">
          <div className="flex max-h-[min(60dvh,380px)] flex-col">
            <p className="text-label-medium-emph px-4 pt-4 pb-2">
              {t("chat.presenceTitle", { count: presence.length })}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <PresenceList
                players={presence}
                characters={characters}
                showAvatar={false}
                rowClassName="hover:bg-md-on-surface/8"
                renderActions={(player, name) => (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-danger-soft-foreground size-7 shrink-0"
                      aria-label={t("gm.console.kickAria", { name })}
                      title={t("gm.console.kick")}
                      onClick={() => sendSessionCommand("player:kick", { playerId: player.playerId })}
                    >
                      <UserX className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-md-on-surface-variant size-7 shrink-0"
                      aria-label={t("gm.console.banAria", { name })}
                      title={t("gm.console.ban")}
                      onClick={() => setBanPlayerId(player.playerId)}
                    >
                      <ShieldBan className="size-3.5" />
                    </Button>
                  </>
                )}
              />
            </div>
            {kickedPlayers.length > 0 ? (
              <div className="border-separator-secondary border-t px-2 pt-2 pb-3">
                <p className="text-label-medium-emph px-2 pb-1">{t("gm.console.kickedTitle", { count: kickedPlayers.length })}</p>
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {kickedPlayers.map((kicked) => {
                    const name = kicked.displayName ?? kicked.playerId.slice(0, 8);
                    return (
                      <div key={kicked.playerId} className="flex items-center gap-2 rounded-lg px-2 py-1">
                        <span className="min-w-0 flex-1 truncate text-label-medium">{name}</span>
                        <span className="text-md-on-surface-variant text-label-small">{formatClock(kicked.createdAt)}</span>
                        <Button
                          type="button"
                          size="xs"
                          variant="accentSoft"
                          className="h-7 px-2 text-label-small"
                          onClick={() => sendSessionCommand("player:unkick", { playerId: kicked.playerId })}
                        >
                          {t("gm.console.unkick")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <BanPlayerDialog
        open={banPlayerId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBanPlayerId(null);
          }
        }}
        playerName={banName}
        roleLabel={banTarget?.role === "ob" ? t("common.ob") : t("common.player")}
        defaultPlayerId={banPlayerId ?? ""}
        onBan={(input) => {
          sendSessionCommand("player:ban", {
            playerId: input.playerId,
            reason: input.reason,
            ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
          });
        }}
      />
    </>
  );
}

export { GmOnlinePopover };