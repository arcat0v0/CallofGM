import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      return;
    }
    const fromLink = trimmed.match(/\/join\/([^/?#]+)/)?.[1];
    const sessionId = decodeURIComponent(fromLink ?? trimmed);
    void navigate({ to: "/join/$sessionId", params: { sessionId } });
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

      <Button asChild variant="ghost" size="sm" className="text-foreground-secondary absolute bottom-6">
        <Link to="/gm/login">
          <KeyRound className="text-foreground-tertiary" />
          主持人入口
        </Link>
      </Button>
    </main>
  );
}
