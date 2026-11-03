import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	AudioLines,
	Package,
	Palette,
	ShieldBan,
	Swords,
	VenetianMask,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { t } from "@/i18n";
import { logoutAccount } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { GmThemeScope } from "@/themes/runtime/gm-theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

type AdminNavKey =
	| "sessions"
	| "modules"
	| "characters"
	| "music"
	| "blacklist"
	| "themes";

const NAV_ITEMS: {
	key: AdminNavKey;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	to: string;
}[] = [
	{ key: "sessions", labelKey: "gm.nav.sessions", icon: Swords, to: "/gm" },
	{
		key: "modules",
		labelKey: "gm.nav.modules",
		icon: Package,
		to: "/gm/modules",
	},
	{
		key: "characters",
		labelKey: "gm.nav.characters",
		icon: VenetianMask,
		to: "/gm/characters",
	},
	{ key: "music", labelKey: "gm.nav.music", icon: AudioLines, to: "/gm/music" },
	{
		key: "blacklist",
		labelKey: "gm.nav.blacklist",
		icon: ShieldBan,
		to: "/gm/blacklist",
	},
	{ key: "themes", labelKey: "gm.nav.themes", icon: Palette, to: "/gm/themes" },
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
	if (path === "/gm/themes") {
		return "themes";
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
		await logoutAccount();
		await navigate({ to: "/login" });
	}

	const items = NAV_ITEMS.map((item) => ({
		key: item.key,
		label: t(item.labelKey),
		to: item.to,
		active: item.key === current,
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
		<main
			className={cn(
				"bg-md-surface-container-low min-w-0 flex-1 overflow-y-auto rounded-tl-2xl px-10 py-9",
			)}
		>
			{children}
		</main>
	);

	return (
		<GmThemeScope>
			<ThemeSlot
				name="gm-admin.shell"
				ctx={{ nodes: { nav, content }, view: { active: current } }}
			/>
		</GmThemeScope>
	);
}

export type { AdminNavKey };
export { AdminLayout };
