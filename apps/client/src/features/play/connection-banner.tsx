import { t } from "@/i18n";
import { usePlayStore } from "@/stores/play-store";

function ConnectionBanner() {
	const connected = usePlayStore((state) => state.connected);
	const terminal = usePlayStore((state) => state.terminal);
	const status = usePlayStore((state) => state.status);
	const sessionId = usePlayStore((state) => state.sessionId);
	if (connected || terminal || status === "ended") {
		return null;
	}
	return (
		<div className="bg-md-warning-container text-md-on-warning-container absolute inset-x-0 top-0 z-30 px-3 py-1.5 text-center text-label-medium">
			{sessionId ? t("play.reconnecting") : t("play.connecting")}
		</div>
	);
}

export { ConnectionBanner };
