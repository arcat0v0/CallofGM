import type { CharacterInviteInfoResponse } from "@cogm/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { fetchAccountMe, requireAccount } from "@/lib/identity";
import { getRuleComponent } from "@/rules/registry";

export const Route = createFileRoute("/submit/$token")({
	beforeLoad: () => requireAccount(["pl"]),
	component: SubmitPage,
});

function SubmitPage() {
	useI18nVersion();
	const { token } = Route.useParams();
	const navigate = useNavigate();
	const [info, setInfo] = useState<CharacterInviteInfoResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<"new" | "existing">("new");
	const [name, setName] = useState("");
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

	useEffect(() => {
		void fetchAccountMe();
	}, []);

	async function submit() {
		if (pending) {
			return;
		}
		setPending(true);
		try {
			await api(`/pl/invites/${encodeURIComponent(token)}/submissions`, {
				method: "POST",
				body: JSON.stringify(
					mode === "new"
						? {
								mode: "new",
								name: name.trim(),
								sheetData: info
									? getRuleComponent(info.ruleId).createEmptySheet()
									: {},
							}
						: { mode: "existing", characterId },
				),
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
			<main className="flex min-h-dvh items-center justify-center">
				<p className="text-foreground-tertiary">{t("common.loading")}</p>
			</main>
		);
	}

	if (done) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
				<CheckCircle2 className="text-success size-14" />
				<h1 className="text-title-large-emph">{t("submit.doneTitle")}</h1>
				<p className="text-md-on-surface-variant max-w-md text-center text-body-medium">
					{t("submit.doneBody")}
				</p>
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

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-10">
			<div className="flex flex-col items-center gap-3">
				<Logo className="size-14" />
				<h1 className="text-display-small-emph font-serif">
					{t("submit.title")}
				</h1>
				{info ? (
					<div className="text-md-on-surface-variant flex items-center gap-2 text-title-medium">
						<Link2 className="size-4" />
						{info.targetName}
						<Badge variant="soft" tone="default" size="sm">
							{info.ruleId}
						</Badge>
					</div>
				) : null}
			</div>

			<Card className="flex w-full flex-col gap-5 p-6">
				<div className="flex gap-2">
					<Button
						type="button"
						variant={mode === "new" ? "primary" : "tertiary"}
						size="sm"
						onClick={() => setMode("new")}
					>
						{t("submit.modeNew")}
					</Button>
					<Button
						type="button"
						variant={mode === "existing" ? "primary" : "tertiary"}
						size="sm"
						onClick={() => setMode("existing")}
					>
						{t("submit.modeExisting")}
					</Button>
				</div>

				{mode === "new" ? (
					<FormField label={t("pl.characters.name")} htmlFor="submit-name">
						<Input
							id="submit-name"
							value={name}
							maxLength={100}
							onChange={(event) => setName(event.target.value)}
						/>
					</FormField>
				) : (
					<FormField label={t("submit.pickCharacter")}>
						<div className="flex flex-col gap-2">
							{(info?.ownedCharacters ?? [])
								.filter((item) => item.ruleId === info?.ruleId)
								.map((item) => (
									<Button
										key={item.id}
										type="button"
										variant={characterId === item.id ? "primary" : "tertiary"}
										className="justify-between"
										disabled={item.alreadySubmitted}
										onClick={() => setCharacterId(item.id)}
									>
										<span>{item.name}</span>
										{item.alreadySubmitted ? (
											<span className="text-label-small">
												{t("submit.alreadySubmitted")}
											</span>
										) : null}
									</Button>
								))}
						</div>
					</FormField>
				)}

				<Button
					type="button"
					variant="primary"
					disabled={pending || (mode === "new" ? !name.trim() : !characterId)}
					onClick={() => void submit()}
				>
					{t("submit.submit")}
				</Button>
			</Card>
		</main>
	);
}
