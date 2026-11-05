import { LoginSearch, safeReturnTo, type UserRole } from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { VersionBadge } from "@/features/version/version-badge";
import { t, useI18nVersion } from "@/i18n";
import { isApiError } from "@/lib/api";
import { loginAccount } from "@/lib/identity";

export const Route = createFileRoute("/login")({
	validateSearch: (search) => LoginSearch.parse(search),
	component: LoginPage,
});

function roleHome(role: UserRole): string {
	if (role === "admin") {
		return "/admin";
	}
	if (role === "pl") {
		return "/pl";
	}
	return "/gm";
}

function LoginPage() {
	useI18nVersion();
	const search = Route.useSearch();
	const returnTo = safeReturnTo(search.returnTo);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!username.trim() || !password || pending) {
			return;
		}
		setPending(true);
		setError(null);
		try {
			const result = await loginAccount(username.trim(), password);
			if (returnTo) {
				await navigate({ href: returnTo });
				return;
			}
			await navigate({ to: roleHome(result.role) });
		} catch (cause) {
			setError(
				isApiError(cause) && cause.status === 401
					? t("login.invalidCredentials")
					: isApiError(cause)
						? cause.message
						: t("login.failed"),
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<main className="bg-background relative grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
			<section className="bg-md-surface-container-low hidden flex-col justify-between p-12 lg:flex xl:p-16">
				<div className="flex items-center gap-3">
					<Logo className="size-10" />
					<span className="text-foreground font-serif text-title-medium-emph">
						{t("app.name")}
					</span>
				</div>
				<div className="flex max-w-xl flex-col gap-4">
					<p className="text-foreground font-serif text-display-medium-emph">
						{t("app.name")}
					</p>
					<p className="text-md-on-surface-variant font-serif text-headline-medium">
						{t("app.subtitle")}
					</p>
					<p className="text-md-on-surface-variant text-body-large">
						{t("login.subtitle")}
					</p>
				</div>
				<p className="text-foreground-tertiary text-body-small">
					{t("login.hint")}
				</p>
			</section>

			<section className="flex min-h-dvh items-center justify-center px-6 py-12">
				<div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex w-full max-w-105 flex-col gap-8 duration-500">
					<div className="flex flex-col gap-3 lg:hidden">
						<Logo className="size-12" />
						<div className="flex flex-col gap-0.5">
							<span className="text-foreground font-serif text-title-large-emph">
								{t("app.name")}
							</span>
							<span className="text-foreground-tertiary text-label-small">
								{t("app.subtitle")}
							</span>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<h1 className="text-foreground font-sans text-headline-medium-emph">
							{t("login.title")}
						</h1>
						<p className="text-md-on-surface-variant text-body-large">
							{t("login.subtitle")}
						</p>
					</div>

					<form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
						<label
							htmlFor="login-username"
							className="text-md-on-surface-variant px-1 text-label-medium"
						>
							{t("login.usernameLabel")}
						</label>
						<InputGroup className="h-14 px-4">
							<InputGroupAddon>
								<User />
							</InputGroupAddon>
							<InputGroupInput
								id="login-username"
								type="text"
								placeholder={t("login.usernamePlaceholder")}
								aria-label={t("login.usernameLabel")}
								aria-invalid={error !== null}
								autoComplete="username"
								onChange={(event) => {
									setUsername(event.target.value);
									setError(null);
								}}
								value={username}
							/>
						</InputGroup>

						<label
							htmlFor="login-password"
							className="text-md-on-surface-variant px-1 text-label-medium"
						>
							{t("login.passwordLabel")}
						</label>
						<InputGroup className="h-14 px-4">
							<InputGroupAddon>
								<Lock />
							</InputGroupAddon>
							<InputGroupInput
								id="login-password"
								type={showPassword ? "text" : "password"}
								placeholder={t("login.passwordPlaceholder")}
								aria-label={t("login.passwordLabel")}
								aria-invalid={error !== null}
								aria-describedby={error ? "login-error" : undefined}
								autoComplete="current-password"
								onChange={(event) => {
									setPassword(event.target.value);
									setError(null);
								}}
								value={password}
							/>
							<InputGroupButton
								type="button"
								onClick={() => setShowPassword((value) => !value)}
								aria-label={
									showPassword
										? t("login.hidePassword")
										: t("login.showPassword")
								}
							>
								{showPassword ? <Eye /> : <EyeOff />}
							</InputGroupButton>
						</InputGroup>

						<p
							id="login-error"
							role="alert"
							aria-live="assertive"
							aria-atomic="true"
							className="text-danger min-h-4 px-1 text-body-small"
						>
							{error ?? ""}
						</p>

						<Button
							type="submit"
							variant="primary"
							disabled={pending || !username.trim() || !password}
							className="h-14 w-full"
						>
							{pending ? t("login.pending") : t("login.submit")}
						</Button>
					</form>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<Button
							asChild
							variant="ghost"
							size="sm"
							className="text-foreground-secondary"
						>
							<Link to="/">
								<ArrowLeft className="text-foreground-tertiary" />
								{t("login.back")}
							</Link>
						</Button>
						<p className="text-foreground-tertiary text-label-small lg:hidden">
							{t("login.hint")}
						</p>
					</div>
				</div>
			</section>
			<VersionBadge className="absolute right-4 bottom-4" />
		</main>
	);
}
