import type { OnlinePlayerDto, SnapshotCharacter } from "@cogm/shared";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

function PresenceList({
  players,
  characters,
  showAvatar = true,
  renderActions,
  className,
  rowClassName,
  emptyLabel,
}: {
  players: OnlinePlayerDto[];
  characters: SnapshotCharacter[];
  showAvatar?: boolean;
  renderActions?: (player: OnlinePlayerDto, name: string) => ReactNode;
  className?: string;
  rowClassName?: string;
  emptyLabel?: string;
}) {
  if (players.length === 0) {
    return (
      <p className={cn("text-md-on-surface-variant px-2 py-1 text-label-small", className)}>
        {emptyLabel ?? t("chat.noPresence")}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {players.map((player) => {
        const character = characters.find((item) => item.characterId === player.characterId);
        const name = character?.name ?? player.playerId.slice(0, 8);
        return (
          <div
            key={player.playerId}
            className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", rowClassName)}
          >
            {showAvatar ? (
              <Avatar size="sm" className="bg-default size-7 shrink-0">
                <AvatarFallback className="text-foreground text-label-small">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
            ) : null}
            <span className="min-w-0 flex-1 truncate text-label-medium">{name}</span>
            <Badge variant="soft" tone="accent" size="sm" className="shrink-0">
              {player.role === "ob" ? t("common.ob") : t("common.pc")}
            </Badge>
            {renderActions?.(player, name)}
          </div>
        );
      })}
    </div>
  );
}

export { PresenceList };
