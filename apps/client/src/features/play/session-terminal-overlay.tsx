import { useNavigate } from "@tanstack/react-router";
import { ShieldX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayStore, type ConnectionTerminal } from "@/stores/play-store";
import { t } from "@/i18n";

const TERMINAL_COPY: Record<ConnectionTerminal, { title: string; description: string }> = {
  kicked: {
    title: "play.kickedTitle",
    description: "play.kickedDescription",
  },
  unavailable: {
    title: "play.unavailableTitle",
    description: "play.unavailableDescription",
  },
};

function SessionTerminalOverlay({ sessionId, onRetry }: { sessionId: string; onRetry: () => void }) {
  const terminal = usePlayStore((state) => state.terminal);
  const navigate = useNavigate();

  if (!terminal) {
    return null;
  }
  const copy = TERMINAL_COPY[terminal];

  return (
    <div className="bg-background/90 absolute inset-0 z-[10000] flex flex-col items-center justify-center gap-5 backdrop-blur-sm">
      <div
        className={
          terminal === "kicked"
            ? "bg-md-error-container text-md-on-error-container flex size-14 items-center justify-center rounded-full"
            : "bg-md-warning-container text-md-on-warning-container flex size-14 items-center justify-center rounded-full"
        }
      >
        {terminal === "kicked" ? <ShieldX className="size-6" /> : <WifiOff className="size-6" />}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-foreground font-serif text-headline-small-emph">{t(copy.title)}</h1>
        <p className="text-foreground-secondary max-w-72 text-center text-body-medium">{t(copy.description)}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: "/join/$sessionId", params: { sessionId } })}>
          {t("play.returnEntry")}
        </Button>
        <Button type="button" variant="primary" onClick={onRetry}>
          {terminal === "kicked" ? t("play.reenter") : t("play.retryConnect")}
        </Button>
      </div>
    </div>
  );
}

export { SessionTerminalOverlay };
