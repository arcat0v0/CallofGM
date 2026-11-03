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
import { t, useI18nVersion } from "@/i18n";
import { isApiError } from "@/lib/api";
import { loginAccount } from "@/lib/identity";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function roleHome(role: string): string {
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
		<main className="bg-background relative flex min-h-dvh flex-col items-center justify-center gap-12 overflow-hidden px-6">
			<div
				aria-hidden
				className="bg-md-primary/12 pointer-events-none absolute -top-32 -left-32 size-105 rounded-full blur-3xl"
			/>
			<div
				aria-hidden
				className="bg-md-tertiary/12 pointer-events-none absolute -right-40 -bottom-40 size-120 rounded-full blur-3xl"
			/>

			<div className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex flex-col items-center gap-4 duration-500">
				<Logo className="size-16" />
				<h1 className="text-foreground font-serif text-display-small-emph">
					{t("login.title")}
				</h1>
				<p className="text-md-on-surface-variant text-title-medium">
					{t("login.subtitle")}
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex w-full max-w-105 flex-col gap-2.5 delay-150 duration-500"
			>
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
							showPassword ? t("login.hidePassword") : t("login.showPassword")
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

			<div className="animate-in fade-in ease-standard-default-effects absolute bottom-6 flex flex-col items-center gap-2 delay-300 duration-300">
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
				<p className="text-foreground-tertiary font-sans text-label-small">
					{t("login.hint")}
				</p>
			</div>
		</main>
	);
}
