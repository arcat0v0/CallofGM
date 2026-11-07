import type { CharacterInviteInfoResponse, RuleMetadata } from "@cogm/shared";
import { ArrowLeft, CheckCircle2, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SheetSection, TextField } from "@/components/shared/creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { getRuleComponent } from "@/rules/registry";
import {
	clearCharacterCreationDraft,
	createEmptyCharacterSheet,
	hasInvalidCharacterCreationDraft,
	loadCharacterCreationDraft,
	saveCharacterCreationDraft,
} from "./character-creation-draft";

export type CharacterCreationMode = "independent" | "invite";

export type CharacterCreationSubmission = {
	mode: CharacterCreationMode;
	characterId: string | null;
};

export type CharacterCreationPageViewProps = {
	accountId: string;
	mode: CharacterCreationMode;
	inviteToken: string | null;
	inviteRuleId?: string | undefined;
	inviteTargetName?: string | undefined;
	initialName?: string;
	rules: ReadonlyArray<RuleMetadata>;
	onDone: (submission: CharacterCreationSubmission) => void;
	onNavigateBack?: (() => void) | undefined;
};

export function CharacterCreationPageView({
	accountId,
	mode,
	inviteToken,
	inviteRuleId,
	inviteTargetName,
	initialName,
	rules,
	onDone,
	onNavigateBack,
}: CharacterCreationPageViewProps) {
	const context = useMemo(
		() => (mode === "invite" ? `invite:${inviteToken}` : "independent"),
		[mode, inviteToken],
	);
	const [initial] = useState(() => {
		const invalid = hasInvalidCharacterCreationDraft(accountId, context);
		const draft = loadCharacterCreationDraft(accountId, context);
		if (invalid) {
			clearCharacterCreationDraft(accountId, context);
		}
		return { draft, invalid };
	});
	const [name, setName] = useState(initial.draft?.name ?? initialName ?? "");
	const [background, setBackground] = useState(initial.draft?.background ?? "");
	const [ruleId, setRuleId] = useState(
		mode === "invite"
			? (inviteRuleId ?? initial.draft?.ruleId ?? "")
			: (initial.draft?.ruleId ?? ""),
	);
	const [sheet, setSheet] = useState(
		initial.draft?.sheet ?? createEmptyCharacterSheet(),
	);
	const [showValidation, setShowValidation] = useState(false);
	const [ruleValid, setRuleValid] = useState(true);
	const [pending, setPending] = useState(false);
	const [draftSaved, setDraftSaved] = useState(Boolean(initial.draft));
	const [draftFailed, setDraftFailed] = useState(false);
	const [restoredNotice, setRestoredNotice] = useState(Boolean(initial.draft));
	const [clearOpen, setClearOpen] = useState(false);
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [done, setDone] = useState(false);
	const [invite, setInvite] = useState<CharacterInviteInfoResponse | null>(
		inviteRuleId && inviteToken
			? {
					scope: "module",
					targetId: "",
					targetName: inviteTargetName ?? "",
					ruleId: inviteRuleId,
					expiresAt: 0,
					ownedCharacters: [],
				}
			: null,
	);
	const [inviteLoading, setInviteLoading] = useState(
		mode === "invite" && !inviteRuleId,
	);
	const [inviteError, setInviteError] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const dirty = useRef(false);

	useEffect(() => {
		if (mode !== "invite" || !inviteToken || inviteRuleId) {
			return;
		}
		let cancelled = false;
		void api<CharacterInviteInfoResponse>(
			`/pl/invites/${encodeURIComponent(inviteToken)}`,
		)
			.then((value) => {
				if (cancelled) {
					return;
				}
				setInvite(value);
				setRuleId((current) =>
					current === value.ruleId ? current : value.ruleId,
				);
			})
			.catch(() => {
				if (!cancelled) {
					setInviteError(true);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setInviteLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [mode, inviteToken, inviteRuleId]);

	useEffect(() => {
		if (!dirty.current) {
			return;
		}
		const timer = setTimeout(() => {
			const saved = saveCharacterCreationDraft({
				accountId,
				context,
				name,
				background,
				ruleId,
				sheet,
			});
			setDraftFailed(!saved);
			setDraftSaved(saved);
			setRestoredNotice(false);
		}, 250);
		return () => clearTimeout(timer);
	}, [accountId, context, name, background, ruleId, sheet]);

	function markDirty() {
		dirty.current = true;
		setErrorMessage("");
	}

	function updateName(value: string) {
		markDirty();
		setName(value);
	}

	function updateBackground(value: string) {
		markDirty();
		setBackground(value);
	}

	function updateRuleId(value: string) {
		markDirty();
		setRuleId(value);
	}

	function updateSheet(value: typeof sheet) {
		markDirty();
		setSheet(value);
	}

	const rule = getRuleComponent(ruleId || undefined);
	const CreationEditor = rule.creationEditor;
	const nameError = name.trim() === "";
	const ruleError = ruleId.trim() === "";
	const valid = !nameError && !ruleError && ruleValid;

	async function submit() {
		if (pending || done) {
			return;
		}
		setShowValidation(true);
		if (!valid || inviteLoading || inviteError) {
			setErrorMessage(t("characterCreation.validationSummary"));
			return;
		}
		const parsed = rule.parseSheet(sheet);
		if (!parsed) {
			setErrorMessage(t("characterCreation.ruleValidationSummary"));
			return;
		}
		setPending(true);
		setErrorMessage("");
		try {
			if (mode === "independent") {
				const result = await api<{ id?: string }>("/pl/characters", {
					method: "POST",
					body: JSON.stringify({
						name: name.trim(),
						background,
						ruleId,
						sheetData: parsed,
					}),
				});
				clearCharacterCreationDraft(accountId, context);
				toast.success(t("characterCreation.created"));
				onDone({ mode, characterId: result?.id ?? null });
			} else {
				await api(
					`/pl/invites/${encodeURIComponent(inviteToken ?? "")}/submissions`,
					{
						method: "POST",
						body: JSON.stringify({
							mode: "new",
							name: name.trim(),
							background,
							sheetData: parsed,
						}),
					},
				);
				clearCharacterCreationDraft(accountId, context);
				toast.success(t("characterCreation.submitted"));
				onDone({ mode, characterId: null });
			}
			setDone(true);
		} catch (error) {
			setErrorMessage(
				errorText(
					error,
					mode === "independent"
						? "characterCreation.saveFailed"
						: "characterCreation.submitFailed",
				),
			);
		} finally {
			setPending(false);
		}
	}

	function clearDraft() {
		clearCharacterCreationDraft(accountId, context);
		setName("");
		setBackground("");
		setRuleId(
			mode === "invite"
				? (inviteRuleId ?? invite?.ruleId ?? initial.draft?.ruleId ?? "")
				: "",
		);
		setSheet(createEmptyCharacterSheet());
		setShowValidation(false);
		setRestoredNotice(false);
		setDraftSaved(false);
		dirty.current = false;
		setClearOpen(false);
	}

	function leave() {
		if (!dirty.current || done) {
			onNavigateBack?.();
			return;
		}
		setLeaveOpen(true);
	}

	if (done) {
		return (
			<main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-12">
				<CheckCircle2 className="text-success size-12" />
				<h1 className="font-sans text-headline-small-emph text-foreground">
					{t(
						mode === "independent"
							? "characterCreation.created"
							: "submit.doneTitle",
					)}
				</h1>
				<p className="max-w-md text-pretty text-body-medium text-md-on-surface-variant">
					{t(mode === "independent" ? "pl.characters.hint" : "submit.doneBody")}
				</p>
				<Button
					type="button"
					variant="tertiary"
					onClick={() => onNavigateBack?.()}
				>
					{t("characterCreation.backToLibrary")}
				</Button>
			</main>
		);
	}

	return (
		<main className="bg-background min-h-dvh">
			<header className="border-separator-secondary/60 bg-background sticky top-0 z-10 border-b">
				<div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("characterCreation.back")}
						onClick={leave}
					>
						<ArrowLeft />
					</Button>
					<div className="flex min-w-0 flex-1 flex-col">
						<h1 className="truncate font-sans text-title-medium-emph text-foreground">
							{t("characterCreation.pageTitle")}
						</h1>
						<p className="text-label-small text-foreground-tertiary">
							{draftFailed
								? t("characterCreation.draftFailed")
								: restoredNotice
									? t("characterCreation.draftRestored")
									: draftSaved
										? t("characterCreation.draftSaved")
										: t("characterCreation.pageDescription")}
						</p>
					</div>
					<Button
						type="button"
						variant="primary"
						disabled={pending || inviteLoading}
						onClick={() => void submit()}
					>
						<Save />
						{t(
							mode === "independent"
								? "characterCreation.create"
								: "characterCreation.submit",
						)}
					</Button>
				</div>
			</header>

			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
				<nav
					aria-label={t("characterCreation.sectionNav")}
					className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
				>
					{[
						["identity", t("characterCreation.navIdentity")],
						["attributes", t("characterCreation.navAttributes")],
						["skills", t("characterCreation.navSkills")],
						["background", t("characterCreation.navBackground")],
						["combat", t("characterCreation.navCombat")],
						["assets", t("characterCreation.navAssets")],
						["magic", t("characterCreation.navMagic")],
					].map(([id, label]) => (
						<a
							key={id}
							href={`#${id}`}
							className="bg-md-surface-container text-foreground-secondary hover:bg-md-surface-container-high shrink-0 rounded-full px-3 py-1.5 text-label-medium"
						>
							{label}
						</a>
					))}
				</nav>

				{initial.invalid ? (
					<p
						role="status"
						className="rounded-xl bg-warning-soft px-4 py-3 text-body-medium text-warning-soft-foreground"
					>
						{t("characterCreation.invalidDraft")}
					</p>
				) : null}
				{inviteError ? (
					<p
						role="alert"
						className="rounded-xl bg-danger-soft px-4 py-3 text-body-medium text-danger-soft-foreground"
					>
						{t("characterCreation.inviteInvalid")}
					</p>
				) : null}
				{inviteLoading ? (
					<p className="text-body-medium text-foreground-secondary">
						{t("characterCreation.loadingInvite")}
					</p>
				) : null}
				{invite ? (
					<p className="text-body-medium text-foreground-secondary">
						{t("characterCreation.inviteTarget", { name: invite.targetName })} ·{" "}
						{invite.ruleId}
					</p>
				) : null}
				{restoredNotice ? (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-md-surface-container px-4 py-3">
						<span className="text-body-medium text-foreground-secondary">
							{t("characterCreation.draftRestored")}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setClearOpen(true)}
						>
							{t("characterCreation.clearDraft")}
						</Button>
					</div>
				) : null}

				<SheetSection
					id="identity"
					title={t("characterCreation.identitySection")}
					description={t("characterCreation.identitySectionHint")}
				>
					<div className="grid gap-4 md:grid-cols-2">
						<TextField
							label={t("characterCreation.name")}
							value={name}
							required
							showValidation={showValidation}
							maxLength={100}
							onChange={updateName}
						/>
						{mode === "independent" ? (
							<div className="flex min-w-0 flex-col gap-1.5">
								<Label htmlFor="creation-rule">{t("rules.label")}</Label>
								<Select value={ruleId} onValueChange={updateRuleId}>
									<SelectTrigger
										id="creation-rule"
										aria-label={t("rules.label")}
									>
										<SelectValue
											placeholder={t("characterCreation.ruleRequired")}
										/>
									</SelectTrigger>
									<SelectContent position="popper">
										{rules.map((item) => (
											<SelectItem key={item.id} value={item.id}>
												{item.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{showValidation && ruleError ? (
									<p className="text-body-small text-danger">
										{t("characterCreation.ruleRequired")}
									</p>
								) : null}
							</div>
						) : (
							<div className="flex min-w-0 flex-col gap-1.5">
								<Label>{t("rules.label")}</Label>
								<div className="flex h-10 items-center rounded-md border border-field-border bg-field px-3.5">
									<Badge variant="soft" tone="default" size="sm">
										{ruleId || invite?.ruleId}
									</Badge>
								</div>
								<p className="text-body-small text-foreground-tertiary">
									{t("characterCreation.ruleLocked")}
								</p>
							</div>
						)}
					</div>
				</SheetSection>

				<CreationEditor
					sheet={sheet}
					onChange={updateSheet}
					showValidation={showValidation}
					onValidityChange={setRuleValid}
				>
					<SheetSection
						id="background"
						title={t("characterCreation.backgroundTitle")}
						description={t("characterCreation.creativePromptsBody")}
					>
						<TextField
							label={t("characterCreation.background")}
							value={background}
							multiline
							maxLength={4000}
							onChange={updateBackground}
						/>
						<details className="rounded-xl bg-md-surface-container px-4 py-3">
							<summary className="cursor-pointer text-label-large-emph text-foreground">
								{t("characterCreation.creativePrompts")}
							</summary>
							<p className="mt-2 text-body-medium text-foreground-secondary">
								{t("characterCreation.creativePromptsBody")}
							</p>
						</details>
					</SheetSection>
				</CreationEditor>

				<SheetSection
					id="check"
					title={t("characterCreation.reviewTitle")}
					description={t("characterCreation.reviewDescription")}
				>
					{errorMessage ? (
						<p
							role="alert"
							className="rounded-xl bg-danger-soft px-4 py-3 text-body-medium text-danger-soft-foreground"
						>
							{errorMessage}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="button"
							variant="primary"
							disabled={pending || inviteLoading}
							onClick={() => void submit()}
						>
							<Save />
							{t(
								mode === "independent"
									? "characterCreation.create"
									: "characterCreation.submit",
							)}
						</Button>
						<Button type="button" variant="tertiary" onClick={leave}>
							{t("characterCreation.back")}
						</Button>
					</div>
				</SheetSection>
			</div>

			<ConfirmDialog
				open={clearOpen}
				onOpenChange={setClearOpen}
				icon={Trash2}
				title={t("characterCreation.clearDraftTitle")}
				description={t("characterCreation.clearDraftDescription")}
				confirmLabel={t("characterCreation.confirmClear")}
				onConfirm={clearDraft}
			/>

			<ConfirmDialog
				open={leaveOpen}
				onOpenChange={setLeaveOpen}
				icon={RotateCcw}
				variant="warning"
				title={t("characterCreation.leaveTitle")}
				description={t("characterCreation.leaveDescription")}
				confirmLabel={t("characterCreation.confirmLeave")}
				onConfirm={() => onNavigateBack?.()}
			/>
		</main>
	);
}
