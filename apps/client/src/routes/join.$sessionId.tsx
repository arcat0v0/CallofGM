import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionStatusLabel, type JoinInfoResponse, type SessionStatus } from "@cogm/shared";
import { Eye, Link2Off, LogIn, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { initialsOf } from "@/lib/format";
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

const OB_SEAT: Seat = {
  id: "ob",
  name: "观战 OB",
  detail: "不参与判定，仅旁观",
  kind: "spectator",
  claimed: false,
};

const STAGGER_DELAYS = ["delay-75", "delay-150", "delay-225"] as const;

const joinInfoRequests = new Map<string, Promise<JoinInfoResponse>>();

function fetchJoinInfo(sessionId: string): Promise<JoinInfoResponse> {
  const pending = joinInfoRequests.get(sessionId);
  if (pending) {
    return pending;
  }
  const request = api<JoinInfoResponse>(`/public/sessions/${encodeURIComponent(sessionId)}/join-info`);
  joinInfoRequests.set(sessionId, request);
  const clear = () => {
    if (joinInfoRequests.get(sessionId) === request) {
      joinInfoRequests.delete(sessionId);
    }
  };
  void request.then(clear, clear);
  return request;
}

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
      <Badge variant="solid" tone="accent" size="sm">
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
  className,
}: {
  seat: Seat;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const claimed = seat.claimed;
  const active = selected && !claimed;
  return (
    <button
      type="button"
      disabled={claimed}
      onClick={onSelect}
      role="radio"
      aria-checked={active}
      className={cn(
        "flex w-52 flex-col items-center gap-3 rounded-2xl px-5 pt-5 pb-6 text-center transition-all duration-350 ease-expressive-fast-spatial focus-visible:outline-none",
        claimed
          ? "cursor-not-allowed bg-md-surface-container-lowest opacity-50"
          : active
            ? "bg-md-primary-container text-md-on-primary-container shadow-card ring-md-primary cursor-pointer ring-2"
            : "bg-md-surface-container-low hover:bg-md-surface-container focus-visible:ring-md-primary cursor-pointer focus-visible:ring-2",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-t-full rounded-b-xl transition-colors duration-350 ease-expressive-fast-effects",
          active
            ? "bg-md-primary text-md-on-primary"
            : "bg-md-surface-container-high text-md-on-surface-variant",
        )}
      >
        {seat.initial ? (
          <span className="font-serif text-title-large-emph">{seat.initial}</span>
        ) : (
          <Eye className="size-5" />
        )}
      </span>
      <span
        className={cn(
          "text-title-medium-emph",
          active ? "text-md-on-primary-container" : "text-md-on-surface",
        )}
      >
        {seat.name}
      </span>
      <span
        className={cn(
          "text-body-small",
          active ? "text-md-on-primary-container" : "text-md-on-surface-variant",
        )}
      >
        {seat.detail}
      </span>
      <SeatStatus seat={seat} selected={active} />
    </button>
  );
}

function SpectatorRow({
  seat,
  selected,
  onSelect,
  className,
}: {
  seat: Seat;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex w-full max-w-xl items-center gap-3 rounded-2xl px-5 py-3.5 text-left transition-all duration-350 ease-expressive-fast-spatial focus-visible:outline-none",
        selected
          ? "bg-md-surface-container-high ring-md-primary ring-2"
          : "bg-md-surface-container-low hover:bg-md-surface-container focus-visible:ring-md-primary focus-visible:ring-2",
        className,
      )}
    >
      <span className="bg-md-surface-container-highest text-md-on-surface-variant flex size-9 shrink-0 items-center justify-center rounded-full">
        <Eye className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-title-small-emph text-md-on-surface">{seat.name}</span>
        <span className="text-body-small text-md-on-surface-variant">{seat.detail}</span>
      </span>
      <SeatStatus seat={seat} selected={selected} />
    </button>
  );
}

function JoinPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [moduleName, setModuleName] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        await ensurePlayer();
        const info = await fetchJoinInfo(sessionId);
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
        setModuleName(info.session.moduleName);
        setSessionName(info.session.name);
        if (info.session.status === "ended") {
          setSelectedId(OB_SEAT.id);
        } else {
          const firstOpen = nextSeats.find((seat) => !seat.claimed);
          setSelectedId(firstOpen?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(isApiError(error) ? error.message : "无法加载这个团的信息");
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
  }, [sessionId, reloadToken]);

  const selectedSeat = seats.find((seat) => seat.id === selectedId && !seat.claimed);

  const isEnded = status === "ended";
  const handleJoin = async () => {
    if (joining) {
      return;
    }
    setJoining(true);
    try {
      await ensurePlayer();
      const claimPayload = isEnded || selectedSeat?.kind === "spectator"
        ? { role: "ob" as const }
        : { role: "pc" as const, characterId: selectedSeat?.id };
      await api(`/sessions/${encodeURIComponent(sessionId)}/claim`, {
        method: "POST",
        body: JSON.stringify(claimPayload),
      });
      await navigate({ to: "/play/$sessionId", params: { sessionId } });
    } catch (error) {
      setLoadError(isApiError(error) ? error.message : "进入失败，请稍后重试");
    } finally {
      setJoining(false);
    }
  };

  const pcSeats = seats.filter((seat) => seat.kind === "character");
  const obSeat = seats.find((seat) => seat.kind === "spectator");

  const showSeatPicker = !loading && !loadError && !isEnded;

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-10 overflow-hidden bg-background px-4">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial flex flex-col items-center gap-2.5">
        <Badge variant="soft" tone="default" size="sm">
          {status ? SessionStatusLabel[status] : loadError ? "链接无效" : "加载中"}
        </Badge>
        <h1 className="text-foreground text-center font-serif text-headline-medium-emph">
          {sessionName ?? moduleName ?? (loadError ? "无法进入这个团" : "选择你的位置")}
        </h1>
        <p className="text-body-large text-md-on-surface-variant text-center">
          {loadError
            ? "请确认团链接是否正确，或向主持人索取新的邀请链接"
            : isEnded
              ? "本团已结团 · 可作为观战进入回看聊天记录与情报"
              : "选择你的位置 · 已认领的角色不可重复选择"}
        </p>
      </div>

      {loadError ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 duration-500">
          <div className="bg-md-error-container text-md-on-error-container flex size-16 items-center justify-center rounded-t-full rounded-b-xl">
            <Link2Off className="size-7" />
          </div>
          <p className="text-danger text-body-medium text-center">{loadError}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="primary" size="lg" onClick={() => setReloadToken((token) => token + 1)}>
              <RotateCw className="size-4" />
              重试
            </Button>
            <Button asChild variant="tertiary" size="lg">
              <Link to="/">返回入口</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {isEnded ? (
            <div className="bg-md-surface-container-low animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex max-w-md flex-col items-center gap-2 rounded-2xl px-6 py-5 text-center duration-500">
              <span className="text-body-medium text-foreground-secondary">座位选择已关闭</span>
              <span className="text-body-small text-foreground-tertiary">
                本团已经结束，所有座位不再开放；进入后以观战身份只读回看。
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-4" role="radiogroup" aria-label="选择玩家位置">
                {loading ? (
                  <p className="text-foreground-tertiary text-body-medium">正在加载座位…</p>
                ) : (
                  pcSeats.map((seat, index) => (
                    <SeatCard
                      key={seat.id}
                      seat={seat}
                      selected={selectedId === seat.id}
                      onSelect={() => setSelectedId(seat.id)}
                      className={cn(
                        "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards",
                        STAGGER_DELAYS[index % STAGGER_DELAYS.length],
                      )}
                    />
                  ))
                )}
              </div>

              {showSeatPicker && obSeat ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex w-full justify-center">
                  <SpectatorRow
                    seat={obSeat}
                    selected={selectedId === obSeat.id}
                    onSelect={() => setSelectedId(obSeat.id)}
                  />
                </div>
              ) : null}
            </>
          )}

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex flex-col items-center gap-3">
            <Button
              type="button"
              disabled={joining || (!isEnded && !selectedSeat)}
              onClick={() => void handleJoin()}
              variant="primary"
              size="lg"
            >
              <LogIn className="size-4" />
              {isEnded ? "进入回看记录" : selectedSeat ? `以「${selectedSeat.name}」进入` : "请选择一个位置"}
            </Button>
            <p className="text-label-small text-foreground-tertiary">
              {isEnded ? "结团回看模式：聊天记录与公开情报完整可查" : "进入后将自动同步 GM 控制的 BGM 播放"}
            </p>
          </div>
        </>
      )}
    </main>
  );
}
