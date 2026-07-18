import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, KeyRound, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

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
    <main className="bg-background relative flex min-h-dvh w-full flex-col items-center justify-center gap-9 overflow-hidden px-6">
      <div className="flex flex-col items-center gap-3.5">
        <Logo className="size-13" />
        <h1 className="text-foreground font-serif text-[34px] font-bold">CoGM</h1>
        <p className="text-foreground-secondary text-[13px] tracking-[2px]">主持人的呼唤</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-105 items-center gap-2.5">
        <InputGroup className="h-11 flex-1 px-4">
          <InputGroupAddon>
            <LinkIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label="团链接或编号"
            placeholder="输入团链接或编号…"
          />
        </InputGroup>
        <Button
          type="submit"
          variant="primaryGradient"
          className="h-11 shrink-0 rounded-xl px-[22px] font-semibold"
        >
          进入
        </Button>
      </form>

      <div className="flex w-full max-w-105 items-center gap-3">
        <Separator className="bg-separator-secondary flex-1" />
        <span className="text-foreground-tertiary shrink-0 text-[11px]">进行中的团</span>
        <Separator className="bg-separator-secondary flex-1" />
      </div>

      <div className="flex w-full max-w-105 flex-col gap-2">
        {sessions.map((session) => (
          <Button
            key={session.id}
            asChild
            variant="outline"
            className="bg-surface h-13 justify-start rounded-xl border-separator-secondary px-4 hover:bg-surface-hover"
          >
            <Link to="/join/$sessionId" params={{ sessionId: session.id }}>
              <span className="text-foreground text-sm font-medium">{session.name}</span>
              <span className="flex-1" />
              <Badge tone={session.tone} variant="soft" size="sm">
                {session.status}
              </Badge>
              <ChevronRight className="text-foreground-tertiary size-4 shrink-0" />
            </Link>
          </Button>
        ))}
      </div>

      <Button asChild variant="ghost" size="sm" className="text-foreground-secondary absolute bottom-6">
        <Link to="/gm/login">
          <KeyRound className="text-foreground-tertiary" />
          主持人入口
        </Link>
      </Button>
    </main>
  );
}
