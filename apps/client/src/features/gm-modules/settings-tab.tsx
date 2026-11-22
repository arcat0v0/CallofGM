import type { ModuleDto, ThemeSummaryDto } from "@cogm/shared";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";

export function ModuleSettingsTab({
	module,
	themes,
	onSaved,
	onDeleted,
}: {
	module: ModuleDto;
	themes: ThemeSummaryDto[];
	onSaved: () => Promise<void>;
	onDeleted: () => void;
}) {
	const [name, setName] = useState(module.name);
	const [description, setDescription] = useState(module.description);
	const [themeId, setThemeId] = useState<string>(module.themeId ?? "");
	const [saving, setSaving] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	useEffect(() => {
		setName(module.name);
		setDescription(module.description);
		setThemeId(module.themeId ?? "");
	}, [module.name, module.description, module.themeId]);

	const rule = getRuleComponent(module.ruleId);
	const dirty =
		name.trim() !== module.name ||
		description !== module.description ||
		(themeId || null) !== (module.themeId ?? null);

	async function save() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error(t("gm.module.nameRequired"));
			return;
		}
		setSaving(true);
		try {
			await api(`/gm/modules/${encodeURIComponent(module.id)}`, {
				method: "PATCH",
				body: JSON.stringify({
					name: trimmed,
					description,
					themeId: themeId || null,
				}),
			});
			toast.success(t("gm.module.saved"));
			await onSaved();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	function reset() {
		setName(module.name);
		setDescription(module.description);
		setThemeId(module.themeId ?? "");
	}

	return (
		<div className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
			<section className="flex flex-col gap-5 rounded-lg border border-md-outline-variant/55 bg-md-surface-container p-5">
				<h2 className="text-title-medium-emph text-md-on-surface">
					{t("gm.module.settingsTitle")}
				</h2>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="settings-module-name"
							className="text-md-on-surface-variant"
						>
							{t("gm.module.nameLabel")}
						</Label>
						<Input
							id="settings-module-name"
							value={name}
							maxLength={100}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("gm.module.moduleNamePlaceholder")}
							className="rounded-sm border-md-outline-variant/80 bg-md-surface-container-low"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="settings-module-description"
							className="text-md-on-surface-variant"
						>
							{t("gm.module.descriptionLabel")}
						</Label>
						<Textarea
							id="settings-module-description"
							value={description}
							rows={3}
							onChange={(event) => setDescription(event.target.value)}
							placeholder={t("gm.module.moduleDescriptionPlaceholder")}
							className="rounded-sm border-md-outline-variant/80 bg-md-surface-container-low"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="settings-module-theme"
							className="text-md-on-surface-variant"
						>
							{t("gm.modules.theme")}
						</Label>
						<Select
							value={themeId || "default"}
							onValueChange={(value) =>
								setThemeId(value === "default" ? "" : value)
							}
						>
							<SelectTrigger
								id="settings-module-theme"
								className="w-full rounded-sm border-md-outline-variant/80 bg-md-surface-container-low"
								aria-label={t("gm.modules.themeAria", { name: module.name })}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{t("gm.modules.themeDefault")}
								</SelectItem>
								{themes.map((theme) => (
									<SelectItem key={theme.id} value={theme.id}>
										{theme.name} ({theme.version})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-body-small text-md-on-surface-variant">
							{t("gm.module.themeScopeHint")}
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2 border-t border-md-outline-variant/45 pt-4">
					{dirty ? (
						<Button
							type="button"
							variant="text"
							size="sm"
							disabled={saving}
							onClick={reset}
						>
							<RotateCcw />
							{t("gm.module.resetChanges")}
						</Button>
					) : null}
					<Button
						type="button"
						variant="primary"
						size="sm"
						disabled={saving || !name.trim() || !dirty}
						className="disabled:border disabled:border-md-outline-variant/80 disabled:bg-md-surface-container-low disabled:text-md-on-surface-variant"
						onClick={() => void save()}
					>
						{t("gm.module.saveModule")}
					</Button>
				</div>
			</section>

			<div className="flex flex-col gap-5">
				<section className="flex flex-col gap-4 rounded-lg border border-md-outline-variant/55 bg-md-surface-container p-5">
					<h2 className="text-title-small-emph text-md-on-surface">
						{t("gm.module.metadataTitle")}
					</h2>
					<dl className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<dt className="text-label-medium text-md-on-surface-variant">
								{t("rules.label")}
							</dt>
							<dd className="text-body-medium text-md-on-surface">
								{rule.shortName} · {rule.metadata.name}
							</dd>
							<dd className="text-body-small text-md-on-surface-variant">
								{t("rules.hint")}
							</dd>
						</div>
						<div className="flex flex-col gap-1 border-t border-md-outline-variant/45 pt-3.5">
							<dt className="text-label-medium text-md-on-surface-variant">
								{t("gm.module.createdAtLabel")}
							</dt>
							<dd className="text-body-medium tabular-nums text-md-on-surface">
								{formatDateTime(module.createdAt)}
							</dd>
						</div>
					</dl>
				</section>

				<section className="flex flex-col gap-3.5 rounded-lg border border-md-error/35 bg-md-surface-container p-5">
					<div className="flex flex-col gap-1">
						<h2 className="text-title-small-emph text-md-on-surface">
							{t("gm.modules.deleteTitle")}
						</h2>
						<p className="text-body-small text-md-on-surface-variant">
							{t("gm.modules.deleteDescription")}
						</p>
					</div>
					<div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="border-md-error/50 text-md-error hover:border-md-error/75 hover:bg-md-error/10"
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 />
							{t("gm.modules.deleteTitle")}
						</Button>
					</div>
				</section>
			</div>

			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.modules.deleteTitle")}
				description={t("gm.modules.deleteDescription")}
				confirmLabel={t("gm.modules.deleteConfirm")}
				onConfirm={() => {
					setDeleteOpen(false);
					void api(`/gm/modules/${encodeURIComponent(module.id)}`, {
						method: "DELETE",
					})
						.then(() => onDeleted())
						.catch((error) =>
							toast.error(errorText(error, "gm.modules.deleteFailed")),
						);
				}}
			/>
		</div>
	);
}
