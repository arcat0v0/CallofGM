import { Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dialogue, portraits, sceneImage, sessionStatusLabel, sessionTitle } from "./mock-data";

function MobilePortraitScene() {
  return (
    <div className="relative h-[330px] w-full shrink-0 overflow-hidden">
      <img
        src={sceneImage}
        alt=""
        className="absolute top-[-30px] left-[-40px] h-[390px] w-[470px] max-w-none object-cover"
      />
      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-6 left-24 h-[414px] w-[210px] object-cover object-top"
      />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#1C1C1CE6] to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-[52px] items-center justify-between px-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-foreground truncate font-serif text-sm font-semibold">{sessionTitle}</span>
          <Badge variant="soft" tone="success" size="sm">
            {sessionStatusLabel}
          </Badge>
        </div>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/20"
        >
          <Music2 className="text-accent-hover size-4" />
        </button>
      </div>

      <div
        className="absolute top-[224px] left-3 flex h-[92px] w-[366px] flex-col gap-1.5 rounded-[14px] px-4 py-3 backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(#1C1C1CE0, #1C1C1CE0) padding-box, linear-gradient(90deg, #7BA23F, #86C166) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-serif text-sm font-semibold text-accent-hover">{dialogue.speaker}</span>
          <Badge variant="soft" tone="accent" size="sm">
            {dialogue.roleLabel}
          </Badge>
        </div>
        <p className="text-foreground font-sans text-[13px] leading-[1.7]">{dialogue.text}</p>
      </div>
    </div>
  );
}

export { MobilePortraitScene };
