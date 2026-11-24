import { RotateCcw, Save, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

interface SettingsActionBarProps {
	dirty: boolean;
	overridden: boolean;
	saving: boolean;
	scopeHint?: string;
	sticky?: boolean;
	onDiscard: () => void;
	onRequestReset: () => void;
}

export function SettingsActionBar({
	dirty,
	overridden,
	saving,
	scopeHint,
	sticky = false,
	onDiscard,
	onRequestReset,
}: SettingsActionBarProps) {
	return (
		<div
			data-slot="settings-action-bar"
			className={cn(
				"bg-md-surface-container-highest/95 shadow-modal flex flex-wrap items-center justify-between gap-3 rounded-lg-inc px-5 py-3.5 backdrop-blur-md transition-colors duration-200 ease-standard-default-effects",
				sticky && "sticky bottom-4 z-20",
				dirty ? "ring-accent/50 ring-1" : "ring-md-outline-variant/40 ring-1",
			)}
		>
			<div className="flex min-w-0 flex-wrap items-center gap-2.5">
				{dirty ? (
					<Badge variant="soft" tone="warning" size="sm">
						{t("admin.settings.unsavedBadge")}
					</Badge>
				) : null}
				<span className="text-md-on-surface-variant text-body-small">
					{scopeHint ??
						(dirty
							? t("admin.settings.unsavedBadge")
							: t("admin.settings.syncedStatus"))}
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-2.5">
				{dirty ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={saving}
						onClick={onDiscard}
					>
						<Undo2 />
						{t("admin.settings.discard")}
					</Button>
				) : null}
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={saving || !overridden}
					onClick={onRequestReset}
				>
					<RotateCcw /> {t("admin.settings.reset")}
				</Button>
				<Button type="submit" variant="primary" size="sm" disabled={saving}>
					<Save />
					{saving ? t("admin.settings.saving") : t("admin.settings.save")}
				</Button>
			</div>
		</div>
	);
}
