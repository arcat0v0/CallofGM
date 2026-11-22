import type { GmAdminNavCtx } from "@cogm/theme-sdk";
import { Link } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export function GmAdminNav({ items, onLogout }: GmAdminNavCtx) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const current = items.find((item) => item.active);

	return (
		<>
			{/* 移动端顶部紧凑导航条 + 左侧抽屉，释放完整屏幕宽度 */}
			<header className="border-md-outline-variant/60 bg-background flex h-14 shrink-0 items-center gap-3 border-b px-3 md:hidden">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("gm.nav.openMenu")}
					className="text-md-on-surface size-10 shrink-0"
					onClick={() => setDrawerOpen(true)}
				>
					<Menu className="size-5" />
				</Button>
				<Link
					to="/gm"
					aria-label={t("app.gmBackstage")}
					className="flex min-w-0 items-center gap-2.5"
				>
					<Logo className="size-7 shrink-0" />
					<span className="text-md-on-surface truncate text-title-medium-emph">
						{current?.label ?? t("app.gmBackstage")}
					</span>
				</Link>
				<div className="flex-1" />
				<Avatar size="sm" className="bg-md-primary-container">
					<AvatarFallback className="text-md-on-primary-container text-label-medium-emph">
						{t("common.gmShort")}
					</AvatarFallback>
				</Avatar>
			</header>

			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent side="left" className="w-72 bg-md-surface p-0">
					<SheetHeader className="border-md-outline-variant/60 flex-row items-center gap-3 border-b px-5 py-4">
						<Logo className="size-8 shrink-0" />
						<SheetTitle className="text-title-medium-emph text-md-on-surface">
							{t("app.gmBackstage")}
						</SheetTitle>
					</SheetHeader>
					<SheetBody className="flex flex-col gap-1 px-3 py-3">
						{items.map((item) => {
							const Icon = item.icon;
							return (
								<Link
									key={item.key}
									to={item.to as never}
									aria-current={item.active ? "page" : undefined}
									onClick={() => setDrawerOpen(false)}
									className={cn(
										"flex h-11 items-center gap-3 rounded-lg px-3 transition-colors",
										item.active
											? "bg-md-primary-container text-md-on-primary-container text-body-medium-emph"
											: "text-md-on-surface-variant hover:bg-md-surface-container hover:text-md-on-surface text-body-medium",
									)}
								>
									<Icon className="size-5 shrink-0" />
									<span className="truncate">{item.label}</span>
								</Link>
							);
						})}
						<div className="mt-auto border-t border-md-outline-variant/60 pt-3">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-md-on-surface-variant h-11 w-full justify-start gap-3 px-3"
								onClick={() => {
									setDrawerOpen(false);
									onLogout();
								}}
							>
								<LogOut className="size-4" />
								{t("gm.nav.logout")}
							</Button>
						</div>
					</SheetBody>
				</SheetContent>
			</Sheet>

			{/* 桌面端左侧导航栏 */}
			<nav className="hidden w-24 shrink-0 flex-col items-center overflow-y-auto pt-4 pb-9 md:flex">
				<Link to="/gm" aria-label={t("app.gmBackstage")} className="mb-4 shrink-0">
					<Logo className="size-10" />
				</Link>

				<div className="flex flex-col items-center gap-2.5">
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
											? "bg-md-primary-container text-md-on-primary-container"
											: "text-md-on-surface-variant group-hover:bg-md-on-surface/8 group-active:bg-md-on-surface/12",
									)}
								>
									<Icon className="size-5" />
								</span>
								<span
									className={cn(
										"text-center",
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

				<div className="min-h-4 flex-1" />

				<div className="flex shrink-0 flex-col items-center gap-2.5 pt-2">
					<Avatar size="md" className="bg-md-primary-container">
						<AvatarFallback className="text-md-on-primary-container text-label-large-emph">
							{t("common.gmShort")}
						</AvatarFallback>
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
		</>
	);
}
