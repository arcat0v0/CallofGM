import type { ThemeSummaryDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Package,
	RefreshCw,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/features/admin/admin-shell";
import { t, useI18nVersion } from "@/i18n";
import { errorText } from "@/lib/errors";
import { requireAccount } from "@/lib/identity";
import {
	deleteTheme,
	listThemes,
	rescanThemes,
	uploadTheme,
} from "@/themes/themes-api";

export const Route = createFileRoute("/admin/themes")({
	beforeLoad: () => requireAccount(["admin"]),
	component: AdminThemesPage,
});

function AdminThemesPage() {
	useI18nVersion();
	const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const reload = useCallback(async (): Promise<void> => {
		setLoading(true);
		try {
			setThemes(await listThemes());
		} catch (error) {
			toast.error(errorText(error, "gm.themes.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function handleFile(file: File | undefined): Promise<void> {
		if (!file) {
			return;
		}
		setUploading(true);
		try {
			await uploadTheme(file);
			toast.success(t("gm.themes.installed"));
			await reload();
		} catch (error) {
			toast.error(errorText(error, "gm.themes.installFailed"));
		} finally {
			setUploading(false);
			if (inputRef.current) {
				inputRef.current.value = "";
			}
		}
	}

	async function handleRescan(): Promise<void> {
		try {
			setThemes(await rescanThemes());
			toast.success(t("gm.themes.rescanned"));
		} catch (error) {
			toast.error(errorText(error, "gm.themes.rescanFailed"));
		}
	}

	async function handleDelete(): Promise<void> {
		const id = deleteId;
		setDeleteId(null);
		if (!id) {
			return;
		}
		try {
			await deleteTheme(id);
			toast.success(t("gm.themes.deleted"));
			await reload();
		} catch (error) {
			toast.error(errorText(error, "gm.themes.deleteFailed"));
		}
	}

	const deleting = themes.find((theme) => theme.id === deleteId) ?? null;

	return (
		<AdminShell>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("gm.themes.title")}
					description={t("gm.themes.description")}
					actions={
						<>
							<input
								ref={inputRef}
								type="file"
								accept=".cogmtheme,.zip,application/zip"
								className="hidden"
								onChange={(event) => void handleFile(event.target.files?.[0])}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => void handleRescan()}
							>
								<RefreshCw /> {t("gm.themes.rescan")}
							</Button>
							<Button
								type="button"
								variant="primary"
								disabled={uploading}
								onClick={() => inputRef.current?.click()}
							>
								<Upload />{" "}
								{uploading ? t("gm.themes.installing") : t("gm.themes.install")}
							</Button>
						</>
					}
				/>

				{loading ? (
					<ListSkeleton rows={3} />
				) : themes.length === 0 ? (
					<EmptyState
						icon={Package}
						title={t("gm.themes.emptyTitle")}
						description={t("gm.themes.emptyDescription")}
						action={
							<div className="flex flex-col items-center gap-3">
								<Button
									type="button"
									variant="primary"
									disabled={uploading}
									onClick={() => inputRef.current?.click()}
								>
									<Upload />{" "}
									{uploading
										? t("gm.themes.installing")
										: t("gm.themes.install")}
								</Button>
								<p className="text-md-on-surface-variant flex items-center gap-1.5 text-label-small">
									<AlertTriangle className="text-warning size-3.5 shrink-0" />
									<span>{t("gm.themes.emptyWarning")}</span>
								</p>
							</div>
						}
					/>
				) : (
					<div className="flex flex-col gap-3">
						<span className="text-foreground-secondary text-label-large">
							{t("gm.themes.count", { count: themes.length })}
						</span>
						<div className="overflow-hidden rounded-2xl bg-md-surface-container">
							{themes.map((theme) => {
								const blocked = theme.usedByModules > 0 || theme.usedByGmUi;
								return (
									<article
										key={theme.id}
										className="border-separator-secondary/60 flex items-start gap-4 border-b p-4 last:border-b-0"
									>
										<div className="bg-md-surface-container-high flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
											{theme.previewUrl ? (
												<img
													src={theme.previewUrl}
													alt={theme.name}
													className="size-full object-cover"
												/>
											) : (
												<Package className="text-md-on-surface-variant size-6" />
											)}
										</div>

										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<div className="flex flex-wrap items-center gap-2">
												<h2 className="text-foreground truncate font-sans text-title-medium-emph">
													{theme.name}
												</h2>
												<Badge variant="soft" tone="default" size="sm">
													v{theme.version}
												</Badge>
												{theme.usedByGmUi ? (
													<Badge variant="soft" tone="accent" size="sm">
														{t("gm.themes.gmInUse")}
													</Badge>
												) : null}
											</div>
											<div className="text-foreground-tertiary truncate text-body-small">
												{theme.id}
												{theme.author ? ` · ${theme.author}` : ""}
											</div>
											{theme.description ? (
												<p className="text-foreground-secondary line-clamp-2 text-body-small">
													{theme.description}
												</p>
											) : null}
											<div className="text-foreground-tertiary flex flex-wrap items-center gap-x-3 gap-y-1 text-label-small">
												<span>
													{t("gm.themes.moduleUsage", {
														count: theme.usedByModules,
													})}
												</span>
												<span className="font-mono">
													{theme.digest.slice(0, 19)}…
												</span>
												{theme.repository ? (
													<a
														href={theme.repository}
														target="_blank"
														rel="noreferrer"
														className="text-foreground-link underline-offset-2 hover:underline"
													>
														{t("gm.themes.repository")}
													</a>
												) : null}
											</div>
										</div>

										<Button
											type="button"
											size="icon-sm"
											variant="ghost"
											aria-label={`${t("gm.themes.delete")} ${theme.name}`}
											title={
												blocked
													? t("gm.themes.deleteBlocked")
													: t("gm.themes.delete")
											}
											disabled={blocked}
											onClick={() => setDeleteId(theme.id)}
										>
											<Trash2 />
										</Button>
									</article>
								);
							})}
						</div>
					</div>
				)}
			</div>
			<ConfirmDialog
				open={deleteId !== null}
				onOpenChange={(open) => !open && setDeleteId(null)}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.themes.delete")}
				description={
					deleting
						? t("gm.themes.deleteDescription", { name: deleting.name })
						: ""
				}
				confirmLabel={t("gm.themes.deleteConfirm")}
				onConfirm={() => void handleDelete()}
			/>
		</AdminShell>
	);
}
