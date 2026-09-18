import { useState } from "react";
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
  const active = handouts.find((item) => item.grantId === activeId) ?? handouts[0] ?? null;
  const image = mediaUrl(active?.handout.imageAssetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>已获得的情报</DialogTitle>
          <DialogDescription>公开与秘密线索均可在此回看，无法撤回。</DialogDescription>
        </DialogHeader>
        {handouts.length === 0 ? (
          <p className="text-foreground-tertiary text-body-medium">还没有收到情报。</p>
        ) : (
          <div className="grid grid-cols-[180px_1fr] gap-3">
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {handouts.map((item) => (
                <Button
                  key={item.grantId}
                  type="button"
                  variant={item.grantId === active?.grantId ? "accentSoft" : "ghost"}
                  className="h-auto justify-start px-2 py-2 text-left text-label-medium"
                  onClick={() => setActiveId(item.grantId)}
                >
                  {item.handout.title}
                </Button>
              ))}
            </div>
            {active ? (
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                <div className="text-foreground-tertiary text-label-small">{active.isPublic ? "公开情报" : "秘密情报"}</div>
                {image ? <img src={image} alt="" className="max-h-56 w-full rounded-sm object-contain" /> : null}
                <p className="text-foreground-secondary text-body-medium whitespace-pre-wrap">{active.handout.content}</p>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
