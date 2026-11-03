import type { ThemeSummaryDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Package,
	RefreshCw,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

	async function reload(): Promise<void> {
		setLoading(true);
		try {
			setThemes(await listThemes());
		} catch (error) {
			toast.error(errorText(error, "gm.themes.loadFailed"));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void reload();
	}, []);

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
			<div className="flex flex-col gap-5">
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
							{themes.length > 0 ? (
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
							) : null}
						</>
					}
				/>

				{loading ? (
					<p className="text-foreground-tertiary text-body-medium">
						{t("gm.themes.loading")}
					</p>
				) : themes.length === 0 ? (
					<div className="bg-md-surface-container border-md-outline-variant/50 animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-xl-inc border px-8 py-8 text-center duration-500 ease-standard-default-spatial">
						<span className="bg-accent-soft text-accent-soft-foreground grid size-14 place-items-center rounded-full">
							<Package className="size-7" />
						</span>
						<div className="flex max-w-lg flex-col gap-1.5">
							<h2 className="text-md-on-surface font-serif text-title-large-emph">
								{t("gm.themes.emptyTitle")}
							</h2>
							<p className="text-md-on-surface-variant text-body-medium">
								{t("gm.themes.emptyDescription")}
							</p>
						</div>
						<Button
							type="button"
							variant="primary"
							disabled={uploading}
							onClick={() => inputRef.current?.click()}
						>
							<Upload />{" "}
							{uploading ? t("gm.themes.installing") : t("gm.themes.install")}
						</Button>
						<p className="text-md-on-surface-variant/70 flex items-center gap-1.5 text-label-small">
							<AlertTriangle className="text-warning size-3.5 shrink-0" />
							<span>{t("gm.themes.emptyWarning")}</span>
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-4">
						{themes.map((theme) => (
							<Card
								key={theme.id}
								className="flex-row items-start gap-4 rounded-2xl p-4"
							>
								<div className="bg-md-surface-container-highest flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
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
										<span className="truncate font-serif text-title-medium-emph">
											{theme.name}
										</span>
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
									disabled={theme.usedByModules > 0 || theme.usedByGmUi}
									onClick={() => setDeleteId(theme.id)}
								>
									<Trash2 />
								</Button>
							</Card>
						))}
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
