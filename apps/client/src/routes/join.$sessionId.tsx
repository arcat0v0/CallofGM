import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionStatusLabel, type SessionStatus } from "@cogm/shared";
import { Eye, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { initialsOf } from "@/lib/chat-map";
import { ensurePlayer } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/join/$sessionId")({
  component: JoinPage,
});

type Seat = {
  id: string;
  name: string;
  detail: string;
  initial?: string;
  kind: "character" | "spectator";
  claimed: boolean;
};

type JoinInfo = {
  session: {
    id: string;
    status: SessionStatus;
    phase: string;
    moduleId: string;
  };
  characters: Array<{
    id: string;
    name: string;
    kind: string;
    claimed: boolean;
  }>;
};

const OB_SEAT: Seat = {
  id: "ob",
  name: "观战 OB",
  detail: "不参与判定，仅旁观",
  kind: "spectator",
  claimed: false,
};

const gradientBorder =
  "border-[1.5px] border-transparent [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,linear-gradient(135deg,var(--color-brand-moegi),var(--color-brand-nae))_border-box]";

function SeatStatus({ seat, selected }: { seat: Seat; selected: boolean }) {
  if (seat.claimed) {
    return (
      <Badge variant="soft" tone="default" size="sm">
        已认领
      </Badge>
    );
  }
  if (selected) {
    return (
      <Badge variant="soft" tone="accent" size="sm">
        已选择
      </Badge>
    );
  }
  if (seat.kind === "spectator") {
    return (
      <Badge variant="soft" tone="default" size="sm">
        人数不限
      </Badge>
    );
  }
  return (
    <Badge variant="soft" tone="success" size="sm">
      可认领
    </Badge>
  );
}

function SeatCard({
  seat,
  selected,
  onSelect,
}: {
  seat: Seat;
  selected: boolean;
  onSelect: () => void;
}) {
  const claimed = seat.claimed;
  return (
    <Button
      type="button"
      disabled={claimed}
      onClick={onSelect}
      variant="outline"
      role="radio"
      aria-checked={selected}
      className={cn(
        "bg-surface h-auto w-54 flex-col gap-2.5 rounded-2xl px-4 py-6 text-center whitespace-normal",
        claimed
          ? "cursor-not-allowed border border-separator-secondary opacity-60"
          : "cursor-pointer hover:bg-surface",
        !claimed && selected && gradientBorder,
        !claimed &&
          !selected &&
          "border border-separator-secondary hover:border-separator-tertiary",
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          selected && !claimed
            ? "bg-linear-to-br from-brand-moegi to-brand-nae"
            : "bg-default",
        )}
      >
        {seat.initial ? (
          <span
            className={cn(
              "font-serif text-xl font-bold",
              selected && !claimed ? "text-accent-foreground" : "text-foreground",
            )}
          >
            {seat.initial}
          </span>
        ) : (
          <Eye
            className={cn(
              "size-[22px]",
              selected && !claimed ? "text-accent-foreground" : "text-foreground-secondary",
            )}
          />
        )}
      </span>
      <span className="text-[15px] font-semibold text-foreground">{seat.name}</span>
      <span className="text-xs text-foreground-tertiary">{seat.detail}</span>
      <SeatStatus seat={seat} selected={selected && !claimed} />
    </Button>
  );
}

function JoinPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        await ensurePlayer();
        const info = await api<JoinInfo>(`/public/sessions/${encodeURIComponent(sessionId)}/join-info`);
        if (cancelled) {
          return;
        }
        const pcSeats: Seat[] = info.characters
          .filter((character) => character.kind === "pc")
          .map((character) => ({
            id: character.id,
            name: character.name,
            detail: "PC",
            initial: initialsOf(character.name),
            kind: "character" as const,
            claimed: character.claimed,
          }));
        const nextSeats = [...pcSeats, OB_SEAT];
        setSeats(nextSeats);
        setStatus(info.session.status);
        const firstOpen = nextSeats.find((seat) => !seat.claimed);
        setSelectedId(firstOpen?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          toast.error(isApiError(error) ? error.message : "无法加载座位信息");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const selectedSeat = seats.find((seat) => seat.id === selectedId && !seat.claimed);

  const handleJoin = async () => {
    if (!selectedSeat || joining) {
      return;
    }
    setJoining(true);
    try {
      await ensurePlayer();
      await api(`/sessions/${encodeURIComponent(sessionId)}/claim`, {
        method: "POST",
        body: JSON.stringify(
          selectedSeat.kind === "spectator"
            ? { role: "ob" }
            : { role: "pc", characterId: selectedSeat.id },
        ),
      });
      await navigate({ to: "/play/$sessionId", params: { sessionId } });
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "认领失败");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-10 overflow-hidden bg-background px-4">
      <div className="flex flex-col items-center gap-2.5">
        <Badge variant="soft" tone="default" size="sm">
          {status ? SessionStatusLabel[status] : "加载中"}
        </Badge>
        <h1 className="font-serif text-[26px] font-bold text-foreground">选择你的位置</h1>
        <p className="text-[13px] text-foreground-secondary">
          选择你的位置 · 已认领的角色不可重复选择
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4" role="radiogroup" aria-label="选择玩家位置">
        {loading ? (
          <p className="text-foreground-tertiary text-sm">正在加载座位…</p>
        ) : (
          seats.map((seat) => (
            <SeatCard
              key={seat.id}
              seat={seat}
              selected={selectedId === seat.id}
              onSelect={() => setSelectedId(seat.id)}
            />
          ))
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          disabled={!selectedSeat || joining}
          onClick={() => void handleJoin()}
          variant="primaryGradient"
          size="lg"
          className="h-[46px] rounded-xl px-8 text-sm font-semibold"
        >
          <LogIn className="size-4" />
          {selectedSeat ? `以「${selectedSeat.name}」进入` : "请选择一个位置"}
        </Button>
        <p className="text-[11px] text-foreground-tertiary">进入后将自动同步 GM 控制的 BGM 播放</p>
      </div>
    </main>
  );
}
