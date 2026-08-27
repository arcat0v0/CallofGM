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
    <main className="bg-background relative flex min-h-dvh flex-col items-center justify-center gap-8">
      <Button asChild variant="ghost" size="sm" className="text-foreground-secondary absolute top-6 left-6">
        <Link to="/">
          <ArrowLeft className="text-foreground-tertiary" />
          返回入口
        </Link>
      </Button>

      <div className="flex flex-col items-center gap-3.5">
        <Logo className="size-13" />
        <h1 className="text-foreground font-serif text-2xl font-bold">主持人登录</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex w-90 flex-col gap-3">
        <InputGroup className="h-11 border-separator-secondary px-4">
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
          variant="primaryGradient"
          disabled={pending || !password}
          className="h-11 w-full rounded-xl text-sm font-semibold"
        >
          {pending ? "登录中…" : "登录"}
        </Button>
      </form>

      <p className="text-foreground-tertiary font-sans text-[11px]">
        仅主持人需要登录 · 玩家通过团链接直接进入
      </p>
    </main>
  );
}
