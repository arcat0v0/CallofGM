import type { ThemeSummaryDto } from "@cogm/shared";
import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { useGmSettingsStore } from "@/stores/gm-settings-store";
import { listThemes } from "@/themes/themes-api";

const DEFAULT_THEME = "default";

function GmThemeDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
	const [selection, setSelection] = useState(DEFAULT_THEME);
	const [saving, setSaving] = useState(false);
	const gmThemeId = useGmSettingsStore((state) => state.gmThemeId);
	const error = useGmSettingsStore((state) => state.error);
	const setGmThemeId = useGmSettingsStore((state) => state.setGmThemeId);

	useEffect(() => {
		setSelection(gmThemeId ?? DEFAULT_THEME);
	}, [gmThemeId]);

	useEffect(() => {
		if (!open) {
			return;
		}
		let cancelled = false;
		void listThemes()
			.then((items) => {
				if (!cancelled) {
					setThemes(items);
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [open]);

	async function apply(): Promise<void> {
		setSaving(true);
		await setGmThemeId(selection === DEFAULT_THEME ? null : selection);
		setSaving(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("gm.themeControl.title")}</DialogTitle>
					<DialogDescription>
						{t("gm.themeControl.description")}
					</DialogDescription>
				</DialogHeader>
				<Select value={selection} onValueChange={setSelection}>
					<SelectTrigger aria-label={t("gm.themeControl.title")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={DEFAULT_THEME}>
							{t("gm.themeControl.default")}
						</SelectItem>
						{themes.map((theme) => (
							<SelectItem key={theme.id} value={theme.id}>
								{theme.name} ({theme.version})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{error ? (
					<p className="text-danger text-label-medium">{error}</p>
				) : null}
				<DialogFooter>
					<Button
						type="button"
						variant="tertiary"
						onClick={() => onOpenChange(false)}
					>
						{t("gm.themeControl.close")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={saving}
						onClick={() => void apply()}
					>
						{saving ? t("gm.themeControl.saving") : t("gm.themeControl.apply")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function GmThemeControl() {
	const [open, setOpen] = useState(false);

	return (
		<div className="fixed right-4 bottom-4 z-[20000]">
			<Button
				type="button"
				variant="tertiary"
				size="icon-sm"
				className="bg-md-surface-container-high border-white/10 shadow-overlay border"
				aria-label={t("gm.themeControl.aria")}
				title={t("gm.themeControl.title")}
				onClick={() => setOpen(true)}
			>
				<Palette />
			</Button>
			<GmThemeDialog open={open} onOpenChange={setOpen} />
		</div>
	);
}

export { GmThemeDialog };
