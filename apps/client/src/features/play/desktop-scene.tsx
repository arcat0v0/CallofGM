import { Music2, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bgmTrackName, dialogue, portraits, sceneImage, sessionStatusLabel, sessionTitle, sessionPhaseLabel } from "./mock-data";

function DesktopScene() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={sceneImage} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#1C1C1CD9] to-transparent" />

      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-[308px] left-[236px] h-[592px] w-[300px] object-cover object-top"
      />
      <img
        src={portraits.takuma}
        alt="白石拓真"
        className="absolute top-[340px] left-[556px] h-[560px] w-[284px] object-cover object-top opacity-[0.88]"
      />

      <div className="absolute top-5 left-6 flex items-center gap-2.5">
        <span className="text-foreground font-serif text-lg font-semibold">{sessionTitle}</span>
        <Badge variant="soft" tone="success" size="sm">
          {sessionStatusLabel}
        </Badge>
        <Badge variant="soft" tone="accent" size="sm">
          {sessionPhaseLabel}
        </Badge>
      </div>

      <div className="absolute top-5 right-6 flex h-10 w-[306px] items-center gap-2.5 rounded-full border border-[#3B3B39] bg-[#1C1C1CCC] px-3.5 backdrop-blur-lg">
        <Music2 className="size-[15px] shrink-0 text-accent-hover" />
        <span className="text-foreground min-w-0 flex-1 truncate font-sans text-xs">{bgmTrackName}</span>
        <div className="relative h-4 w-16 shrink-0">
          <div className="absolute top-1.5 h-1 w-16 rounded-full bg-white/[0.18]" />
          <div className="absolute top-1.5 h-1 w-10 rounded-full bg-accent-hover" />
          <div className="bg-foreground absolute top-0.5 left-[34px] size-3 rounded-full" />
        </div>
        <Volume2 className="text-foreground-secondary size-[15px] shrink-0" />
      </div>

      <div
        className="absolute bottom-[36px] left-10 flex w-[968px] flex-col gap-2 rounded-2xl px-6 py-[18px] shadow-[0_8px_24px_0_#00000066] backdrop-blur-md"
        style={{
          background:
            "linear-gradient(#1C1C1CE0, #1C1C1CE0) padding-box, linear-gradient(90deg, #7BA23F, #86C166) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-[17px] font-semibold text-accent-hover">{dialogue.speaker}</span>
          <Badge variant="soft" tone="accent" size="sm">
            {dialogue.roleLabel}
          </Badge>
        </div>
        <p className="text-foreground font-sans text-[15px] leading-[1.9]">{dialogue.text}</p>
      </div>
    </div>
  );
}

export { DesktopScene };
