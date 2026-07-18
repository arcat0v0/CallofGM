import { Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { dialogue, portraits, sceneImage, sessionStatusLabel, sessionTitle } from "@/features/session-stage/mock-data";

function MobilePortraitScene() {
  return (
    <div className="relative h-[330px] w-full shrink-0 overflow-hidden">
      <img
        src={sceneImage}
        alt="雨夜的图书馆场景"
        className="absolute top-[-30px] left-[-40px] h-[390px] w-[470px] max-w-none object-cover"
      />
      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-6 left-24 h-[414px] w-[210px] object-cover object-top"
      />
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-stage-scrim-strong to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-[52px] items-center justify-between px-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-foreground truncate font-serif text-sm font-semibold">{sessionTitle}</span>
          <Badge variant="soft" tone="success" size="sm">
            {sessionStatusLabel}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="查看当前背景音乐"
          className="bg-backdrop/25 rounded-full"
        >
          <Music2 className="text-accent-hover size-4" />
        </Button>
      </div>

      <DialogueBox
        speaker={dialogue.speaker}
        roleLabel={dialogue.roleLabel}
        text={dialogue.text}
        size="sm"
        className="absolute inset-x-3 top-[214px]"
      />
    </div>
  );
}

export { MobilePortraitScene };
