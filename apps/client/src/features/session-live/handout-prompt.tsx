import { useEffect, useState } from "react";
import type { GrantedHandoutDto } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/api";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";

export function HandoutPrompt({ handouts }: { handouts: GrantedHandoutDto[] }) {
  const markHandoutRead = usePlayStore((state) => state.markHandoutRead);
  const unread = handouts.filter((item) => !item.read);
  const newest = unread[unread.length - 1] ?? null;
  const [open, setOpen] = useState(false);

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
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{newest.handout.title}</DialogTitle>
          <DialogDescription>{newest.isPublic ? "公开情报" : "秘密情报"}</DialogDescription>
        </DialogHeader>
        {image ? <img src={image} alt="" className="max-h-64 w-full rounded-lg object-contain" /> : null}
        <p className="text-md-on-surface text-body-large whitespace-pre-wrap">{newest.handout.content}</p>
        <Button type="button" variant="primary" onClick={dismiss}>
          收下
        </Button>
      </DialogContent>
    </Dialog>
  );
}
