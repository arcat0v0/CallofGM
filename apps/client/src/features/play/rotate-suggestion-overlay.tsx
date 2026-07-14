import { RotateCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

function RotateSuggestionOverlay({ onDismiss, className }: { onDismiss: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex items-center justify-center bg-[#060607E6] backdrop-blur-sm",
        className,
      )}
    >
      <div className="border-separator-secondary shadow-[0_20px_50px_0_#00000099] bg-overlay flex w-[300px] flex-col items-center gap-5 rounded-2xl border px-6 py-8">
        <div className="border-accent flex size-16 items-center justify-center rounded-xl border-2 bg-surface-tertiary">
          <Smartphone className="text-accent-hover size-8 rotate-90" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-foreground font-serif text-[19px] font-bold">旋转到横屏</span>
          <p className="text-foreground-secondary font-sans text-[13px] leading-[1.7]">
            横屏模式下场景立绘更大、对话与掷骰并排显示，跑团体验更沉浸。
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            className="from-accent to-accent-hover text-accent-foreground flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r font-sans text-sm font-medium"
          >
            <RotateCw className="size-4" />
            自动旋转屏幕
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-foreground-secondary flex h-9 w-full items-center justify-center rounded-full px-4 font-sans text-sm"
          >
            仍使用竖屏
          </button>
        </div>
      </div>
    </div>
  );
}

export { RotateSuggestionOverlay };
