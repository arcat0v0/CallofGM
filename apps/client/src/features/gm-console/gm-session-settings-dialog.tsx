import {
	coc7e,
	SessionSettingsDefaults,
	type SessionSettings,
} from "@cogm/shared";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { DiceSkinSelector } from "@/features/dice-skin/dice-skin-selector";

function GmSessionSettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const settings = usePlayStore((state) => state.settings);
	const diceSkin = settings.diceSkin ?? SessionSettingsDefaults.diceSkin;
	const rules = coc7e.parseCoc7eSessionRules(settings.ruleSettings?.coc7e);

	function update(patch: Partial<SessionSettings>) {
		sendSessionCommand("session:settings", patch);
	}

	function updateRules(patch: Partial<coc7e.Coc7eSessionRules>) {
		update({
			ruleSettings: {
				...(settings.ruleSettings ?? {}),
				coc7e: { ...rules, ...patch },
			},
		});
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
				<div className="bg-md-surface-container flex flex-col gap-3 rounded-lg px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="text-foreground text-label-large">
							{t("gm.console.criticalVariant")}
						</span>
						<span className="text-md-on-surface-variant text-label-small">
							{t("gm.console.criticalVariantDescription")}
						</span>
					</div>
					<Select
						value={rules.criticalVariant}
						onValueChange={(value) =>
							updateRules({
								criticalVariant: coc7e.Coc7eCriticalVariant.parse(value),
							})
						}
					>
						<SelectTrigger aria-label={t("gm.console.criticalVariant")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{coc7e.Coc7eCriticalVariant.options.map((variant) => (
								<SelectItem key={variant} value={variant}>
									{coc7e.Coc7eCriticalVariantLabel[variant]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span className="text-md-on-surface-variant text-label-small">
						{coc7e.Coc7eCriticalVariantDescription[rules.criticalVariant]}
					</span>
				</div>
				<div className="bg-md-surface-container flex items-center justify-between gap-3 rounded-lg px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="text-foreground text-label-large">
							{t("gm.console.luckSpend")}
						</span>
						<span className="text-md-on-surface-variant text-label-small">
							{t("gm.console.luckSpendDescription")}
						</span>
					</div>
					<Switch
						aria-label={t("gm.console.luckSpend")}
						checked={rules.allowLuckSpend}
						onCheckedChange={(checked) =>
							updateRules({ allowLuckSpend: Boolean(checked) })
						}
					/>
				</div>
				<div className="bg-md-surface-container flex flex-col gap-3 rounded-lg px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="text-foreground text-label-large">
							{t("diceSkin.sessionLabel")}
						</span>
						<span className="text-md-on-surface-variant text-label-small">
							{t("diceSkin.sessionDescription")}
						</span>
					</div>
					<DiceSkinSelector
						value={diceSkin}
						onValueChange={(value) => update({ diceSkin: value })}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export { GmSessionSettingsDialog };
