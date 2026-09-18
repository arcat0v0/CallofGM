import { Link, useNavigate } from "@tanstack/react-router";
import { AudioLines, LogOut, Package, ShieldBan, Swords, VenetianMask } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutGm } from "@/lib/identity";
import { cn } from "@/lib/utils";

type AdminNavKey = "sessions" | "modules" | "characters" | "music" | "blacklist";

const NAV_ITEMS: { key: AdminNavKey; label: string; icon: typeof Swords; to: string }[] = [
  { key: "sessions", label: "团管理", icon: Swords, to: "/gm" },
  { key: "modules", label: "模组管理", icon: Package, to: "/gm/modules" },
  { key: "characters", label: "人物管理", icon: VenetianMask, to: "/gm/characters" },
  { key: "music", label: "音乐资源", icon: AudioLines, to: "/gm/music" },
  { key: "blacklist", label: "黑名单", icon: ShieldBan, to: "/gm/blacklist" },
];

function AdminLayout({ active, children }: { active: AdminNavKey; children: ReactNode }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutGm();
    await navigate({ to: "/gm/login" });
  }

  return (
    <div className="bg-background flex h-screen">
      <aside className="border-separator bg-background-secondary flex w-[248px] shrink-0 flex-col gap-1.5 border-r p-5">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <Logo className="size-[34px]" />
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground font-serif text-title-medium-emph">CoGM</span>
            <span className="text-foreground-tertiary text-label-small">主持人的呼唤 · 后台</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "relative flex h-[38px] items-center gap-2.5 rounded-md px-2.5 font-sans",
                  isActive ? "bg-default text-foreground text-label-large-emph" : "text-foreground-secondary text-label-large",
                )}
              >
                {isActive && <span className="bg-accent-hover absolute left-0 h-5 w-[3px] rounded-full" />}
                <Icon className={cn("size-4", isActive && "text-accent-hover")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="border-separator flex items-center gap-2.5 border-t px-2 pt-3 pb-1">
          <Avatar size="md" className="bg-accent shrink-0">
            <AvatarFallback className="text-accent-foreground">KP</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <span className="text-foreground font-sans text-label-large-emph">主持人</span>
            <span className="text-foreground-tertiary font-sans text-label-small">已登录</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="退出登录"
            className="text-foreground-secondary"
            onClick={() => void handleLogout()}
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-7 px-8">{children}</main>
    </div>
  );
}

export { AdminLayout };
export type { AdminNavKey };
