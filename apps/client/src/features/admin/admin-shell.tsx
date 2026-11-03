import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Palette, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { logoutAccount } from "@/lib/identity";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
	{ key: "users", labelKey: "admin.title", icon: Users, to: "/admin/users" },
	{
		key: "themes",
		labelKey: "gm.nav.themes",
		icon: Palette,
		to: "/admin/themes",
	},
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<div className="bg-background flex min-h-dvh">
			<aside className="border-separator-secondary flex w-60 shrink-0 flex-col gap-1 border-r p-4">
				<span className="text-foreground-tertiary px-2 pb-3 text-label-small">
					{t("role.admin")}
				</span>
				{ADMIN_NAV.map((item) => {
					const active = pathname === item.to;
					return (
						<Link
							key={item.key}
							to={item.to}
							className={cn(
								"flex items-center gap-2 rounded-lg px-3 py-2 text-label-medium transition-colors",
								active
									? "bg-md-surface-container-high text-foreground"
									: "text-foreground-secondary hover:bg-md-surface-container",
							)}
						>
							<item.icon className="size-4" />
							{t(item.labelKey)}
						</Link>
					);
				})}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mt-auto justify-start"
					onClick={() => {
						void logoutAccount().then(() => navigate({ to: "/login" }));
					}}
				>
					<LogOut className="size-4" />
					{t("admin.logout")}
				</Button>
			</aside>
			<main className="min-w-0 flex-1 overflow-y-auto px-10 py-9">
				{children}
			</main>
		</div>
	);
}
