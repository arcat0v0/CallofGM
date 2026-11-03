import type { BlacklistEntryDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	Copy,
	ScanLine,
	Search,
	ShieldBan,
	ShieldOff,
	ShieldX,
	Timer,
	UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricStrip } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { t, useI18nVersion } from "@/i18n";
import { api, unwrapItems } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/blacklist")({
	beforeLoad: requireGmAuth,
	component: BlacklistPage,
});

type DurationTone = "warning" | "danger" | "default";

type BlacklistEntry = {
	fingerprintHash: string;
	playerId: string | null;
	displayName: string | null;
	fingerprint: string;
	note: string;
	duration: string;
	durationTone: DurationTone;
	remaining: string;
	remainingMuted?: boolean;
	bannedAt: string;
	active: boolean;
	permanent: boolean;
};

function formatStamp(epochMs: number): string {
	const date = new Date(epochMs);
	return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortHash(hash: string): string {
	return hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function mapEntry(row: BlacklistEntryDto, now: number): BlacklistEntry {
	const active = row.expiresAt === null || row.expiresAt > now;
	let duration = t("gm.blacklist.permanentLabel");
	let durationTone: DurationTone = "danger";
	let remaining = "—";
	if (row.expiresAt !== null) {
		durationTone = "warning";
		const ms = row.expiresAt - row.createdAt;
		const hours = Math.round(ms / 3600_000);
		duration =
			hours >= 24
				? t("gm.blacklist.days", { count: Math.round(hours / 24) })
				: t("gm.blacklist.hours", { count: Math.max(1, hours) });
		if (!active) {
			remaining = t("gm.blacklist.unbanned");
		} else {
			const left = row.expiresAt - now;
			const leftHours = Math.max(1, Math.round(left / 3600_000));
			remaining =
				leftHours >= 24
					? t("gm.blacklist.remainingDays", {
							count: Math.round(leftHours / 24),
						})
					: t("gm.blacklist.remainingHours", { count: leftHours });
		}
	}
	return {
		fingerprintHash: row.fingerprintHash,
		playerId: row.playerId,
		displayName: row.displayName,
		fingerprint: shortHash(row.fingerprintHash),
		note: row.reason || "—",
		duration,
		durationTone: active ? durationTone : "default",
		remaining: active ? remaining : t("gm.blacklist.unbanned"),
		remainingMuted: !active,
		bannedAt: formatStamp(row.createdAt),
		active,
		permanent: row.expiresAt === null,
	};
}

async function copyText(value: string, label: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(t("common.copied", { label }));
	} catch {
		toast.error(t("common.copyFailed"));
	}
}

function BlacklistPage() {
	useI18nVersion();
	const [banContext, setBanContext] = useState<{
		playerId: string;
		fingerprintHash: string;
	} | null>(null);
	const [unbanTarget, setUnbanTarget] = useState<BlacklistEntry | null>(null);
	const [rows, setRows] = useState<BlacklistEntryDto[]>([]);
	const [query, setQuery] = useState("");

	async function reload() {
		try {
			const data = await api<unknown>("/gm/blacklist");
			setRows(unwrapItems<BlacklistEntryDto>(data));
		} catch (error) {
			toast.error(errorText(error, "gm.blacklist.loadFailed"));
		}
	}

	useEffect(() => {
		void reload();
	}, []);

	const entries = useMemo(() => {
		const now = Date.now();
		const mapped = rows.map((row) => mapEntry(row, now));
		const q = query.trim();
		if (!q) {
			return mapped;
		}
		return mapped.filter(
			(entry) =>
				entry.fingerprint.includes(q) ||
				entry.note.includes(q) ||
				entry.fingerprintHash.includes(q) ||
				entry.playerId?.includes(q) ||
				entry.displayName?.includes(q),
		);
	}, [rows, query]);

	const activeCount = entries.filter((entry) => entry.active).length;
	const permanentCount = entries.filter(
		(entry) => entry.active && entry.permanent,
	).length;

	return (
		<AdminLayout>
			<div className="flex h-full flex-col gap-5">
				<PageHeader
					title={t("gm.blacklist.title")}
					description={t("gm.blacklist.description")}
					actions={
						<>
							<InputGroup className="h-12 w-64">
								<InputGroupAddon>
									<Search />
								</InputGroupAddon>
								<InputGroupInput
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={t("gm.blacklist.searchPlaceholder")}
									aria-label={t("gm.blacklist.searchAria")}
									className="text-label-large"
								/>
							</InputGroup>
							<Button
								variant="dangerSoft"
								className="h-12 px-6"
								onClick={() =>
									setBanContext({ playerId: "", fingerprintHash: "" })
								}
							>
								<UserX />
								{t("gm.blacklist.manualBan")}
							</Button>
						</>
					}
				/>

				<MetricStrip
					columns={3}
					className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-standard-default-spatial"
					items={[
						{
							icon: ShieldBan,
							value: String(activeCount),
							label: t("gm.blacklist.active"),
							emphasis: true,
						},
						{
							icon: ShieldX,
							value: String(permanentCount),
							label: t("gm.blacklist.permanent"),
						},
						{
							icon: Timer,
							value: String(rows.length),
							label: t("gm.blacklist.all"),
						},
					]}
				/>

				{rows.length === 0 ? (
					<div className="bg-md-surface-container border-md-outline-variant/50 animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center justify-center gap-3 rounded-xl-inc border px-6 py-16 text-center delay-75 duration-500 ease-standard-default-spatial">
						<span className="bg-accent-soft text-accent-soft-foreground grid size-12 place-items-center rounded-full">
							<ShieldBan className="size-6" />
						</span>
						<p className="text-md-on-surface text-title-medium-emph">
							{t("gm.blacklist.emptyTitle")}
						</p>
						<p className="text-md-on-surface-variant max-w-sm text-label-medium">
							{t("gm.blacklist.emptyDescription")}
						</p>
						<p className="text-md-on-surface-variant/75 text-label-small">
							{t("gm.blacklist.emptyHint")}
						</p>
					</div>
				) : entries.length === 0 ? (
					<div className="bg-md-surface-container border-md-outline-variant/50 animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center justify-center gap-3 rounded-xl-inc border px-6 py-16 text-center delay-75 duration-500 ease-standard-default-spatial">
						<span className="bg-default text-md-on-surface-variant grid size-12 place-items-center rounded-full">
							<Search className="size-6" />
						</span>
						<p className="text-md-on-surface text-title-medium-emph">
							{t("gm.blacklist.noMatchTitle")}
						</p>
						<p className="text-md-on-surface-variant max-w-sm text-label-medium">
							{t("gm.blacklist.noMatchDescription")}
						</p>
						<Button
							variant="tertiary"
							className="mt-1 h-10 px-4"
							onClick={() => setQuery("")}
						>
							{t("gm.blacklist.clearSearch")}
						</Button>
					</div>
				) : (
					<div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container delay-75 duration-500 ease-standard-default-spatial">
						<Table className="table-fixed">
							<TableHeader>
								<TableRow>
									<TableHead className="w-52">
										{t("gm.blacklist.player")}
									</TableHead>
									<TableHead className="w-58">
										{t("gm.blacklist.fingerprint")}
									</TableHead>
									<TableHead>{t("gm.blacklist.note")}</TableHead>
									<TableHead className="w-30">
										{t("gm.blacklist.duration")}
									</TableHead>
									<TableHead className="w-32">
										{t("gm.blacklist.remaining")}
									</TableHead>
									<TableHead className="w-30">
										{t("gm.blacklist.bannedAt")}
									</TableHead>
									<TableHead className="w-28">
										{t("gm.blacklist.actions")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{entries.map((entry) => (
									<TableRow key={entry.fingerprintHash}>
										<TableCell>
											<div className="flex min-w-0 flex-col">
												<span className="text-foreground truncate text-label-large">
													{entry.displayName ?? t("gm.blacklist.unknownPlayer")}
												</span>
												<span className="text-foreground-tertiary flex items-center gap-1 font-mono text-body-small">
													<span className="truncate">
														{entry.playerId
															? `${entry.playerId.slice(0, 8)}…`
															: t("gm.blacklist.noPlayerId")}
													</span>
													{entry.playerId ? (
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															className="size-6 shrink-0 text-foreground-tertiary"
															aria-label={t("gm.blacklist.copyPlayerId")}
															onClick={() =>
																void copyText(
																	entry.playerId!,
																	t("gm.blacklist.playerId"),
																)
															}
														>
															<Copy className="size-3" />
														</Button>
													) : null}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<span className="bg-default flex size-[26px] items-center justify-center rounded-sm">
													<ScanLine className="text-foreground-secondary size-3.5" />
												</span>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="text-foreground min-w-0 flex-1 truncate font-mono text-body-small">
															{entry.fingerprintHash}
														</span>
													</TooltipTrigger>
													<TooltipContent className="max-w-[320px] break-all font-mono">
														{entry.fingerprintHash}
													</TooltipContent>
												</Tooltip>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="size-6 shrink-0 text-foreground-tertiary"
													aria-label={t("gm.blacklist.copyFingerprint")}
													onClick={() =>
														void copyText(
															entry.fingerprintHash,
															t("gm.ban.fingerprintHash"),
														)
													}
												>
													<Copy className="size-3" />
												</Button>
											</div>
										</TableCell>
										<TableCell className="text-foreground-secondary truncate text-body-medium">
											{entry.note}
										</TableCell>
										<TableCell>
											<Badge
												variant="soft"
												tone={entry.durationTone}
												size="sm"
												className="font-sans"
											>
												{entry.duration}
											</Badge>
										</TableCell>
										<TableCell
											className={cn(
												"text-body-small",
												entry.remainingMuted
													? "text-foreground-tertiary"
													: "text-foreground",
											)}
										>
											{entry.remaining}
										</TableCell>
										<TableCell className="text-foreground-tertiary font-mono text-body-small">
											{entry.bannedAt}
										</TableCell>
										<TableCell>
											{entry.active ? (
												<Button
													variant="tertiary"
													size="sm"
													className="h-7 px-3"
													onClick={() => setUnbanTarget(entry)}
												>
													{t("gm.blacklist.unban")}
												</Button>
											) : (
												<Button
													variant="tertiary"
													size="sm"
													className="h-7 px-3"
													onClick={() =>
														setBanContext({
															playerId: entry.playerId ?? "",
															fingerprintHash: entry.playerId
																? ""
																: entry.fingerprintHash,
														})
													}
												>
													{t("gm.blacklist.reban")}
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			<BanPlayerDialog
				open={banContext !== null}
				onOpenChange={(open) => {
					if (!open) {
						setBanContext(null);
					}
				}}
				playerName={
					banContext?.fingerprintHash
						? t("gm.blacklist.unbannedRecord")
						: undefined
				}
				defaultFingerprintHash={banContext?.fingerprintHash ?? ""}
				onBan={async (input) => {
					try {
						await api("/gm/blacklist", {
							method: "POST",
							body: JSON.stringify({
								...(input.fingerprintHash
									? { fingerprintHash: input.fingerprintHash }
									: {}),
								reason: input.reason,
								...(input.durationSeconds
									? { durationSeconds: input.durationSeconds }
									: {}),
							}),
						});
						await reload();
					} catch (error) {
						toast.error(errorText(error, "gm.blacklist.banFailed"));
						throw error;
					}
				}}
			/>
			<ConfirmDialog
				open={unbanTarget !== null}
				onOpenChange={(open) => !open && setUnbanTarget(null)}
				icon={ShieldOff}
				title={t("gm.blacklist.unbanTitle")}
				description={t("gm.blacklist.unbanDescription", {
					fingerprint: unbanTarget?.fingerprint ?? "",
				})}
				confirmLabel={t("gm.blacklist.unbanConfirm")}
				confirmIcon={ShieldOff}
				variant="warning"
				onConfirm={() => {
					const target = unbanTarget;
					setUnbanTarget(null);
					if (!target) {
						return;
					}
					void api("/gm/blacklist/unban", {
						method: "POST",
						body: JSON.stringify({ fingerprintHash: target.fingerprintHash }),
					})
						.then(() => reload())
						.catch((error) =>
							toast.error(errorText(error, "gm.blacklist.unbanFailed")),
						);
				}}
			/>
		</AdminLayout>
	);
}
