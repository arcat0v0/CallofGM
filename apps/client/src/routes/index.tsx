import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, KeyRound, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const sessions = [
  { id: "sunk-memory-3", name: "沉没的记忆 · 第三夜", status: "进行中", tone: "success" },
  { id: "abandoned-mine", name: "无人矿坑 · 单团", status: "等待开始", tone: "default" },
] as const;

function HomePage() {
  const [code, setCode] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed) {
      window.location.href = `/join/${encodeURIComponent(trimmed)}`;
    }
  }

  return (
    <div className="bg-background relative flex min-h-screen w-full flex-col items-center justify-center gap-9 overflow-hidden px-6">
      <div className="flex flex-col items-center gap-3.5">
        <Logo className="size-13" />
        <h1 className="text-foreground font-serif text-[34px] font-bold">CoGM</h1>
        <p className="text-foreground-secondary text-[13px] tracking-[2px]">主持人的呼唤</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-105 items-center gap-2.5">
        <div className="border-separator-secondary bg-field flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-4">
          <LinkIcon className="text-foreground-tertiary size-[15px] shrink-0" />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label="团链接或编号"
            placeholder="输入团链接或编号…"
            className="text-foreground placeholder:text-field-placeholder min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Button
          type="submit"
          className="from-accent to-accent-hover h-11 shrink-0 rounded-xl bg-linear-to-b px-[22px] font-semibold"
        >
          进入
        </Button>
      </form>

      <div className="flex w-full max-w-105 items-center gap-3">
        <div className="bg-separator-secondary h-px flex-1" />
        <span className="text-foreground-tertiary shrink-0 text-[11px]">进行中的团</span>
        <div className="bg-separator-secondary h-px flex-1" />
      </div>

      <div className="flex w-full max-w-105 flex-col gap-2">
        {sessions.map((session) => (
          <a
            key={session.id}
            href={`/join/${session.id}`}
            className="border-separator-secondary bg-surface hover:bg-surface-hover flex h-13 items-center gap-2.5 rounded-xl border px-4 transition-colors"
          >
            <span className="text-foreground text-sm font-medium">{session.name}</span>
            <span className="flex-1" />
            <Badge tone={session.tone} variant="soft" size="sm">
              {session.status}
            </Badge>
            <ChevronRight className="text-foreground-tertiary size-4 shrink-0" />
          </a>
        ))}
      </div>

      <a
        href="/gm/login"
        className="text-foreground-secondary hover:text-foreground absolute inset-x-0 bottom-6 flex h-8 items-center justify-center gap-1.5 transition-colors"
      >
        <KeyRound className="text-foreground-tertiary size-[13px]" />
        <span className="text-xs">主持人入口</span>
      </a>
    </div>
  );
}
