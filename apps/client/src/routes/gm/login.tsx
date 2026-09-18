import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { isApiError } from "@/lib/api";
import { loginGm } from "@/lib/identity";

export const Route = createFileRoute("/gm/login")({
  component: GmLoginPage,
});

function GmLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || pending) {
      return;
    }
    setPending(true);
    try {
      await loginGm(password);
      await navigate({ to: "/gm" });
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="bg-background relative flex min-h-dvh flex-col items-center justify-center gap-12 overflow-hidden px-6">
      <div
        aria-hidden
        className="bg-md-primary/12 pointer-events-none absolute -top-32 -left-32 size-105 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-md-tertiary/12 pointer-events-none absolute -right-40 -bottom-40 size-120 rounded-full blur-3xl"
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 duration-500">
        <Logo className="size-16" />
        <h1 className="text-foreground font-serif text-display-small-emph">主持人登录</h1>
        <p className="text-md-on-surface-variant text-title-medium">回到你的舞台</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex w-full max-w-105 flex-col gap-2.5 delay-150 duration-500"
      >
        <InputGroup className="h-14 px-4">
          <InputGroupAddon>
            <Lock />
          </InputGroupAddon>
          <InputGroupInput
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="主持人密码"
            aria-label="主持人密码"
            autoComplete="current-password"
          />
          <InputGroupButton
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <Eye /> : <EyeOff />}
          </InputGroupButton>
        </InputGroup>

        <Button
          type="submit"
          variant="primary"
          disabled={pending || !password}
          className="h-14 w-full"
        >
          {pending ? "登录中…" : "登录"}
        </Button>
      </form>

      <div className="animate-in fade-in ease-standard-default-effects absolute bottom-6 flex flex-col items-center gap-2 delay-300 duration-300">
        <Button asChild variant="ghost" size="sm" className="text-foreground-secondary">
          <Link to="/">
            <ArrowLeft className="text-foreground-tertiary" />
            返回入口
          </Link>
        </Button>
        <p className="text-foreground-tertiary font-sans text-label-small">
          仅主持人需要登录 · 玩家通过团链接直接进入
        </p>
      </div>
    </main>
  );
}
