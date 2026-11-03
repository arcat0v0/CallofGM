import type { SessionSettings } from "@cogm/shared";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";

function GmSessionSettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const settings = usePlayStore((state) => state.settings);

	function update(patch: Partial<SessionSettings>) {
		sendSessionCommand("session:settings", { ...settings, ...patch });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("gm.console.settingsTitle")}</DialogTitle>
					<DialogDescription>
						{t("gm.workbench.settingsDescription")}
					</DialogDescription>
				</DialogHeader>
				<div className="bg-md-surface-container flex items-center justify-between gap-3 rounded-lg px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="text-foreground text-label-large">
							{t("gm.console.sharePcSheets")}
						</span>
						<span className="text-md-on-surface-variant text-label-small">
							{t("gm.console.sharePcSheetsDescription")}
						</span>
					</div>
					<Switch
						aria-label={t("gm.console.sharePcSheets")}
						checked={settings.sharePcSheets}
						onCheckedChange={(checked) =>
							update({ sharePcSheets: Boolean(checked) })
						}
					/>
				</div>
				<div className="bg-md-surface-container flex items-center justify-between gap-3 rounded-lg px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="text-foreground text-label-large">
							{t("gm.console.obSeePcState")}
						</span>
						<span className="text-md-on-surface-variant text-label-small">
							{t("gm.console.obSeePcStateDescription")}
						</span>
					</div>
					<Switch
						aria-label={t("gm.console.obSeePcState")}
						checked={settings.obSeePcState}
						onCheckedChange={(checked) =>
							update({ obSeePcState: Boolean(checked) })
						}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export { GmSessionSettingsDialog };
