import type {
	SiteUiSettingsDto,
	ThemeSummaryDto,
	UpdateUiSectionInput,
} from "@cogm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { SettingsActionBar } from "./settings-action-bar";

const DEFAULT_VALUE = "__default__";

interface UiSettingsPanelProps {
	settings: SiteUiSettingsDto;
	themes: ThemeSummaryDto[];
	overridden: boolean;
	saving: boolean;
	onSave: (input: UpdateUiSectionInput) => Promise<void>;
	onRequestReset: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}

export function UiSettingsPanel({
	settings,
	themes,
	overridden,
	saving,
	onSave,
	onRequestReset,
	onDirtyChange,
}: UiSettingsPanelProps) {
	const [selection, setSelection] = useState(
		settings.gmThemeId ?? DEFAULT_VALUE,
	);

	const resetDraftFromSettings = useCallback(() => {
		setSelection(settings.gmThemeId ?? DEFAULT_VALUE);
	}, [settings]);

	const prevSettingsRef = useRef(settings);
	useEffect(() => {
		if (prevSettingsRef.current === settings) {
			return;
		}
		prevSettingsRef.current = settings;
		resetDraftFromSettings();
	}, [settings, resetDraftFromSettings]);

	const isDirty = selection !== (settings.gmThemeId ?? DEFAULT_VALUE);
	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		await onSave({
			gmThemeId: selection === DEFAULT_VALUE ? null : selection,
		});
	}

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="flex flex-col gap-6"
		>
			<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h2 className="text-foreground font-sans text-title-large-emph">
							{t("admin.settings.ui.title")}
						</h2>
						<Badge
							variant="soft"
							tone={overridden ? "accent" : "default"}
							size="sm"
						>
							{overridden
								? t("admin.settings.overridden")
								: t("admin.settings.defaultBadge")}
						</Badge>
					</div>
					<p className="text-md-on-surface-variant text-body-medium">
						{t("admin.settings.ui.description")}
					</p>
				</div>

				<div className="flex max-w-md flex-col gap-2">
					<Label htmlFor="ui-gm-theme">
						{t("admin.settings.ui.gmThemeLabel")}
					</Label>
					<Select value={selection} onValueChange={setSelection}>
						<SelectTrigger id="ui-gm-theme">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={DEFAULT_VALUE}>
								{t("admin.settings.ui.gmThemeDefault")}
							</SelectItem>
							{themes.map((theme) => (
								<SelectItem key={theme.id} value={theme.id}>
									{theme.name} (v{theme.version})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-md-on-surface-variant text-body-small">
						{t("admin.settings.ui.manageThemesHint")}
					</p>
				</div>
			</section>

			<SettingsActionBar
				dirty={isDirty}
				overridden={overridden}
				saving={saving}
				onDiscard={resetDraftFromSettings}
				onRequestReset={onRequestReset}
			/>
		</form>
	);
}
