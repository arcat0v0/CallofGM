import type { SessionDto, SessionStatus } from "@cogm/shared";
import {
	defaultParseSearch,
	Link,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Ellipsis,
	Link as LinkIcon,
	Settings2,
	SquarePower,
	UserPlus,
} from "lucide-react";
import { type RefObject, useState } from "react";
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
import { GM_BACK_PREFIXES, resolveBackTarget } from "@/lib/back-navigation";
import { errorText } from "@/lib/errors";
import { nextSessionStatus, nextStatusActionLabel } from "@/lib/format";
import { usePlayStore } from "@/stores/play-store";
import { GmOnlinePopover } from "./gm-online-popover";
import { GmSessionSettingsDialog } from "./gm-session-settings-dialog";
import { GmSessionStatusControl } from "./gm-session-status-control";
import { StageStudio } from "./stage-studio";

function GmTopBar({
	liveStageRef,
}: {
	liveStageRef?: RefObject<HTMLDivElement | null>;
}) {
	const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
	const searchStr = useRouterState({
		select: (state) => state.location.searchStr ?? "",
	});
	const searchFrom = (defaultParseSearch(searchStr) as { from?: unknown }).from;
	const backTarget = resolveBackTarget(
		{
			from: searchFrom,
			fallback: "/gm",
			allowedPrefixes: GM_BACK_PREFIXES,
			currentPathname: `/gm/session/${encodeURIComponent(sessionId)}`,
		},
		t,
	);
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
		moduleName ??
		sessionName ??
		scene?.name ??
		t("gm.workbench.unnamedSession");
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
		<div className="flex h-12 items-center justify-between gap-2 lg:h-16 lg:gap-4">
			<div
				data-topbar-start=""
				className="flex min-w-0 items-center gap-2 lg:gap-4"
				style={{ maxWidth: "var(--gm-topbar-start-max, none)" }}
			>
				<Button
					asChild
					variant="tertiary"
					size="icon-sm"
					className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-9 shrink-0 lg:size-11"
				>
					<Link
						to={backTarget.to as never}
						search={backTarget.search as never}
						hash={backTarget.hash}
						aria-label={
							backTarget.to === "/gm"
								? t("play.backstage")
								: t("nav.back.aria", { target: backTarget.label })
						}
					>
						<ArrowLeft />
					</Link>
				</Button>
				<div className="flex min-w-0 flex-col">
					<span className="text-md-on-surface truncate font-sans text-title-medium-emph font-semibold lg:text-headline-small">
						{title}
					</span>
					<div className="flex min-w-0 items-center gap-1.5">
						<span className="text-md-on-surface-variant truncate text-label-small lg:text-label-medium">
							{subtitle}
						</span>
						<VersionBadge className="text-md-on-surface-variant/80 hover:text-md-on-surface hidden h-5 shrink-0 px-1.5 md:inline-flex" />
					</div>
				</div>
			</div>

			<div
				data-topbar-end=""
				className="flex shrink-0 items-center gap-1.5 sm:gap-2 2xl:gap-3"
			>
				<GmSessionStatusControl
					status={status}
					pending={statusPending}
					onSelectStatus={(next) => void patchStatus(next)}
					onRequestEnd={() => setEndOpen(true)}
				/>
				<StageStudio liveStageRef={liveStageRef} />
				{presenceAvailable ? <GmOnlinePopover /> : null}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="tertiary"
							size="icon-sm"
							aria-label={t("gm.workbench.moreActions")}
							className="bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant/50 size-9 lg:size-10"
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
