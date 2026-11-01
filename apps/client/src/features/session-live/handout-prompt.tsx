import type { GrantedHandoutDto } from "@cogm/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/api";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { useBlockingDialog } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";

export function HandoutPrompt({ handouts }: { handouts: GrantedHandoutDto[] }) {
  const markHandoutRead = usePlayStore((state) => state.markHandoutRead);
  const unread = handouts.filter((item) => !item.read);
  const newest = unread[unread.length - 1] ?? null;
  const [open, setOpen] = useState(false);
  const dialog = useBlockingDialog("handout", open && newest !== null, setOpen);

  useEffect(() => {
    if (newest) {
      setOpen(true);
    }
  }, [newest?.grantId]);

  function dismiss() {
    if (newest) {
      markHandoutRead(newest.grantId);
      sendSessionCommand("handout:read", { grantId: newest.grantId });
    }
    setOpen(false);
  }

  if (!newest) {
    return null;
  }

  const image = mediaUrl(newest.handout.imageAssetId);

  return (
    <Dialog open={dialog.open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{newest.handout.title}</DialogTitle>
          <DialogDescription>{newest.isPublic ? t("handout.public") : t("handout.secret")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {image ? (
            <div className="bg-md-surface-container-high aspect-video w-full overflow-hidden rounded-lg">
              <img
                src={image}
                alt={t("handout.imageAlt", { title: newest.handout.title })}
                className="size-full object-contain"
              />
            </div>
          ) : null}
          <p className="text-md-on-surface text-body-large whitespace-pre-wrap">
            {newest.handout.content}
          </p>
        </div>
        <Button type="button" variant="primary" onClick={dismiss}>
          {t("handout.accept")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
