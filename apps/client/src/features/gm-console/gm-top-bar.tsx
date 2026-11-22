import type { SessionDto, SessionStatus } from "@cogm/shared";
import { Link, useParams } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Ellipsis,
	Link as LinkIcon,
	Settings2,
	SquarePower,
	UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteLinksDialog } from "@/features/gm-admin/invite-links-dialog";
import { VersionBadge } from "@/features/version/version-badge";
import { t } from "@/i18n";
import { sessionStatusLabel } from "@/i18n/labels";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { nextSessionStatus, nextStatusActionLabel } from "@/lib/format";
import { usePlayStore } from "@/stores/play-store";
import { GmOnlinePopover } from "./gm-online-popover";
import { GmSessionSettingsDialog } from "./gm-session-settings-dialog";
import { GmSessionStatusControl } from "./gm-session-status-control";
import { PlayerStagePreview } from "./player-stage-preview";
import { StageLayoutControl } from "./stage-layout-control";

function GmTopBar() {
	const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
	const status = usePlayStore((state) => state.status);
	const setStatus = usePlayStore((state) => state.setStatus);
	const moduleName = usePlayStore((state) => state.moduleName);
	const sessionName = usePlayStore((state) => state.sessionName);
	const ruleId = usePlayStore((state) => state.ruleId);
	const scene = usePlayStore((state) => state.scene);
	const presenceAvailable = usePlayStore((state) => state.presenceAvailable);
	const [endOpen, setEndOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [invitesOpen, setInvitesOpen] = useState(false);
	const [statusPending, setStatusPending] = useState(false);
	const nextStatus = status ? nextSessionStatus(status) : null;
	const title =
		moduleName ?? sessionName ?? scene?.name ?? t("gm.workbench.unnamedSession");
	const subtitleBase =
		sessionName && sessionName !== moduleName
			? `${sessionName} · ${t("gm.workbench.role")}`
			: t("gm.workbench.role");
	const subtitle =
		status === "ended"
			? `${subtitleBase} · ${t("gm.workbench.endedLock")}`
			: subtitleBase;

	async function postStatus(next: SessionStatus) {
		const updated = await api<SessionDto>(
			`/gm/sessions/${encodeURIComponent(sessionId)}/status`,
			{
				method: "POST",
				body: JSON.stringify({ status: next }),
			},
		);
		setStatus(updated.status);
		return updated.status;
	}

	async function patchStatus(next: SessionStatus) {
		if (statusPending || !status || next === status) {
			return;
		}
		setStatusPending(true);
		try {
			// Backend enforces sequential transitions (waiting -> preparing -> active -> ended).
			const finalStatus =
				status === "waiting" && next === "active"
					? (await postStatus("preparing"), await postStatus("active"))
					: await postStatus(next);
			toast.success(
				t("gm.workbench.statusActionSuccess", {
					status: sessionStatusLabel(finalStatus),
				}),
			);
		} catch (error) {
			toast.error(errorText(error, "play.statusUpdateFailed"));
		} finally {
			setStatusPending(false);
		}
	}

	function copyLink() {
		void navigator.clipboard
			.writeText(`${location.origin}/join/${encodeURIComponent(sessionId)}`)
			.then(
				() => toast.success(t("play.copied")),
				() => toast.error(t("play.copyFailed")),
			);
	}

	return (
		<div className="flex h-16 items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-4 xl:max-w-[calc(50%-15.5rem)]">
				<Button
					asChild
					variant="tertiary"
					size="icon-sm"
					className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-11 shrink-0"
				>
					<Link to="/gm" aria-label={t("play.backstage")}>
						<ArrowLeft />
					</Link>
				</Button>
				<div className="flex min-w-0 flex-col">
					<span className="text-md-on-surface truncate font-sans text-headline-small font-semibold">
						{title}
					</span>
					<span className="text-md-on-surface-variant truncate text-label-medium">
						{subtitle}
					</span>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2 2xl:gap-3">
				<VersionBadge className="text-foreground-secondary" />
				<GmSessionStatusControl
					status={status}
					pending={statusPending}
					onSelectStatus={(next) => void patchStatus(next)}
					onRequestEnd={() => setEndOpen(true)}
				/>
				<PlayerStagePreview />
				<StageLayoutControl />
				{presenceAvailable ? <GmOnlinePopover /> : null}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="tertiary"
							size="icon-sm"
							aria-label={t("gm.workbench.moreActions")}
							className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-10"
						>
							<Ellipsis />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						{status && nextStatus && nextStatus !== "ended" ? (
							<DropdownMenuItem
								disabled={statusPending}
								onSelect={() => void patchStatus(nextStatus)}
							>
								<ArrowRight />
								{nextStatusActionLabel(status) ?? t("play.advance")}
							</DropdownMenuItem>
						) : null}
						{status !== "ended" ? (
							<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
								<Settings2 />
								{t("gm.workbench.settings")}
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onSelect={copyLink}>
							<LinkIcon />
							{t("play.copyLink")}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setInvitesOpen(true)}>
							<UserPlus />
							{t("gm.invites.open")}
						</DropdownMenuItem>
						{status === "active" ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => setEndOpen(true)}
								>
									<SquarePower />
									{t("play.endSession")}
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
				<span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-full text-label-small-emph">
					{t("common.gmShort")}
				</span>
			</div>

			<ConfirmDialog
				open={endOpen}
				onOpenChange={setEndOpen}
				icon={SquarePower}
				title={t("gm.console.endConfirmTitle")}
				description={t("gm.console.endConfirmDescription")}
				confirmLabel={t("gm.console.endConfirmAction")}
				variant="danger"
				onConfirm={() => {
					setEndOpen(false);
					void patchStatus("ended");
				}}
			/>
			<GmSessionSettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
			<InviteLinksDialog
				open={invitesOpen}
				onOpenChange={setInvitesOpen}
				scope="session"
				targetId={sessionId}
				targetName={title}
				ruleId={ruleId}
			/>
		</div>
	);
}

export { GmTopBar };
