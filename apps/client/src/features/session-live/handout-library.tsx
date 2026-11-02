import type { GrantedHandoutDto } from "@cogm/shared";
import { Download, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HandoutPreview, HandoutScopeBadge } from "@/features/session-live/handout-preview";
import { mediaUrl } from "@/lib/api";
import { formatStamp } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useBlockingDialog } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";

export function HandoutLibrary({
  handouts,
  open,
  onOpenChange,
}: {
  handouts: GrantedHandoutDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const dialog = useBlockingDialog("library", open, onOpenChange);
  const markHandoutRead = usePlayStore((state) => state.markHandoutRead);
  const active =
    handouts.find((item) => item.grantId === activeId) ?? handouts[0] ?? null;
  const image = mediaUrl(active?.handout.imageAssetId);

  useEffect(() => {
    if (!dialog.open || !active || active.read) {
      return;
    }
    markHandoutRead(active.grantId);
    sendSessionCommand("handout:read", { grantId: active.grantId });
  }, [active, dialog.open, markHandoutRead]);

  useEffect(() => {
    if (!zoomOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setZoomOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomOpen]);

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>{t("handout.libraryTitle")}</DialogTitle>
          <DialogDescription>{t("handout.libraryDescription")}</DialogDescription>
        </DialogHeader>
        {handouts.length === 0 ? (
          <p className="text-foreground-tertiary text-body-medium">{t("handout.empty")}</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4">
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
              {handouts.map((item) => {
                const selected = item.grantId === active?.grantId;
                return (
                  <button
                  key={item.grantId}
                  type="button"
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
                      selected
                        ? "bg-md-secondary-container text-md-on-secondary-container"
                        : "text-md-on-surface hover:bg-md-on-surface/8",
                    )}
                  onClick={() => setActiveId(item.grantId)}
                >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          selected
                            ? "text-label-medium-emph"
                            : "text-label-medium",
                        )}
                      >
                        {item.handout.title}
                      </span>
                  {item.read ? null : (
                        <Badge
                          variant="solid"
                          tone="accent"
                          size="sm"
                          className="shrink-0"
                        >
                      {t("handout.unread")}
                    </Badge>
                  )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <HandoutScopeBadge isPublic={item.isPublic} className="shrink-0" />
                      <span className="text-md-on-surface-variant truncate text-label-small">
                        {formatStamp(item.grantedAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {active ? (
              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                <div className="flex flex-wrap items-center gap-2">
                  <HandoutScopeBadge isPublic={active.isPublic} />
                  <span className="text-md-on-surface-variant text-label-small">
                    {t("handout.grantedBy", { time: formatStamp(active.grantedAt) })}
                  </span>
                </div>
                <HandoutPreview
                  title={active.handout.title}
                  content={active.handout.content}
                  imageAssetId={active.handout.imageAssetId}
                  imageAlt={t("handout.imageAlt", { title: active.handout.title })}
                  variant="detail"
                  imageActions={
                    image ? (
                      <>
                        <Button
                          type="button"
                          variant="tonal"
                          size="xs"
                          className="h-3 min-h-7 px-2.5 text-label-small"
                          aria-label={t("handout.zoomTitle", { title: active.handout.title })}
                          onClick={() => setZoomOpen(true)}
                        >
                          <Maximize2 className="size-3.5" />
                          {t("handout.zoom")}
                        </Button>
                        <Button
                          asChild
                          variant="tonal"
                          size="xs"
                          className="h-3 min-h-7 px-2.5 text-label-small"
                        >
                          <a
                            href={image}
                            download={`${active.handout.title}.png`}
                            aria-label={t("handout.downloadTitle", { title: active.handout.title })}
                          >
                            <Download className="size-3.5" />
                            {t("handout.download")}
                          </a>
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        )}
        {zoomOpen && image && active ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("handout.originalAlt", { title: active.handout.title })}
            className="absolute inset-0 z-10 flex flex-col gap-2 p-4"
          >
            <button
              type="button"
              aria-label={t("handout.closeOriginal")}
              className="bg-md-scrim/85 absolute inset-0"
              onClick={() => setZoomOpen(false)}
            />
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-foreground min-w-0 flex-1 truncate text-label-medium-emph">
                {active.handout.title}
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  asChild
                  variant="tonal"
                  size="xs"
                  className="h-3 min-h-7 px-2.5 text-label-small"
                >
                  <a href={image} download={`${active.handout.title}.png`}>
                    <Download className="size-3.5" />
                    {t("handout.download")}
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("handout.closeOriginal")}
                  onClick={() => setZoomOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <img
              src={image}
              alt={t("handout.originalAlt", { title: active.handout.title })}
              className="relative min-h-0 w-full flex-1 object-contain"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
