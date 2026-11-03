import { useNavigate } from "@tanstack/react-router";
import { ShieldX, UserRoundMinus, UserRoundX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { type ConnectionTerminal, usePlayStore } from "@/stores/play-store";

const TERMINAL_COPY: Record<
	ConnectionTerminal,
	{ title: string; description: string }
> = {
	kicked: {
		title: "play.kickedTitle",
		description: "play.kickedDescription",
	},
	unavailable: {
		title: "play.unavailableTitle",
		description: "play.unavailableDescription",
	},
	replaced: {
		title: "play.replacedTitle",
		description: "play.replacedDescription",
	},
	released: {
		title: "play.releasedTitle",
		description: "play.releasedDescription",
	},
};

function SessionTerminalOverlay({
	sessionId,
	onRetry,
}: {
	sessionId: string;
	onRetry: () => void;
}) {
	const terminal = usePlayStore((state) => state.terminal);
	const kickedReason = usePlayStore((state) => state.kickedReason);
	const navigate = useNavigate();

	if (!terminal) {
		return null;
	}
	const copy = TERMINAL_COPY[terminal];

	const icon =
		terminal === "kicked" ? (
			<ShieldX className="size-6" />
		) : terminal === "replaced" ? (
			<UserRoundX className="size-6" />
		) : terminal === "released" ? (
			<UserRoundMinus className="size-6" />
		) : (
			<WifiOff className="size-6" />
		);

	return (
		<div className="bg-background/90 absolute inset-0 z-[10000] flex flex-col items-center justify-center gap-5 backdrop-blur-sm">
			<div
				className={
					terminal === "kicked"
						? "bg-md-error-container text-md-on-error-container flex size-14 items-center justify-center rounded-full"
						: "bg-md-warning-container text-md-on-warning-container flex size-14 items-center justify-center rounded-full"
				}
			>
				{icon}
			</div>
			<div className="flex flex-col items-center gap-1.5">
				<h1 className="text-foreground font-serif text-headline-small-emph">
					{t(copy.title)}
				</h1>
				<p className="text-foreground-secondary max-w-72 text-center text-body-medium">
					{t(copy.description)}
				</p>
				{terminal === "kicked" && kickedReason ? (
					<p className="text-danger-soft-foreground max-w-72 text-center text-body-small">
						{t("play.kickedReason", { reason: kickedReason })}
					</p>
				) : null}
			</div>
			<div className="flex items-center gap-2.5">
				<Button
					type="button"
					variant="outline"
					onClick={() =>
						void navigate({ to: "/join/$sessionId", params: { sessionId } })
					}
				>
					{t("play.returnEntry")}
				</Button>
				{terminal === "replaced" || terminal === "released" ? null : (
					<Button type="button" variant="primary" onClick={onRetry}>
						{terminal === "kicked" ? t("play.reenter") : t("play.retryConnect")}
					</Button>
				)}
			</div>
		</div>
	);
}

export { SessionTerminalOverlay };
