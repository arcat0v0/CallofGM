import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, LogIn } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  claimedBy?: string;
};

const SEATS: Seat[] = [
  { id: "mio", name: "远野 澪", detail: "侦探 · HP 11 · SAN 58", initial: "澪", kind: "character" },
  {
    id: "taku",
    name: "白石 拓真",
    detail: "记者 · HP 12 · SAN 60",
    initial: "拓",
    kind: "character",
    claimedBy: "Kuro",
  },
  { id: "tsubaki", name: "南 椿", detail: "医生 · HP 10 · SAN 65", initial: "椿", kind: "character" },
  { id: "ob", name: "观战 OB", detail: "不参与判定，仅旁观", kind: "spectator" },
];

const gradientBorder =
  "border-[1.5px] border-transparent [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,linear-gradient(135deg,var(--color-brand-moegi),var(--color-brand-nae))_border-box]";

function SeatStatus({ seat, selected }: { seat: Seat; selected: boolean }) {
  if (seat.claimedBy) {
    return (
      <Badge variant="soft" tone="default" size="sm">
        已认领 · {seat.claimedBy}
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
  const claimed = Boolean(seat.claimedBy);
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
  const [selectedId, setSelectedId] = useState("mio");
  const selectedSeat = SEATS.find((seat) => seat.id === selectedId && !seat.claimedBy);

  const handleJoin = () => {
    if (selectedSeat) {
      navigate({
        to: "/play/$sessionId",
        params: { sessionId },
      });
    }
  };
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-10 overflow-hidden bg-background px-4">
      <div className="flex flex-col items-center gap-2.5">
        <Badge variant="soft" tone="default" size="sm">
          模组 · 沉没的记忆
        </Badge>
        <h1 className="font-serif text-[26px] font-bold text-foreground">沉没的记忆 · 第三夜</h1>
        <p className="text-[13px] text-foreground-secondary">
          选择你的位置 · 已认领的角色不可重复选择
        </p>
      </div>

      <div className="flex gap-4" role="radiogroup" aria-label="选择玩家位置">
        {SEATS.map((seat) => (
          <SeatCard
            key={seat.id}
            seat={seat}
            selected={selectedId === seat.id}
            onSelect={() => setSelectedId(seat.id)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          disabled={!selectedSeat}
          onClick={handleJoin}
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
