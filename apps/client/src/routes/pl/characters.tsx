import type { CharacterDto } from "@cogm/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	FileSpreadsheet,
	LogOut,
	Pencil,
	Plus,
	Trash2,
	VenetianMask,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
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
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { initialsOf } from "@/lib/format";
import { logoutAccount, requireAccount } from "@/lib/identity";
import { FALLBACK_RULE_ID } from "@/rules/registry";
import { useIdentityStore } from "@/stores/identity-store";

export const Route = createFileRoute("/pl/characters")({
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharactersPage,
});

function PlCharactersPage() {
	useI18nVersion();
	const navigate = useNavigate();
	const [characters, setCharacters] = useState<CharacterDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [deleteTarget, setDeleteTarget] = useState<CharacterDto | null>(null);
	const [importTarget, setImportTarget] = useState<CharacterDto | null>(null);
	const [importOpen, setImportOpen] = useState(false);

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
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setImportTarget(null);
								setImportOpen(true);
							}}
						>
							<FileSpreadsheet />
							{t("pl.characters.importExcel")}
						</Button>
						<Button asChild variant="primary">
							<Link to="/pl/characters/new">
								<Plus />
								{t("pl.characters.create")}
							</Link>
						</Button>
					</div>
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
						<Button asChild variant="primary">
							<Link to="/pl/characters/new">
								<Plus />
								{t("pl.characters.create")}
							</Link>
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
								<Link
									to="/pl/characters/$characterId"
									params={{ characterId: character.id }}
									className="group flex min-w-0 flex-1 items-center gap-3.5 rounded-xl"
								>
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
											<h2 className="text-foreground group-hover:text-md-primary truncate font-sans text-title-medium-emph transition-colors">
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
								</Link>
								<div className="flex items-center gap-1.5 sm:shrink-0">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											void navigate({
												to: "/pl/characters/$characterId",
												params: { characterId: character.id },
											})
										}
									>
										<Pencil className="size-3.5" />
										{t("common.edit")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										title={t("pl.characters.updateFromExcel")}
										onClick={() => {
											setImportTarget(character);
											setImportOpen(true);
										}}
									>
										<FileSpreadsheet className="size-3.5" />
										{t("pl.characters.updateFromExcel")}
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

			<ImportCharacterSheetDialog
				open={importOpen}
				onOpenChange={(open) => {
					setImportOpen(open);
					if (!open) {
						setImportTarget(null);
					}
				}}
				ruleId={importTarget?.ruleId ?? FALLBACK_RULE_ID}
				scope="pl"
				updateCharacterId={importTarget?.id ?? null}
				expectedVersion={importTarget?.version}
				onImported={() => void load()}
			/>

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
