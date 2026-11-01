import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { JoinInfoResponse, SessionStatus } from "@cogm/shared";
import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { JoinSeatView } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { ensurePlayer } from "@/lib/identity";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { cn } from "@/lib/utils";
import { ThemeScope } from "@/themes/runtime/theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

export const Route = createFileRoute("/join/$sessionId")({
  component: JoinPage,
});

const OB_SEAT_ID = "ob";

const STAGGER_DELAYS = ["delay-75", "delay-150", "delay-225"] as const;

function JoinPage() {
  useI18nVersion();
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [pcSeats, setPcSeats] = useState<Array<{ id: string; name: string; claimed: boolean }>>([]);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [moduleName, setModuleName] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        await ensurePlayer();
        const info = await api<JoinInfoResponse>(`/public/sessions/${encodeURIComponent(sessionId)}/join-info`);
        if (cancelled) {
          return;
        }
        const nextPcSeats = info.characters
          .filter((character) => character.kind === "pc")
          .map((character) => ({ id: character.id, name: character.name, claimed: character.claimed }));
        setPcSeats(nextPcSeats);
        setStatus(info.session.status);
        setModuleName(info.session.moduleName);
        setThemeId(info.session.themeId);
        const firstOpen = nextPcSeats.find((seat) => !seat.claimed);
        setSelectedId(firstOpen?.id ?? OB_SEAT_ID);
      } catch (error) {
        if (!cancelled) {
          toast.error(errorText(error, "join.loadFailed"));
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

  const cardSeats: JoinSeatView[] = pcSeats.map((seat) => ({
    id: seat.id,
    name: seat.name,
    detail: t("join.pcDetail"),
    initial: initialsOf(seat.name),
    kind: "character",
    claimed: seat.claimed,
  }));
  const obSeat: JoinSeatView = {
    id: OB_SEAT_ID,
    name: t("join.obName"),
    detail: t("join.obDetail"),
    kind: "spectator",
    claimed: false,
  };
  const seats = [...cardSeats, obSeat];
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
      toast.error(errorText(error, "join.claimFailed"));
    } finally {
      setJoining(false);
    }
  };

  const pcSeatNodes = cardSeats;
  const obSeatNode = obSeat;

  const header = (
    <ThemeSlot
      name="join.header"
      ctx={{ status, moduleName, loading }}
    />
  );

  const seatNodes = loading ? (
    <p className="text-foreground-tertiary text-body-medium">{t("join.loadingSeats")}</p>
  ) : (
    pcSeatNodes.map((seat, index) => (
      <ThemeSlot
        key={seat.id}
        name="join.seat-card"
        ctx={{
          seat,
          selected: selectedId === seat.id,
          disabled: seat.claimed,
          onSelect: () => setSelectedId(seat.id),
          variant: "card",
          className: cn(
            "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards",
            STAGGER_DELAYS[index % STAGGER_DELAYS.length],
          ),
        }}
      />
    ))
  );

  const spectator = !loading && obSeatNode ? (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex w-full justify-center">
      <ThemeSlot
        name="join.seat-card"
        ctx={{
          seat: obSeatNode,
          selected: selectedId === obSeatNode.id,
          disabled: false,
          onSelect: () => setSelectedId(obSeatNode.id),
          variant: "row",
        }}
      />
    </div>
  ) : null;

  const action = (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial fill-mode-backwards delay-225 flex flex-col items-center gap-3">
      <Button
        type="button"
        disabled={!selectedSeat || joining}
        onClick={() => void handleJoin()}
        variant="primary"
        size="lg"
      >
        <LogIn className="size-4" />
        {selectedSeat ? t("join.enterAs", { name: selectedSeat.name }) : t("join.selectSeat")}
      </Button>
      <p className="text-label-small text-foreground-tertiary">{t("join.bgmHint")}</p>
    </div>
  );

  return (
    <ThemeScope themeId={themeId}>
      <ThemeSlot
        name="join.layout"
        ctx={{
          nodes: { header, seats: seatNodes, spectator, action },
          view: {
            sessionId,
            status,
            moduleName,
            loading,
            joining,
            selectedName: selectedSeat?.name ?? null,
          },
          actions: { join: () => void handleJoin() },
        }}
      />
    </ThemeScope>
  );
}