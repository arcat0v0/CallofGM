import { useState } from "react";
import {
  Clapperboard,
  Dices,
  HeartPulse,
  MessageSquareText,
  Music2,
  ScrollText,
  SlidersHorizontal,
  Users,
  VenetianMask,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canPlayerInitiateDiceRoll } from "@cogm/shared";
import type { PlayViewport } from "@cogm/theme-sdk";
import { PanelHeading } from "@/components/shared/panel-heading";
import { ToolDock, ToolDockButton } from "@/components/shared/tool-dock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CharacterSheetPanel } from "@/features/session-live/character-sheet-panel";
import { DiceTray } from "@/features/session-live/dice-tray";
import { HandoutLibrary } from "@/features/session-live/handout-library";
import { PresenceList } from "@/features/session-live/presence-list";
import type { PlayDisplayKey } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayDisplayStore } from "@/stores/play-display-store";
import { usePlayStore } from "@/stores/play-store";

const DISPLAY_OPTIONS: ReadonlyArray<{ key: PlayDisplayKey; labelKey: string; icon: LucideIcon }> = [
  { key: "sceneInfo", labelKey: "play.displaySceneInfo", icon: Clapperboard },
  { key: "audio", labelKey: "play.displayAudio", icon: Music2 },
  { key: "characterStatus", labelKey: "play.displayCharacterStatus", icon: HeartPulse },
  { key: "dialogue", labelKey: "play.displayDialogue", icon: MessageSquareText },
  { key: "handoutPrompt", labelKey: "play.displayHandoutPrompt", icon: ScrollText },
];

function DisplaySettings() {
  const settings = usePlayDisplayStore((state) => state.settings);
  const setVisible = usePlayDisplayStore((state) => state.setVisible);
  const reset = usePlayDisplayStore((state) => state.reset);

  return (
    <div className="flex flex-col gap-0.5">
      {DISPLAY_OPTIONS.map((option) => (
        <div
          key={option.key}
          className="hover:bg-md-on-surface/5 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-standard-fast-effects"
        >
          <option.icon className="text-md-on-surface-variant size-4 shrink-0" />
          <span className="text-md-on-surface min-w-0 flex-1 text-label-medium">
            {t(option.labelKey)}
          </span>
          <Switch
            size="sm"
            checked={settings[option.key]}
            aria-label={t(option.labelKey)}
            onCheckedChange={(checked) => setVisible(option.key, Boolean(checked))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-md-on-surface-variant mt-1 h-8 w-full text-label-small"
        onClick={reset}
      >
        {t("play.displayReset")}
      </Button>
    </div>
  );
}

function PlayerActionDock({ variant }: { variant: PlayViewport }) {
  const characters = usePlayStore((state) => state.characters);
  const playerId = useIdentityStore((state) => state.playerId);
  const seatRole = usePlayStore((state) => state.viewer.seatRole);
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const handouts = usePlayStore((state) => state.handouts);
  const presence = usePlayStore((state) => state.presence);
  const presenceAvailable = usePlayStore((state) => state.presenceAvailable);
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const resumeChecks = usePlayStore((state) => state.resumeChecks);
  const [diceOpen, setDiceOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [handoutsOpen, setHandoutsOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  const claimed = characters.find(
    (character) => character.claim?.playerId === playerId && character.claim.role === "pc",
  );
  const ended = status === "ended";
  const diceDisabled =
    ended || phase === null || !canPlayerInitiateDiceRoll(phase, "player", seatRole);
  const unread = handouts.filter((item) => !item.read).length;
  const pendingCount = ended ? 0 : pendingChecks.length;
  const showLabel = variant === "desktop";

  const diceTray = <DiceTray characterId={claimed?.characterId} disabled={diceDisabled} />;
  const pendingChecksNotice =
    pendingCount > 0 ? (
      <div className="border-warning/30 bg-warning-soft/40 flex items-center gap-2 rounded-lg border px-3 py-2">
        <Dices className="text-warning size-4 shrink-0" />
        <span className="text-warning-soft-foreground min-w-0 flex-1 text-label-small">
          {t("dice.pendingRequests", { count: pendingCount })}
        </span>
        <Button
          type="button"
          variant="accentSoft"
          size="xs"
          className="h-7 shrink-0 px-2 text-label-small"
          onClick={() => {
            resumeChecks();
            setDiceOpen(false);
          }}
        >
          {t("dice.resumeRequests")}
        </Button>
      </div>
    ) : null;

  return (
    <ToolDock
      label={t("play.actions")}
      className={cn(
        "bg-md-surface-container-low/90 border-md-outline-variant/40 border",
        showLabel ? "p-1.5 shadow-overlay" : "p-1 shadow-card",
      )}
    >
      {variant === "desktop" ? (
        <Popover open={diceOpen} onOpenChange={setDiceOpen}>
          <PopoverTrigger asChild>
            <ToolDockButton
              icon={Dices}
              label={t("chat.diceAria")}
              active={diceOpen}
              badge={pendingCount}
              showLabel={showLabel}
              wideOnlyLabel
            />
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="bottom"
            sideOffset={12}
            className="bg-md-surface-container-low border-md-outline-variant/40 shadow-overlay w-[400px] rounded-xl border p-4"
          >
            <div className="flex flex-col gap-3">
              <PanelHeading
                size="sm"
                className="gap-0.5"
                title={t("dice.panelTitle")}
                description={t("dice.panelDescription")}
              />
              {pendingChecksNotice}
              {diceTray}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <ToolDockButton
          icon={Dices}
          label={t("chat.diceAria")}
          active={diceOpen}
          badge={pendingCount}
          showLabel={showLabel}
          onClick={() => setDiceOpen(true)}
        />
      )}

      <ToolDockButton
        icon={VenetianMask}
        label={t("chat.sheet")}
        showLabel={showLabel}
        wideOnlyLabel
        onClick={() => setSheetOpen(true)}
      />
      <ToolDockButton
        icon={ScrollText}
        label={t("chat.handouts")}
        badge={unread}
        showLabel={showLabel}
        wideOnlyLabel
        onClick={() => setHandoutsOpen(true)}
      />
      {presenceAvailable ? (
        <Popover>
          <PopoverTrigger asChild>
            <ToolDockButton
              icon={Users}
              label={t("chat.presence")}
              showLabel={showLabel}
              wideOnlyLabel
            />
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" sideOffset={10} className="w-64 p-0">
            <div className="flex max-h-[min(50dvh,320px)] flex-col">
              <p className="text-label-medium-emph px-4 pt-4 pb-2">
                {t("chat.presenceTitle", { count: presence.length })}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <PresenceList players={presence} characters={characters} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {variant === "desktop" ? (
        <Popover open={displayOpen} onOpenChange={setDisplayOpen}>
          <PopoverTrigger asChild>
            <ToolDockButton
              icon={SlidersHorizontal}
              label={t("play.display")}
              active={displayOpen}
              showLabel={showLabel}
              wideOnlyLabel
            />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={12}
            className="bg-md-surface-container-low border-md-outline-variant/40 shadow-overlay w-[300px] rounded-xl border p-3"
          >
            <div className="flex flex-col gap-1">
              <PanelHeading
                size="sm"
                className="gap-0.5 px-1 pb-1"
                title={t("play.display")}
                description={t("play.displayDescription")}
              />
              <DisplaySettings />
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <ToolDockButton
          icon={SlidersHorizontal}
          label={t("play.display")}
          active={displayOpen}
          showLabel={showLabel}
          onClick={() => setDisplayOpen(true)}
        />
      )}

      {variant !== "desktop" ? (
        <Dialog open={displayOpen} onOpenChange={setDisplayOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("play.display")}</DialogTitle>
              <DialogDescription>{t("play.displayDescription")}</DialogDescription>
            </DialogHeader>
            <DisplaySettings />
          </DialogContent>
        </Dialog>
      ) : null}

      {variant !== "desktop" ? (
        <Dialog open={diceOpen} onOpenChange={setDiceOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("dice.panelTitle")}</DialogTitle>
              <DialogDescription>{t("dice.panelDescription")}</DialogDescription>
            </DialogHeader>
            {pendingChecksNotice}
            {diceTray}
          </DialogContent>
        </Dialog>
      ) : null}
      <CharacterSheetPanel open={sheetOpen} onOpenChange={setSheetOpen} />
      <HandoutLibrary handouts={handouts} open={handoutsOpen} onOpenChange={setHandoutsOpen} />
    </ToolDock>
  );
}

export { PlayerActionDock };
