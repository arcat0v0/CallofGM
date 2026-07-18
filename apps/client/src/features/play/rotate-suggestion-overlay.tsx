import { RotateCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function RotateSuggestionOverlay({ onDismiss, className }: { onDismiss: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "bg-modal-backdrop/90 absolute inset-0 z-40 flex items-center justify-center backdrop-blur-sm",
        className,
      )}
    >
      <Card className="border-separator-secondary shadow-overlay bg-overlay w-[300px] items-center gap-5 rounded-2xl border px-6 py-8">
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
          <Button
            type="button"
            variant="primaryGradient"
            className="h-11 w-full bg-linear-to-r"
          >
            <RotateCw className="size-4" />
            自动旋转屏幕
          </Button>
          <Button
            type="button"
            onClick={onDismiss}
            variant="ghost"
            className="h-9 w-full text-foreground-secondary"
          >
            仍使用竖屏
          </Button>
        </div>
      </Card>
    </div>
  );
}

export { RotateSuggestionOverlay };
