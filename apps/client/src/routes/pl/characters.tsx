import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Pencil, Plus, Trash2, VenetianMask } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CharacterProfileEditorDialog } from "@/features/characters/character-profile-editor-dialog";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { initialsOf } from "@/lib/format";
import { logoutAccount, requireAccount } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";
import { getRuleComponent } from "@/rules/registry";
import { useIdentityStore } from "@/stores/identity-store";

export const Route = createFileRoute("/pl/characters")({
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharactersPage,
});

type EditorState = {
	open: boolean;
};

function PlCharactersPage() {
	useI18nVersion();
	const [characters, setCharacters] = useState<CharacterDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [editor, setEditor] = useState<EditorState>({ open: false });
	const [profileCharacter, setProfileCharacter] =
		useState<CharacterDetailDto | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CharacterDto | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setCharacters(await fetchAllPages<CharacterDto>("/pl/characters"));
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("pl.characters.empty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function remove(character: CharacterDto) {
		try {
			await api(`/pl/characters/${character.id}`, { method: "DELETE" });
			setDeleteTarget(null);
			await load();
		} catch (error) {
			toast.error(errorText(error, "pl.characters.deleteFailed"));
		}
	}

	return (
		<PlShell>
			<PageHeader
				title={t("pl.characters.title")}
				description={t("pl.characters.description")}
				actions={
					<Button
						type="button"
						variant="primary"
						onClick={() => setEditor({ open: true })}
					>
						<Plus />
						{t("pl.characters.create")}
					</Button>
				}
			/>

			{loading ? (
				<ListSkeleton rows={3} />
			) : characters.length === 0 ? (
				<EmptyState
					icon={VenetianMask}
					title={t("pl.characters.empty")}
					description={t("pl.characters.emptyHint")}
					action={
						<Button
							type="button"
							variant="primary"
							onClick={() => setEditor({ open: true })}
						>
							<Plus />
							{t("pl.characters.create")}
						</Button>
					}
				/>
			) : (
				<div className="flex flex-col gap-3">
					<span className="text-foreground-secondary text-label-large">
						{t("pl.characters.count", { count: characters.length })}
					</span>
					<div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container-low duration-500 ease-standard-default-spatial">
						{characters.map((character) => (
							<article
								key={character.id}
								className="border-separator-secondary/60 flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
							>
								<div className="flex min-w-0 flex-1 items-center gap-3.5">
									<Avatar
										size="lg"
										shape="arch"
										className="bg-md-primary-container"
									>
										<AvatarFallback className="text-md-on-primary-container font-sans text-title-medium-emph">
											{initialsOf(character.name)}
										</AvatarFallback>
									</Avatar>
									<div className="flex min-w-0 flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="text-foreground truncate font-sans text-title-medium-emph">
												{character.name}
											</h2>
											<Badge variant="soft" tone="accent" size="sm">
												<VenetianMask className="size-3" />
												{t("common.pc")}
											</Badge>
										</div>
										<div className="text-foreground-tertiary font-mono text-label-small">
											{character.ruleId} · v{character.version}
										</div>
										{character.background ? (
											<p className="text-foreground-secondary line-clamp-1 text-body-small">
												{character.background}
											</p>
										) : null}
									</div>
								</div>
								<div className="flex items-center gap-1.5 sm:shrink-0">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											void (async () => {
												try {
													const detail = await api<CharacterDetailDto>(
														`/pl/characters/${encodeURIComponent(character.id)}`,
													);
													setProfileCharacter(detail);
												} catch (error) {
													toast.error(
														errorText(error, "pl.characters.loadFailed"),
													);
												}
											})();
										}}
									>
										<Pencil className="size-3.5" />
										{t("common.edit")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title={t("common.delete")}
										aria-label={`${t("common.delete")} ${character.name}`}
										onClick={() => setDeleteTarget(character)}
									>
										<Trash2 />
									</Button>
								</div>
							</article>
						))}
					</div>
				</div>
			)}

			<CharacterEditor
				state={editor}
				onClose={() => setEditor({ open: false })}
				onSaved={() => void load()}
			/>

			{profileCharacter ? (
				<CharacterProfileEditorDialog
					scope="pl"
					open
					character={profileCharacter}
					onClose={() => setProfileCharacter(null)}
					onSaved={(next) => {
						setProfileCharacter(next);
						void load();
					}}
				/>
			) : null}

			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("pl.characters.deleteTitle")}</DialogTitle>
						<DialogDescription>{deleteTarget?.name ?? ""}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="dangerSoft"
							onClick={() => deleteTarget && void remove(deleteTarget)}
						>
							{t("common.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PlShell>
	);
}

function PlShell({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const username = useIdentityStore((state) => state.account?.username ?? null);

	return (
		<div className="bg-background flex min-h-dvh flex-col">
			<header className="border-separator-secondary bg-background sticky top-0 z-10 border-b">
				<div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
					<Link to="/pl/characters" className="flex items-center gap-3">
						<Logo className="size-8" />
						<span className="flex min-w-0 flex-col">
							<span className="text-foreground font-serif text-title-medium-emph">
								{t("app.name")}
							</span>
							<span className="text-foreground-tertiary text-label-small">
								{t("pl.workspace")}
							</span>
						</span>
					</Link>
					<div className="ml-auto flex items-center gap-2">
						{username ? (
							<span className="text-foreground-secondary hidden text-body-small sm:block">
								{username}
							</span>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t("account.logout")}
							onClick={() => {
								void logoutAccount().then(() => navigate({ to: "/login" }));
							}}
						>
							<LogOut />
						</Button>
					</div>
				</div>
			</header>
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
				{children}
			</main>
		</div>
	);
}

function CharacterEditor({
	state,
	onClose,
	onSaved,
}: {
	state: EditorState;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { rules, ruleId, setRuleId, loading: rulesLoading } = useRuleOptions();
	const [name, setName] = useState("");
	const [background, setBackground] = useState("");
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (!state.open) {
			return;
		}
		setName("");
		setBackground("");
	}, [state.open]);

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed || pending) {
			return;
		}
		setPending(true);
		try {
			await api("/pl/characters", {
				method: "POST",
				body: JSON.stringify({
					name: trimmed,
					background,
					ruleId,
					sheetData: getRuleComponent(ruleId).createEmptySheet(),
				}),
			});
			toast.success(t("pl.characters.saved"));
			onClose();
			onSaved();
		} catch (error) {
			toast.error(errorText(error, "pl.characters.saveFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open={state.open}
			onOpenChange={(open) => (open ? undefined : onClose())}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("pl.characters.create")}</DialogTitle>
					<DialogDescription>{t("pl.characters.hint")}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<FormField
						label={t("pl.characters.name")}
						htmlFor="pl-character-name"
					>
						<Input
							id="pl-character-name"
							value={name}
							maxLength={100}
							onChange={(event) => setName(event.target.value)}
						/>
					</FormField>
					<FormField
						label={t("pl.characters.background")}
						htmlFor="pl-character-bg"
					>
						<Textarea
							id="pl-character-bg"
							value={background}
							rows={4}
							onChange={(event) => setBackground(event.target.value)}
						/>
					</FormField>
					<FormField label={t("rules.label")}>
						<Select
							value={ruleId}
							onValueChange={setRuleId}
							disabled={rulesLoading}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("rules.loading")} />
							</SelectTrigger>
							<SelectContent>
								{rules.map((rule) => (
									<SelectItem key={rule.id} value={rule.id}>
										{rule.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="primary"
						disabled={pending || !name.trim()}
						onClick={() => void submit()}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
