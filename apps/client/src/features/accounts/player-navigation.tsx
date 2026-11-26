import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { logoutAccount } from "@/lib/identity";
import { useIdentityStore } from "@/stores/identity-store";

export function PlayerNavigation({
	onSubmitPage = false,
}: {
	onSubmitPage?: boolean;
}) {
	const navigate = useNavigate();
	const username = useIdentityStore((state) => state.account?.username ?? null);

	async function logout() {
		try {
			await logoutAccount();
		} finally {
			if (!onSubmitPage) await navigate({ to: "/login" });
		}
	}

	return (
		<header className="border-separator-secondary bg-background sticky top-0 z-10 border-b">
			<nav
				aria-label={t("pl.workspace")}
				className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 md:px-6"
			>
				<Link
					to="/pl"
					aria-label={t("pl.workspace")}
					className="flex shrink-0 items-center gap-3"
				>
					<Logo className="size-8" />
					<span className="flex flex-col">
						<span className="text-foreground font-serif text-title-medium-emph">
							{t("app.name")}
						</span>
						{!onSubmitPage && (
							<span className="text-foreground-tertiary text-label-small">
								{t("pl.workspace")}
							</span>
						)}
					</span>
				</Link>
				<div className="ml-auto flex min-w-0 items-center gap-2">
					{onSubmitPage ? (
						<Button
							asChild
							variant="ghost"
							size="sm"
							className="min-h-11 min-w-0 shrink"
						>
							<Link to="/pl">
								<ArrowLeft
									data-icon="inline-start"
									className="hidden sm:block"
								/>
								<span className="truncate">{t("submit.backToWorkspace")}</span>
							</Link>
						</Button>
					) : (
						<span className="text-foreground-secondary hidden truncate text-body-small sm:block">
							{username}
						</span>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-11 shrink-0"
						aria-label={t("account.logout")}
						onClick={() => void logout().catch(() => undefined)}
					>
						<LogOut />
					</Button>
				</div>
			</nav>
		</header>
	);
}
