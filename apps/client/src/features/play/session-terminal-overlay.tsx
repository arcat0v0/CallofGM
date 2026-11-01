import { useNavigate } from "@tanstack/react-router";
import { ShieldX, UserRoundX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayStore, type ConnectionTerminal } from "@/stores/play-store";

const TERMINAL_COPY: Record<ConnectionTerminal, { title: string; description: string }> = {
  kicked: {
    title: "你已被主持人移出本团",
    description:
      "主持人已将你移出本团，并禁止你再次进入。需要主持人先在在线管理中解除禁入，你才能重新进入。",
  },
  unavailable: {
    title: "无法连接到团",
    description: "多次连接失败。请检查网络；若刚刚被主持人拉黑，则无法再进入本团。",
  },
  replaced: {
    title: "座位已在其他窗口被接管",
    description: "同一身份在本团重新认领了座位，本页已停止同步，以免发言与情报错位。请返回入口重新选择座位。",
  },
};

function SessionTerminalOverlay({ sessionId, onRetry }: { sessionId: string; onRetry: () => void }) {
  const terminal = usePlayStore((state) => state.terminal);
  const kickedReason = usePlayStore((state) => state.kickedReason);
  const navigate = useNavigate();

  if (!terminal) {
    return null;
  }
  const copy = TERMINAL_COPY[terminal];

  const icon =
    terminal === "kicked" ? <ShieldX className="size-6" /> : terminal === "replaced" ? <UserRoundX className="size-6" /> : <WifiOff className="size-6" />;

  return (
    <div className="bg-background/90 absolute inset-0 z-[10000] flex flex-col items-center justify-center gap-5 backdrop-blur-sm">
      <div
        className={
          terminal === "kicked"
            ? "bg-md-error-container text-md-on-error-container flex size-14 items-center justify-center rounded-full"
            : "bg-md-warning-container text-md-on-warning-container flex size-14 items-center justify-center rounded-full"
        }
      >
        {icon}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-foreground font-serif text-headline-small-emph">{copy.title}</h1>
        <p className="text-foreground-secondary max-w-72 text-center text-body-medium">{copy.description}</p>
        {terminal === "kicked" && kickedReason ? (
          <p className="text-danger-soft-foreground max-w-72 text-center text-body-small">
            主持人备注：{kickedReason}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2.5">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: "/join/$sessionId", params: { sessionId } })}>
          返回入口
        </Button>
        {terminal === "replaced" ? null : (
          <Button type="button" variant="primary" onClick={onRetry}>
            {terminal === "kicked" ? "重新进入" : "重试连接"}
          </Button>
        )}
      </div>
    </div>
  );
}

export { SessionTerminalOverlay };
