import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Ellipsis, Link as LinkIcon, Palette, Settings2, SquarePower } from "lucide-react";
import type { SessionStatus } from "@cogm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { nextSessionStatus, nextStatusActionLabel, statusTone } from "@/lib/format";
import { sessionStatusLabel } from "@/i18n/labels";
import { GmThemeDialog } from "@/themes/runtime/gm-theme-control";
import { usePlayStore } from "@/stores/play-store";
import { t } from "@/i18n";
import { GmOnlinePopover } from "./gm-online-popover";
import { GmSessionSettingsDialog } from "./gm-session-settings-dialog";
import { StageLayoutControl } from "./stage-layout-control";

function GmTopBar() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const status = usePlayStore((state) => state.status);
  const moduleName = usePlayStore((state) => state.moduleName);
  const sessionName = usePlayStore((state) => state.sessionName);
  const scene = usePlayStore((state) => state.scene);
  const presenceAvailable = usePlayStore((state) => state.presenceAvailable);
  const [endOpen, setEndOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const nextStatus = status ? nextSessionStatus(status) : null;
  const title = moduleName ?? sessionName ?? scene?.name ?? sessionId;
  const subtitleBase =
    sessionName && sessionName !== moduleName
      ? `${sessionName} · ${t("gm.workbench.role")}`
      : t("gm.workbench.role");
  const subtitle = status === "ended" ? `${subtitleBase} · ${t("gm.workbench.endedLock")}` : subtitleBase;

  async function patchStatus(next: SessionStatus) {
    try {
      await api(`/gm/sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
    } catch (error) {
      toast.error(errorText(error, "play.statusUpdateFailed"));
    }
  }

  function copyLink() {
    void navigator.clipboard
      .writeText(`${location.origin}/join/${encodeURIComponent(sessionId)}`)
      .then(
        () => toast.success(t("play.copied")),
        () => toast.error(t("play.copyFailed")),
      );
  }

  return (
    <div className="flex h-16 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Button asChild variant="tertiary" size="icon-sm" className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-11 shrink-0">
          <Link to="/gm" aria-label={t("play.backstage")}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-col">
          <span className="text-md-on-surface truncate font-serif text-headline-small font-semibold">{title}</span>
          <span className="text-md-on-surface-variant truncate text-label-medium">{subtitle}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {status ? (
          <Badge
            variant="soft"
            tone={status === "active" ? "accent" : statusTone(status)}
            size="lg"
            className="h-7 px-4 text-label-large-emph"
          >
            {sessionStatusLabel(status)}
          </Badge>
        ) : null}
        <StageLayoutControl />
        {presenceAvailable ? <GmOnlinePopover /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="tertiary"
              size="icon-sm"
              aria-label={t("gm.workbench.moreActions")}
              className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-10"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {status && nextStatus && nextStatus !== "ended" ? (
              <DropdownMenuItem onSelect={() => void patchStatus(nextStatus)}>
                <ArrowRight />
                {nextStatusActionLabel(status) ?? t("play.advance")}
              </DropdownMenuItem>
            ) : null}
            {status !== "ended" ? (
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Settings2 />
                {t("gm.workbench.settings")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={copyLink}>
              <LinkIcon />
              {t("play.copyLink")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setThemeOpen(true)}>
              <Palette />
              {t("gm.workbench.theme")}
            </DropdownMenuItem>
            {status === "active" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setEndOpen(true)}>
                  <SquarePower />
                  {t("play.endSession")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-full text-label-small-emph">
          {t("common.gmShort")}
        </span>
      </div>

      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        icon={SquarePower}
        title={t("gm.console.endConfirmTitle")}
        description={t("gm.console.endConfirmDescription")}
        confirmLabel={t("gm.console.endConfirmAction")}
        variant="danger"
        onConfirm={() => {
          setEndOpen(false);
          void patchStatus("ended");
        }}
      />
      <GmSessionSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <GmThemeDialog open={themeOpen} onOpenChange={setThemeOpen} />
    </div>
  );
}

export { GmTopBar };