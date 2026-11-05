import {
	type BuildInfo,
	buildsAligned,
	formatBuildTime,
	formatCommit,
	type VersionResponse,
} from "@cogm/shared";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { t } from "@/i18n";
import { clientBuildInfo } from "@/lib/build-info";
import { cn } from "@/lib/utils";
import { loadVersionResponse } from "@/lib/version-api";

type VersionBadgeProps = {
	client?: BuildInfo;
	className?: string;
	loadVersion?: () => Promise<VersionResponse>;
};

type ServerState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; server: BuildInfo }
	| { status: "error" };

function reportText(client: BuildInfo, server: BuildInfo | null): string {
	const lines = [
		t("version.report.clientVersion", { value: client.version }),
		t("version.report.clientCommit", { value: formatCommit(client.commit) }),
		t("version.report.clientBuildTime", {
			value: formatBuildTime(client.buildTime),
		}),
	];
	if (server) {
		lines.push(
			t("version.report.serverVersion", { value: server.version }),
			t("version.report.serverCommit", { value: formatCommit(server.commit) }),
			t("version.report.serverBuildTime", {
				value: formatBuildTime(server.buildTime),
			}),
		);
	} else {
		lines.push(t("version.report.serverUnknown"));
	}
	return lines.join("\n");
}

function BuildDetails({ label, info }: { label: string; info: BuildInfo }) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<span className="text-foreground-secondary text-label-large-emph">
					{label}
				</span>
				<Badge variant="soft" tone="default" size="lg">
					{info.version}
				</Badge>
			</div>
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
				<dt className="text-foreground-tertiary text-label-small">
					{t("version.commit")}
				</dt>
				<dd className="text-foreground-secondary font-mono text-label-small">
					{formatCommit(info.commit)}
				</dd>
				<dt className="text-foreground-tertiary text-label-small">
					{t("version.buildTime")}
				</dt>
				<dd className="text-foreground-secondary font-mono text-label-small">
					{formatBuildTime(info.buildTime)}
				</dd>
			</dl>
		</section>
	);
}

export function VersionBadge({
	client = clientBuildInfo,
	className,
	loadVersion = loadVersionResponse,
}: VersionBadgeProps) {
	const [open, setOpen] = useState(false);
	const [serverState, setServerState] = useState<ServerState>({
		status: "idle",
	});

	const refresh = useCallback(async () => {
		setServerState({ status: "loading" });
		try {
			const response = await loadVersion();
			setServerState({ status: "ready", server: response.server });
		} catch {
			setServerState({ status: "error" });
		}
	}, [loadVersion]);

	useEffect(() => {
		if (open) {
			void refresh();
		}
	}, [open, refresh]);

	const server = serverState.status === "ready" ? serverState.server : null;
	const aligned = server ? buildsAligned(client, server) : true;

	async function copyAll(): Promise<void> {
		try {
			await navigator.clipboard.writeText(reportText(client, server));
			toast.success(t("version.copied"));
		} catch {
			toast.error(t("version.copyFailed"));
		}
	}

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="xs"
				className={cn(
					"text-foreground-tertiary font-mono text-label-small",
					className,
				)}
				onClick={() => setOpen(true)}
			>
				{t("version.trigger", { version: client.version })}
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("version.title")}</DialogTitle>
						<DialogDescription>{t("version.description")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{server && !aligned ? (
							<Badge variant="soft" tone="warning" size="lg">
								{t("version.mismatch")}
							</Badge>
						) : null}
						<BuildDetails label={t("version.client")} info={client} />
						{server ? (
							<BuildDetails label={t("version.server")} info={server} />
						) : (
							<section className="flex flex-col gap-3">
								<div className="flex items-center justify-between gap-3">
									<span className="text-foreground-secondary text-label-large-emph">
										{t("version.server")}
									</span>
									<Badge variant="soft" tone="warning" size="lg">
										{t("version.serverUnknown")}
									</Badge>
								</div>
								{serverState.status === "loading" ? (
									<p className="text-foreground-tertiary text-body-small">
										{t("common.loading")}
									</p>
								) : (
									<Button
										type="button"
										variant="tertiary"
										size="sm"
										onClick={() => void refresh()}
									>
										{t("common.retry")}
									</Button>
								)}
							</section>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							disabled={serverState.status === "loading"}
							onClick={() => void copyAll()}
						>
							{t("version.copyAll")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
