import {
	extractSessionReference,
	isSixHexSessionReference,
	ResolveSessionReferenceResponse,
} from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Link as LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { VersionBadge } from "@/features/version/version-badge";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";

export const Route = createFileRoute("/")({
	component: HomePage,
});

export function HomePage() {
	useI18nVersion();
	const [code, setCode] = useState("");
	const [resolving, setResolving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const resolvingRef = useRef(false);
	const mountedRef = useRef(true);
	const navigate = useNavigate();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (resolvingRef.current) {
			return;
		}
		const trimmed = code.trim();
		if (!trimmed) {
			return;
		}
		const reference = extractSessionReference(trimmed);
		if (!reference) {
			setError(t("error.SESSION_NOT_FOUND"));
			return;
		}
		setError(null);
		if (!isSixHexSessionReference(reference)) {
			void navigate({
				to: "/join/$sessionId",
				params: { sessionId: reference },
			});
			return;
		}
		resolvingRef.current = true;
		setResolving(true);
		try {
			const resolved = ResolveSessionReferenceResponse.parse(
				await api<ResolveSessionReferenceResponse>(
					`/public/session-references/${encodeURIComponent(reference)}`,
				),
			);
			if (!mountedRef.current) {
				return;
			}
			await navigate({
				to: "/join/$sessionId",
				params: { sessionId: resolved.sessionId },
			});
		} catch (cause) {
			if (mountedRef.current) {
				setError(isApiError(cause) ? cause.message : t("error.fallback"));
			}
		} finally {
			resolvingRef.current = false;
			if (mountedRef.current) {
				setResolving(false);
			}
		}
	}

	return (
		<main className="bg-background relative flex min-h-dvh w-full flex-col items-center justify-center gap-12 overflow-hidden px-6">
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
				<h1 className="text-foreground font-serif text-display-large-emph">
					{t("app.name")}
				</h1>
				<p className="text-md-on-surface-variant text-title-medium tracking-[2px]">
					{t("app.subtitle")}
				</p>
				<p className="text-foreground-secondary max-w-md text-center text-body-medium">
					{t("home.intro")}
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className="animate-in fade-in slide-in-from-bottom-4 ease-expressive-default-spatial flex w-full max-w-105 flex-col gap-2 delay-150 duration-500"
			>
				<div className="flex w-full items-center gap-2.5">
					<InputGroup className="h-14 flex-1 px-4">
						<InputGroupAddon>
							<LinkIcon />
						</InputGroupAddon>
						<InputGroupInput
							value={code}
							disabled={resolving}
							onChange={(event) => {
								if (resolvingRef.current) {
									return;
								}
								setCode(event.target.value);
								if (error !== null) {
									setError(null);
								}
							}}
							onInput={(event) => {
								if (resolvingRef.current) {
									return;
								}
								setCode(event.currentTarget.value);
								if (error !== null) {
									setError(null);
								}
							}}
							aria-label={t("home.codeLabel")}
							aria-invalid={error !== null}
							aria-describedby={error ? "home-error" : undefined}
							placeholder={t("home.codePlaceholder")}
						/>
					</InputGroup>
					<Button
						type="submit"
						variant="primary"
						disabled={resolving}
						className="h-14 shrink-0 px-8"
					>
						{resolving ? t("home.resolving") : t("home.enter")}
					</Button>
				</div>
				<p
					id="home-error"
					role="alert"
					aria-live="assertive"
					aria-atomic="true"
					className="text-danger min-h-4 px-1 text-body-small"
				>
					{error ?? ""}
				</p>
			</form>

			<div className="animate-in fade-in ease-standard-default-effects absolute bottom-6 flex items-center gap-2 delay-300 duration-300">
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="text-foreground-secondary"
				>
					<Link to="/login">
						<KeyRound className="text-foreground-tertiary" />
						{t("home.accountEntry")}
					</Link>
				</Button>
			</div>
			<VersionBadge />
		</main>
	);
}
