import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { GmAdminNavCtx } from "@cogm/theme-sdk";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export function GmAdminNav({ items, onLogout }: GmAdminNavCtx) {
  return (
    <nav className="flex w-24 shrink-0 flex-col items-center py-5">
      <Link to="/gm" aria-label={t("app.gmBackstage")} className="mb-5">
        <Logo className="size-10" />
      </Link>

      <div className="flex flex-col items-center gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.to as never}
              aria-current={item.active ? "page" : undefined}
              className="group flex w-16 flex-col items-center gap-1 py-0.5"
            >
              <span
                className={cn(
                  "flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200 ease-standard-default-effects",
                  item.active
                    ? "bg-md-secondary-container text-md-on-secondary-container"
                    : "text-md-on-surface-variant group-hover:bg-md-on-surface/8 group-active:bg-md-on-surface/12",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span
                className={cn(
                  item.active
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
          <AvatarFallback className="text-md-on-primary-container text-label-large-emph">{t("common.gmShort")}</AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("gm.nav.logout")}
          className="text-md-on-surface-variant"
          onClick={onLogout}
        >
          <LogOut />
        </Button>
      </div>
    </nav>
  );
}