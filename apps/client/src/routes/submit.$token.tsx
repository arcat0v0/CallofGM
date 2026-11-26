import type {
	CharacterInviteInfoResponse,
	CharacterInviteRegistrationInfo,
} from "@cogm/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Link2, Link2Off, LogIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlayerAccountForm } from "@/features/accounts/player-account-form";
import { PlayerNavigation } from "@/features/accounts/player-navigation";
import { t, useI18nVersion } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp } from "@/lib/format";
import {
	fetchAccountMe,
	registerInvitedPlayer,
	roleHome,
} from "@/lib/identity";
import { cn } from "@/lib/utils";
import { type AccountRole, useIdentityStore } from "@/stores/identity-store";

export const Route = createFileRoute("/submit/$token")({
	beforeLoad: async () => {
		await fetchAccountMe();
	},
	component: SubmitPage,
});

function SubmitPage() {
	useI18nVersion();
	const { token } = Route.useParams();
	const role = useIdentityStore((state) => state.account?.role ?? null);

	return (
		<div className="bg-background flex min-h-dvh flex-col">
			{role === "pl" ? (
				<PlayerNavigation onSubmitPage />
			) : (
				<header className="border-separator-secondary border-b">
					<div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 md:px-6">
						<Link
							to={role ? roleHome(role) : "/"}
							className="flex items-center gap-3"
						>
							<Logo className="size-8" />
							<span className="text-foreground font-serif text-title-medium-emph">
								{t("app.name")}
							</span>
						</Link>
					</div>
				</header>
			)}
			{role === "pl" ? (
				<PlayerSubmission key={token} token={token} />
			) : (
				<InviteRegistration key={token} token={token} role={role} />
			)}
		</div>
	);
}

function InviteRegistration({
	token,
	role,
}: {
	token: string;
	role: AccountRole | null;
}) {
	const [invite, setInvite] = useState<CharacterInviteRegistrationInfo | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		void api<CharacterInviteRegistrationInfo>(
			`/public/character-invites/${encodeURIComponent(token)}`,
			{ signal: controller.signal },
		).then(setInvite, (cause) => {
			if (!controller.signal.aborted)
				setError(errorText(cause, "submit.invalid"));
		});
		return () => controller.abort();
	}, [token]);

	const login = (
		<Button
			asChild
			variant={role ? "primary" : "ghost"}
			className="min-h-11 w-full"
		>
			<Link
				to="/login"
				search={{ returnTo: `/submit/${encodeURIComponent(token)}` }}
			>
				<LogIn data-icon="inline-start" />
				{t(role ? "submit.switchAccount" : "submit.signIn")}
			</Link>
		</Button>
	);

	return (
		<main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8 sm:py-12">
			<h1 className="text-foreground text-headline-medium-emph">
				{t("submit.title")}
			</h1>
			{error ? (
				<EmptyState icon={Link2Off} title={error} />
			) : invite ? (
				<div className="flex flex-col gap-5 rounded-2xl bg-md-surface-container-low p-5 sm:p-6">
					<div className="flex flex-col gap-1">
						<h2 className="text-foreground break-words text-title-large-emph">
							{invite.targetName}
						</h2>
						<p className="text-md-on-surface-variant text-body-medium">
							{t(role ? "submit.invitedBy" : "submit.registerUnderGm", {
								name: invite.gmUsername,
							})}
						</p>
					</div>
					{role ? (
						<p className="text-md-on-surface-variant text-body-medium">
							{t("submit.usePlayerAccount")}
						</p>
					) : (
						<PlayerAccountForm
							submitLabel={t("submit.register")}
							onSubmit={async (credentials) => {
								await registerInvitedPlayer(token, credentials);
							}}
						/>
					)}
					{login}
				</div>
			) : (
				<LoadingIndicator label={t("common.loading")} />
			)}
		</main>
	);
}

function PlayerSubmission({ token }: { token: string }) {
	const [info, setInfo] = useState<CharacterInviteInfoResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<"new" | "existing">("new");
	const [characterId, setCharacterId] = useState("");
	const [pending, setPending] = useState(false);
	const [done, setDone] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setInfo(
				await api<CharacterInviteInfoResponse>(
					`/pl/invites/${encodeURIComponent(token)}`,
				),
			);
		} catch (error) {
			setError(errorText(error, "submit.invalid"));
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		void load();
	}, [load]);

	async function submit() {
		if (pending) {
			return;
		}
		setPending(true);
		try {
			await api(`/pl/invites/${encodeURIComponent(token)}/submissions`, {
				method: "POST",
				body: JSON.stringify({ mode: "existing", characterId }),
			});
			setDone(true);
		} catch (error) {
			toast.error(errorText(error, "submit.failed"));
		} finally {
			setPending(false);
		}
	}

	if (loading) {
		return (
			<main className="flex flex-1 flex-col items-center justify-center gap-6">
				<LoadingIndicator label={t("common.loading")} />
			</main>
		);
	}

	if (done) {
		return (
			<main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
				<CheckCircle2 className="text-success size-12" />
				<div className="flex max-w-md flex-col gap-2 text-center">
					<h1 className="text-foreground font-sans text-headline-small-emph">
						{t("submit.doneTitle")}
					</h1>
					<p className="text-md-on-surface-variant text-pretty text-body-medium">
						{t(
							info?.scope === "module"
								? "submit.moduleDoneBody"
								: "submit.doneBody",
						)}
					</p>
				</div>
			</main>
		);
	}

	if (!info) {
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-8">
				<EmptyState icon={Link2Off} title={error ?? t("submit.invalid")} />
			</main>
		);
	}

	const candidates = info.ownedCharacters.filter(
		(item) => item.ruleId === info.ruleId,
	);

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
			<div className="flex flex-col gap-2">
				<h1 className="text-foreground font-sans text-headline-medium-emph">
					{t("submit.title")}
				</h1>
				<p className="text-md-on-surface-variant text-body-large">
					{t(info.scope === "module" ? "submit.moduleIntro" : "submit.intro")}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-md-surface-container px-4 py-3.5">
				<Link2 className="text-foreground-secondary size-5 shrink-0" />
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="text-foreground truncate font-sans text-title-medium-emph">
						{info.targetName}
					</span>
					<span className="text-foreground-tertiary text-label-small">
						{t("submit.targetLabel")} ·{" "}
						{t("submit.expiresAt", {
							time: formatStamp(info.expiresAt),
						})}
					</span>
				</div>
				<Badge variant="soft" tone="default" size="sm">
					{info.ruleId}
				</Badge>
			</div>

			<div className="flex flex-col gap-5 rounded-2xl bg-md-surface-container-low p-5 md:p-6">
				<SegmentedControl
					value={mode}
					onValueChange={setMode}
					options={[
						{ value: "new", label: t("submit.modeNew") },
						{ value: "existing", label: t("submit.modeExisting") },
					]}
				/>

				{mode === "new" ? (
					<div className="flex flex-col gap-3">
						<p className="text-foreground-secondary text-body-medium">
							{t("submit.newCharacterHint")}
						</p>
						<Button asChild variant="primary" className="h-12 w-full">
							<Link
								to="/pl/characters/new"
								search={{
									invite: token,
									rule: info.ruleId,
									targetName: info.targetName,
								}}
							>
								{t("submit.openCreator")}
							</Link>
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<span className="text-foreground-secondary text-label-large">
								{t("submit.pickCharacter")}
							</span>
							<span className="text-foreground-tertiary text-label-small">
								{t("submit.existingHint")}
							</span>
						</div>
						{candidates.length === 0 ? (
							<p className="text-foreground-secondary rounded-xl bg-md-surface-container px-4 py-6 text-center text-body-medium">
								{t("submit.noExisting")}
							</p>
						) : (
							<RadioGroup value={characterId} onValueChange={setCharacterId}>
								{candidates.map((item) => (
									<label
										key={item.id}
										htmlFor={`submit-character-${item.id}`}
										className={cn(
											"flex items-center gap-3 rounded-xl bg-md-surface-container px-4 py-3.5",
											item.alreadySubmitted ? "opacity-60" : "cursor-pointer",
										)}
									>
										<RadioGroupItem
											id={`submit-character-${item.id}`}
											value={item.id}
											disabled={item.alreadySubmitted}
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="text-foreground truncate text-label-large-emph">
												{item.name}
											</span>
											<span className="text-foreground-tertiary text-label-small">
												{item.ruleId}
												{item.sheetVersion === null
													? ""
													: ` · v${item.sheetVersion}`}
											</span>
										</span>
										{item.alreadySubmitted ? (
											<Badge variant="soft" tone="default" size="sm">
												{t("submit.alreadySubmitted")}
											</Badge>
										) : null}
									</label>
								))}
							</RadioGroup>
						)}
					</div>
				)}

				{mode === "existing" ? (
					<Button
						type="button"
						variant="primary"
						className="h-12 w-full"
						disabled={pending || !characterId}
						onClick={() => void submit()}
					>
						{t("submit.submit")}
					</Button>
				) : null}
			</div>
		</main>
	);
}
