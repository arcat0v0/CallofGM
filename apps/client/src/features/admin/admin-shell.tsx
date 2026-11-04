import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Palette, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { initialsOf } from "@/lib/format";
import { logoutAccount } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/stores/identity-store";

const ADMIN_NAV: {
	key: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	to: string;
}[] = [
	{ key: "users", labelKey: "admin.title", icon: Users, to: "/admin/users" },
	{
		key: "themes",
		labelKey: "gm.nav.themes",
		icon: Palette,
		to: "/admin/themes",
	},
];

export function AdminShell({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const username = useIdentityStore((state) => state.account?.username ?? null);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	async function handleLogout() {
		await logoutAccount();
		await navigate({ to: "/login" });
	}

	const navItems = ADMIN_NAV.map((item) => ({
		...item,
		active: pathname === item.to,
	}));

	return (
		<div className="bg-background flex min-h-dvh flex-col md:h-screen md:flex-row">
			<aside className="hidden w-24 shrink-0 flex-col items-center py-5 md:flex">
				<Link to="/admin/users" aria-label={t("admin.scope")} className="mb-5">
					<Logo className="size-10" />
				</Link>
				<div className="flex flex-col items-center gap-3">
					{navItems.map((item) => (
						<Link
							key={item.key}
							to={item.to}
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
								<item.icon className="size-5" />
							</span>
							<span
								className={cn(
									item.active
										? "text-label-medium-emph text-md-on-surface"
										: "text-label-medium text-md-on-surface-variant",
								)}
							>
								{t(item.labelKey)}
							</span>
						</Link>
					))}
				</div>
				<div className="flex-1" />
				<div className="flex flex-col items-center gap-3">
					<Avatar size="md" className="bg-md-primary-container">
						<AvatarFallback className="text-md-on-primary-container text-label-large-emph">
							{username ? initialsOf(username) : t("role.admin").slice(0, 1)}
						</AvatarFallback>
					</Avatar>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("admin.logout")}
						className="text-md-on-surface-variant"
						onClick={() => void handleLogout()}
					>
						<LogOut />
					</Button>
				</div>
			</aside>

			<header className="border-separator-secondary flex items-center gap-3 border-b px-4 py-3 md:hidden">
				<Link to="/admin/users" aria-label={t("admin.scope")}>
					<Logo className="size-8" />
				</Link>
				<div className="flex min-w-0 flex-col">
					<span className="text-foreground font-serif text-title-medium-emph">
						{t("app.name")}
					</span>
					<span className="text-foreground-tertiary text-label-small">
						{t("admin.scope")}
					</span>
				</div>
				<div className="ml-auto flex items-center gap-1">
					<Avatar size="sm" className="bg-md-primary-container">
						<AvatarFallback className="text-md-on-primary-container text-label-large-emph">
							{username ? initialsOf(username) : t("role.admin").slice(0, 1)}
						</AvatarFallback>
					</Avatar>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("admin.logout")}
						onClick={() => void handleLogout()}
					>
						<LogOut />
					</Button>
				</div>
			</header>

			<nav className="border-separator-secondary flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
				{navItems.map((item) => (
					<Link
						key={item.key}
						to={item.to}
						aria-current={item.active ? "page" : undefined}
						className={cn(
							"flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-label-large transition-colors",
							item.active
								? "bg-md-secondary-container text-md-on-secondary-container text-label-large-emph"
								: "text-md-on-surface-variant hover:bg-md-on-surface/8",
						)}
					>
						<item.icon className="size-5" />
						{t(item.labelKey)}
					</Link>
				))}
			</nav>

			<main className="bg-md-surface-container-low min-w-0 flex-1 px-4 py-6 md:overflow-y-auto md:rounded-tl-2xl md:px-10 md:py-9">
				{children}
			</main>
		</div>
	);
}
