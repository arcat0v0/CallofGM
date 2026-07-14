import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/gm/login")({
  component: GmLoginPage,
});

function GmLoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center gap-8">
      <Link
        to="/"
        className="text-foreground-secondary hover:text-foreground absolute top-6 left-6 flex items-center gap-1.5 rounded-lg p-2 transition-colors"
      >
        <ArrowLeft className="text-foreground-tertiary size-3.5" />
        <span className="font-sans text-xs">返回入口</span>
      </Link>

      <div className="flex flex-col items-center gap-3.5">
        <Logo className="size-13" />
        <h1 className="text-foreground font-serif text-2xl font-bold">主持人登录</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex w-90 flex-col gap-3">
        <div className="border-separator-secondary bg-field focus-within:border-field-border-focus flex h-11 items-center gap-2.5 rounded-xl border px-4 py-2 transition-colors">
          <Lock className="text-foreground-tertiary size-[15px] shrink-0" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="主持人密码"
            className="text-field-foreground placeholder:text-field-placeholder min-w-0 flex-1 bg-transparent font-sans text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="text-foreground-tertiary hover:text-foreground shrink-0 transition-colors"
          >
            {showPassword ? <Eye className="size-[15px]" /> : <EyeOff className="size-[15px]" />}
          </button>
        </div>

        <Button
          type="submit"
          className="from-accent to-accent-hover h-11 w-full rounded-xl bg-linear-to-b text-sm font-semibold"
        >
          登录
        </Button>
      </form>

      <p className="text-foreground-tertiary font-sans text-[11px]">
        仅主持人需要登录 · 玩家通过团链接直接进入
      </p>
    </div>
  );
}
