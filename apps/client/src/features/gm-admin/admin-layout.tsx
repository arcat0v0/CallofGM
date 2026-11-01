import { useNavigate } from "@tanstack/react-router";
import { AudioLines, Package, Palette, ShieldBan, Swords, VenetianMask } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { logoutGm } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { GmThemeControl } from "@/themes/runtime/gm-theme-control";
import { GmThemeScope } from "@/themes/runtime/gm-theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { t } from "@/i18n";

type AdminNavKey = "sessions" | "modules" | "characters" | "music" | "blacklist" | "themes";

const NAV_ITEMS: { key: AdminNavKey; labelKey: string; icon: ComponentType<{ className?: string }>; to: string }[] = [
  { key: "sessions", labelKey: "gm.nav.sessions", icon: Swords, to: "/gm" },
  { key: "modules", labelKey: "gm.nav.modules", icon: Package, to: "/gm/modules" },
  { key: "characters", labelKey: "gm.nav.characters", icon: VenetianMask, to: "/gm/characters" },
  { key: "music", labelKey: "gm.nav.music", icon: AudioLines, to: "/gm/music" },
  { key: "blacklist", labelKey: "gm.nav.blacklist", icon: ShieldBan, to: "/gm/blacklist" },
  { key: "themes", labelKey: "gm.nav.themes", icon: Palette, to: "/gm/themes" },
];

function AdminLayout({ active, children }: { active: AdminNavKey; children: ReactNode }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutGm();
    await navigate({ to: "/gm/login" });
  }

  const items = NAV_ITEMS.map((item) => ({
    key: item.key,
    label: t(item.labelKey),
    to: item.to,
    active: item.key === active,
    icon: item.icon,
  }));

  const nav = (
    <ThemeSlot
      name="gm-admin.nav"
      ctx={{
        items,
        onNavigate: (to) => void navigate({ to: to as never }),
        onLogout: () => void handleLogout(),
      }}
    />
  );

  const content = (
    <main className={cn("bg-md-surface-container-low min-w-0 flex-1 overflow-y-auto rounded-tl-2xl px-10 py-9")}>
      {children}
    </main>
  );

  return (
    <GmThemeScope>
      <ThemeSlot name="gm-admin.shell" ctx={{ nodes: { nav, content }, view: { active } }} />
      <GmThemeControl />
    </GmThemeScope>
  );
}

export { AdminLayout };
export type { AdminNavKey };