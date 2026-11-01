import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AudioLines,
  LogOut,
  Package,
  ShieldBan,
  Swords,
  VenetianMask,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutGm } from "@/lib/identity";
import { cn } from "@/lib/utils";

type AdminNavKey =
  | "sessions"
  | "modules"
  | "characters"
  | "music"
  | "blacklist";

const NAV_ITEMS: {
  key: AdminNavKey;
  label: string;
  icon: typeof Swords;
  to: string;
}[] = [
  { key: "sessions", label: "团", icon: Swords, to: "/gm" },
  { key: "modules", label: "模组", icon: Package, to: "/gm/modules" },
  {
    key: "characters",
    label: "人物",
    icon: VenetianMask,
    to: "/gm/characters",
  },
  { key: "music", label: "音乐", icon: AudioLines, to: "/gm/music" },
  { key: "blacklist", label: "黑名单", icon: ShieldBan, to: "/gm/blacklist" },
];

export function adminNavCurrentKey(pathname: string): AdminNavKey | null {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (path === "/gm") {
    return "sessions";
  }
  if (path === "/gm/modules" || path.startsWith("/gm/module/")) {
    return "modules";
  }
  if (path === "/gm/characters") {
    return "characters";
  }
  if (path === "/gm/music") {
    return "music";
  }
  if (path === "/gm/blacklist") {
    return "blacklist";
  }
  return null;
}

function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const current = adminNavCurrentKey(pathname);

  async function handleLogout() {
    await logoutGm();
    await navigate({ to: "/gm/login" });
  }

  return (
    <div className="bg-background flex h-screen">
      <nav className="flex w-24 shrink-0 flex-col items-center py-5">
        <a
          href="/gm"
          aria-label="CoGM 后台"
          className="mb-5"
          onClick={(event) => {
            event.preventDefault();
            void navigate({ to: "/gm" });
          }}
        >
          <Logo className="size-10" />
        </a>

        <div className="flex flex-col items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === current;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                activeOptions={{ exact: true }}
                aria-current={isActive ? "page" : undefined}
                className="group flex w-16 flex-col items-center gap-1 py-0.5"
              >
                <span
                  className={cn(
                    "flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200 ease-standard-default-effects",
                    isActive
                      ? "bg-md-secondary-container text-md-on-secondary-container"
                      : "text-md-on-surface-variant group-hover:bg-md-on-surface/8 group-active:bg-md-on-surface/12",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className={cn(
                    isActive
                      ? "text-label-medium-emph text-md-on-surface"
                      : "text-label-medium text-md-on-surface-variant",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-3">
          <Avatar size="md" className="bg-md-primary-container">
            <AvatarFallback className="text-md-on-primary-container text-label-large-emph">
              KP
            </AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="退出登录"
            className="text-md-on-surface-variant"
            onClick={() => void handleLogout()}
          >
            <LogOut />
          </Button>
        </div>
      </nav>

      <main className="bg-md-surface-container-low min-w-0 flex-1 overflow-y-auto rounded-tl-2xl px-10 py-9">
        {children}
      </main>
    </div>
  );
}

export type { AdminNavKey };
export { AdminLayout };
