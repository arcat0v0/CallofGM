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

export function HandoutPrompt({ handouts }: { handouts: GrantedHandoutDto[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const newest = [...handouts].reverse().find((item) => !seen.has(item.grantId)) ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (newest) {
      setOpen(true);
    }
  }, [newest?.grantId]);

  function dismiss() {
    if (newest) {
      setSeen((current) => new Set(current).add(newest.grantId));
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
        {image ? <img src={image} alt="" className="max-h-64 w-full rounded-sm object-contain" /> : null}
        <p className="text-foreground-secondary text-body-medium whitespace-pre-wrap">{newest.handout.content}</p>
        <Button type="button" variant="primary" onClick={dismiss}>
          收下
        </Button>
      </DialogContent>
    </Dialog>
  );
}
