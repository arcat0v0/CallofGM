import { Music2 } from "lucide-react";
import { dialogue, portraits, sceneImage } from "./mock-data";

function MobileLandscapeScene() {
  return (
    <div className="relative h-full min-w-0 flex-1 overflow-hidden">
      <img
        src={sceneImage}
        alt=""
        className="absolute top-[-40px] left-[-30px] h-[470px] w-[620px] max-w-none object-cover"
      />
      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-9 left-[70px] h-[454px] w-[230px] object-cover object-top"
      />
      <img
        src={portraits.takuma}
        alt="白石拓真"
        className="absolute top-[70px] left-[300px] h-[420px] w-[210px] object-cover object-top opacity-85"
      />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#1C1C1CD9] to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between px-3.5">
        <span className="text-foreground truncate font-serif text-sm font-semibold">沉没的记忆 · 第三夜</span>
        <div className="flex h-[30px] items-center gap-[7px] rounded-full border border-[#3B3B39] bg-[#1C1C1CCC] px-2.5 backdrop-blur-md">
          <Music2 className="text-accent-hover size-3.5 shrink-0" />
          <span className="text-foreground font-sans text-[11px]">雨夜的图书馆</span>
        </div>
      </div>

      <div
        className="absolute top-[290px] left-4 flex h-[88px] w-[528px] flex-col gap-1 rounded-[14px] px-4 py-2.5 backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(#1C1C1CDB, #1C1C1CDB) padding-box, linear-gradient(90deg, #7BA23F, #86C166) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <span className="font-serif text-sm font-semibold text-accent-hover">{dialogue.speaker}</span>
        <p className="text-foreground font-sans text-[13px] leading-[1.6]">{dialogue.text}</p>
      </div>
    </div>
  );
}

export { MobileLandscapeScene };
