import { type CharacterInviteInfoResponse, safeReturnTo } from "@cogm/shared";
import {
	createFileRoute,
	isRedirect,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { CheckCircle2, Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp } from "@/lib/format";
import { requireAccount } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/submit/$token")({
	beforeLoad: async ({ params }) => {
		const account = await requireAccount(["pl"]).catch((error) => {
			if (isRedirect(error)) {
				throw redirect({
					to: "/login",
					search: {
						returnTo: safeReturnTo(`/submit/${params.token}`) ?? undefined,
					},
				});
			}
			throw error;
		});
		return account;
	},
	component: SubmitPage,
});

function SubmitPage() {
	useI18nVersion();
	const { token } = Route.useParams();
	const navigate = useNavigate();
	const [info, setInfo] = useState<CharacterInviteInfoResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<"new" | "existing">("new");
	const [name] = useState("");
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
			toast.error(isApiError(error) ? error.message : t("submit.invalid"));
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
			<main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-6">
				<Logo className="size-12" />
				<LoadingIndicator label={t("common.loading")} />
			</main>
		);
	}

	if (done) {
		return (
			<main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
				<Logo className="size-12" />
				<CheckCircle2 className="text-success size-12" />
				<div className="flex max-w-md flex-col gap-2 text-center">
					<h1 className="text-foreground font-sans text-headline-small-emph">
						{t("submit.doneTitle")}
					</h1>
					<p className="text-md-on-surface-variant text-pretty text-body-medium">
						{t("submit.doneBody")}
					</p>
				</div>
				<Button
					type="button"
					variant="tertiary"
					onClick={() => void navigate({ to: "/pl/characters" })}
				>
					{t("submit.backToLibrary")}
				</Button>
			</main>
		);
	}

	const candidates = (info?.ownedCharacters ?? []).filter(
		(item) => item.ruleId === info?.ruleId,
	);

	return (
		<main className="bg-background flex min-h-dvh flex-col">
			<header className="flex items-center justify-center gap-3 py-8">
				<Logo className="size-10" />
				<span className="text-foreground font-serif text-title-large-emph">
					{t("app.name")}
				</span>
			</header>

			<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-12">
				<div className="flex flex-col gap-2">
					<h1 className="text-foreground font-sans text-headline-medium-emph">
						{t("submit.title")}
					</h1>
					<p className="text-md-on-surface-variant text-body-large">
						{t("submit.intro")}
					</p>
				</div>

				{info ? (
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
				) : null}

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
										name: name || undefined,
										rule: info?.ruleId,
										targetName: info?.targetName,
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
			</div>
		</main>
	);
}
