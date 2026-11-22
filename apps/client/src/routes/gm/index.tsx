import type {
	CharacterDto,
	ModuleDto,
	ModuleSummaryDto,
	SessionDto,
	SessionStatus,
} from "@cogm/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Ellipsis,
	FileSpreadsheet,
	Link as LinkIcon,
	Package,
	Pencil,
	Play,
	Plus,
	SquarePower,
	Users,
	VenetianMask,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricStrip } from "@/components/shared/metric-card";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AdminLedger,
	AdminWorkbench,
	AdminWorkbenchHeader,
} from "@/features/gm-admin/admin-workbench";
import { CreateSessionDialog } from "@/features/gm-admin/dialogs/create-session-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { t, useI18nVersion } from "@/i18n";
import { sessionPhaseLabel, sessionStatusLabel } from "@/i18n/labels";
import { api, fetchAllPages, isApiError, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatClock, formatStamp, statusTone } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/")({
	beforeLoad: requireGmAuth,
	component: GmDashboardPage,
});

function GmDashboardPage() {
	useI18nVersion();
	const [createOpen, setCreateOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [sessions, setSessions] = useState<SessionDto[]>([]);
	const [modules, setModules] = useState<ModuleDto[]>([]);
	const [summaries, setSummaries] = useState<ModuleSummaryDto[]>([]);
	const [characterCount, setCharacterCount] = useState(0);
	const [endTarget, setEndTarget] = useState<SessionDto | null>(null);
	const [renameTarget, setRenameTarget] = useState<SessionDto | null>(null);
	const [renameName, setRenameName] = useState("");

	async function reload() {
		try {
			const [nextSessions, nextModules, nextCharacters, nextSummaries] =
				await Promise.all([
					fetchAllPages<SessionDto>("/gm/sessions"),
					fetchAllPages<ModuleDto>("/gm/modules"),
					fetchAllPages<CharacterDto>("/gm/characters"),
					api<ModuleSummaryDto[]>("/gm/modules/summaries"),
				]);
			setSessions(nextSessions);
			setModules(nextModules);
			setCharacterCount(nextCharacters.length);
			setSummaries(nextSummaries);
		} catch (error) {
			toast.error(errorText(error, "gm.dashboard.loadFailed"));
		}
	}

	useEffect(() => {
		void reload();
	}, []);

	const moduleName = (id: string) =>
		modules.find((module) => module.id === id)?.name ?? id;
	const sessionTitle = (session: SessionDto) =>
		session.name ??
		`${moduleName(session.moduleId)} · ${formatClock(session.createdAt)}`;
	const summaryFor = (id: string) =>
		summaries.find((summary) => summary.moduleId === id);
	const liveCount = sessions.filter(
		(session) => session.status === "active",
	).length;

	async function renameSession(sessionId: string) {
		try {
			await api(`/gm/sessions/${encodeURIComponent(sessionId)}/name`, {
				method: "POST",
				body: JSON.stringify({ name: renameName.trim() || null }),
			});
			setRenameTarget(null);
			toast.success(t("gm.dashboard.renamed"));
			await reload();
		} catch (error) {
			toast.error(
				isApiError(error) ? error.message : t("gm.dashboard.renameFailed"),
			);
		}
	}

	async function patchStatus(sessionId: string, status: SessionStatus) {
		try {
			await api(`/gm/sessions/${encodeURIComponent(sessionId)}/status`, {
				method: "POST",
				body: JSON.stringify({ status }),
			});
			await reload();
		} catch (error) {
			toast.error(errorText(error, "gm.dashboard.statusUpdateFailed"));
		}
	}

	return (
		<AdminWorkbench>
			<div className="flex flex-col gap-3 xl:gap-4">
				<AdminWorkbenchHeader
					title={t("gm.dashboard.title")}
					description={t("gm.dashboard.description")}
					actions={
						<>
							<Button
								variant="text"
								size="sm"
								onClick={() => setImportOpen(true)}
							>
								<FileSpreadsheet />
								{t("gm.dashboard.importExcel")}
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={() => setCreateOpen(true)}
							>
								<Plus />
								{t("gm.dashboard.createSession")}
							</Button>
						</>
					}
				/>

				<MetricStrip
					items={[
						{
							icon: Play,
							value: String(liveCount),
							label: t("gm.dashboard.liveSessions"),
							emphasis: liveCount > 0,
						},
						{
							icon: Package,
							value: String(modules.length),
							label: t("gm.dashboard.modules"),
						},
						{
							icon: VenetianMask,
							value: String(characterCount),
							label: t("gm.dashboard.characters"),
						},
						{
							icon: Users,
							value: String(sessions.length),
							label: t("gm.dashboard.allSessions"),
						},
					]}
				/>

				<AdminLedger>
					<Table
						aria-label={t("gm.dashboard.title")}
						className="min-w-225 table-fixed"
					>
						<TableHeader>
							<TableRow>
								<TableHead>{t("gm.dashboard.sessionName")}</TableHead>
								<TableHead className="w-38">
									{t("gm.dashboard.module")}
								</TableHead>
								<TableHead className="w-24">
									{t("gm.dashboard.status")}
								</TableHead>
								<TableHead className="w-26">
									{t("gm.dashboard.phase")}
								</TableHead>
								<TableHead className="w-22">{t("gm.dashboard.code")}</TableHead>
								<TableHead className="w-28">
									{t("gm.dashboard.updated")}
								</TableHead>
								<TableHead className="w-60">
									{t("gm.dashboard.actions")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sessions.map((session) => (
								<TableRow key={session.id}>
									<TableCell
										className="truncate text-title-small-emph text-md-on-surface"
										title={formatStamp(session.createdAt)}
									>
										{sessionTitle(session)}
									</TableCell>
									<TableCell className="truncate text-md-on-surface-variant">
										{moduleName(session.moduleId)}
									</TableCell>
									<TableCell>
										<Badge
											variant="soft"
											tone={statusTone(session.status)}
											size="sm"
										>
											{sessionStatusLabel(session.status)}
										</Badge>
									</TableCell>
									<TableCell>
										{session.phase ? (
											<Badge
												variant="soft"
												tone={session.status === "ended" ? "default" : "accent"}
												size="sm"
												className={
													session.status === "ended" ? "opacity-60" : undefined
												}
											>
												{sessionPhaseLabel(session.phase)}
											</Badge>
										) : (
											<span className="text-foreground-tertiary text-label-large">
												—
											</span>
										)}
									</TableCell>
									<TableCell
										className="font-mono text-label-small text-md-on-surface-variant"
										title={session.id}
									>
										#{session.id.slice(0, 6)}
									</TableCell>
									<TableCell className="text-body-small tabular-nums text-md-on-surface-variant">
										{formatStamp(session.createdAt)}
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap items-center gap-1.5">
											{session.status !== "ended" &&
											session.status !== "active" ? (
												<Button
													type="button"
													variant="tertiary"
													size="xs"
													onClick={() => {
														const next =
															session.status === "waiting"
																? "preparing"
																: "active";
														void patchStatus(session.id, next);
													}}
												>
													{session.status === "waiting"
														? t("gm.dashboard.startPreparing")
														: t("gm.dashboard.startActive")}
												</Button>
											) : null}
											<Button
												asChild
												type="button"
												variant={
													session.status === "active" ? "tonal" : "tertiary"
												}
												size="xs"
											>
												<Link
													to="/gm/session/$sessionId"
													params={{ sessionId: session.id }}
												>
													{session.status === "ended"
														? t("gm.dashboard.view")
														: t("gm.dashboard.enterConsole")}
												</Link>
											</Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														type="button"
														variant="ghost"
														size="xs"
														aria-label={t("gm.dashboard.moreActions", {
															id: session.id,
														})}
														className="size-8 px-0 text-md-on-surface-variant"
													>
														<Ellipsis />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => {
															setRenameTarget(session);
															setRenameName(session.name ?? "");
														}}
													>
														<Pencil />
														{t("gm.dashboard.rename")}
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => {
															void navigator.clipboard
																.writeText(
																	`${location.origin}/join/${encodeURIComponent(session.id)}`,
																)
																.then(
																	() => toast.success(t("play.copied")),
																	() => toast.error(t("play.copyFailed")),
																);
														}}
													>
														<LinkIcon />
														{t("gm.dashboard.copyLink")}
													</DropdownMenuItem>
													{session.status === "active" ? (
														<DropdownMenuItem
															variant="destructive"
															onClick={() => setEndTarget(session)}
														>
															<SquarePower />
															{t("gm.dashboard.endSession")}
														</DropdownMenuItem>
													) : null}
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</AdminLedger>

				<div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
					<h2 className="text-title-large-emph text-md-on-surface">
						{t("gm.dashboard.moduleResources")}
					</h2>
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="text-foreground-secondary"
					>
						<Link to="/gm/modules">
							{t("gm.dashboard.allModules")}
							<ArrowRight />
						</Link>
					</Button>
				</div>

				<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
					{modules.map((module) => (
						<article
							key={module.id}
							className="flex min-h-28 items-stretch overflow-hidden rounded-xl bg-md-surface-container-low"
						>
							<div className="relative my-1.5 ml-1.5 w-16 shrink-0 overflow-hidden rounded-lg-inc bg-md-surface-container-high sm:w-28">
								{(() => {
									const summary = summaryFor(module.id);
									const cover = summary?.coverAssetId
										? mediaUrl(summary.coverAssetId)
										: null;
									return cover ? (
										<img
											src={cover}
											alt={t("gm.dashboard.coverAlt", { name: module.name })}
											className="absolute inset-0 size-full object-cover object-[center_30%]"
										/>
									) : (
										<Package className="text-foreground-tertiary absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2" />
									);
								})()}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
								<div className="flex min-w-0 items-center justify-between gap-2">
									<span className="truncate text-title-medium-emph text-md-on-surface">
										{module.name}
									</span>
									<Button
										asChild
										type="button"
										variant="tertiary"
										size="sm"
										className="h-8 shrink-0 px-3"
									>
										<Link
											to="/gm/module/$moduleId"
											params={{ moduleId: module.id }}
										>
											{t("gm.dashboard.manage")}
										</Link>
									</Button>
								</div>
								{module.description ? (
									<p className="line-clamp-1 text-body-small text-md-on-surface-variant select-text">
										{module.description}
									</p>
								) : null}
								{summaryFor(module.id) ? (
									<span className="text-label-small text-md-on-surface-variant">
										{t("gm.dashboard.moduleStats", {
											scenes: summaryFor(module.id)!.sceneCount,
											handouts: summaryFor(module.id)!.handoutCount,
											tracks: summaryFor(module.id)!.trackCount,
											characters: summaryFor(module.id)!.characterCount,
										})}
									</span>
								) : null}
								<span className="mt-auto truncate text-label-small tabular-nums text-md-on-surface-variant">
									{summaryFor(module.id)
										? t("gm.dashboard.moduleUpdated", {
												time: new Date(
													summaryFor(module.id)!.updatedAt,
												).toLocaleString("zh-CN", {
													month: "2-digit",
													day: "2-digit",
													hour: "2-digit",
													minute: "2-digit",
												}),
											})
										: module.ruleId}
								</span>
							</div>
						</article>
					))}
				</div>
			</div>

			<CreateSessionDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={() => {
					void reload();
				}}
			/>
			<ImportCharacterSheetDialog
				open={importOpen}
				onOpenChange={setImportOpen}
			/>
			<Dialog
				open={renameTarget !== null}
				onOpenChange={(open) => {
					if (!open) setRenameTarget(null);
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t("gm.dashboard.renameTitle")}</DialogTitle>
						<DialogDescription>
							{t("gm.dashboard.renameDescription", {
								id: renameTarget?.id.slice(0, 8) ?? "",
							})}
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameName}
						onChange={(event) => setRenameName(event.target.value)}
						placeholder={t("gm.dashboard.renamePlaceholder")}
						maxLength={60}
						aria-label={t("gm.dashboard.sessionName")}
						autoFocus
					/>
					<DialogFooter>
						<Button
							variant="tertiary"
							size="sm"
							onClick={() => setRenameTarget(null)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={() => {
								const id = renameTarget?.id;
								if (id) void renameSession(id);
							}}
						>
							{t("common.save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<ConfirmDialog
				open={endTarget !== null}
				onOpenChange={(open) => {
					if (!open) setEndTarget(null);
				}}
				icon={SquarePower}
				confirmIcon={SquarePower}
				title={t("gm.dashboard.endTitle")}
				description={t("gm.dashboard.endDescription", {
					id: endTarget?.id.slice(0, 8) ?? "",
				})}
				confirmLabel={t("gm.dashboard.endConfirm")}
				onConfirm={() => {
					const id = endTarget?.id;
					setEndTarget(null);
					if (id) {
						void patchStatus(id, "ended");
					}
				}}
			/>
		</AdminWorkbench>
	);
}
