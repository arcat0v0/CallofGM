import type {
	AdminSiteSettingsResponse,
	SiteSettingsSection,
	ThemeSummaryDto,
	UpdateSiteSettingsRequest,
} from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	Cloud,
	Palette,
	RotateCcw,
	Server,
	Shield,
	Volume2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminShell } from "@/features/admin/admin-shell";
import { SecuritySettingsPanel } from "@/features/admin/settings/security-settings-panel";
import {
	fetchAdminSettings,
	resetAdminSettings,
	updateAdminSettings,
} from "@/features/admin/settings/settings-api";
import { StorageSettingsPanel } from "@/features/admin/settings/storage-settings-panel";
import { SystemInfoPanel } from "@/features/admin/settings/system-info-panel";
import { UiSettingsPanel } from "@/features/admin/settings/ui-settings-panel";
import { VoiceSettingsPanel } from "@/features/admin/settings/voice-settings-panel";
import { t, useI18nVersion } from "@/i18n";
import { errorText } from "@/lib/errors";
import { requireAccount } from "@/lib/identity";
import { useRuntimeConfigStore } from "@/stores/runtime-config-store";
import { listThemes } from "@/themes/themes-api";

export const Route = createFileRoute("/admin/settings")({
	beforeLoad: () => requireAccount(["admin"]),
	component: AdminSettingsPage,
});

function UnsavedDot() {
	return (
		<>
			<span
				className="bg-warning size-1.5 shrink-0 rounded-full"
				aria-hidden="true"
			/>
			<span className="sr-only">{t("admin.settings.unsavedBadge")}</span>
		</>
	);
}

function AdminSettingsPage() {
	useI18nVersion();
	const [settings, setSettings] = useState<AdminSiteSettingsResponse | null>(
		null,
	);
	const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [resetTarget, setResetTarget] = useState<SiteSettingsSection | null>(
		null,
	);
	const [dirtySections, setDirtySections] = useState<
		Record<SiteSettingsSection, boolean>
	>({
		storage: false,
		voice: false,
		security: false,
		ui: false,
	});

	const setSectionDirty = useCallback(
		(section: SiteSettingsSection, dirty: boolean) => {
			setDirtySections((prev) =>
				prev[section] === dirty ? prev : { ...prev, [section]: dirty },
			);
		},
		[],
	);

	const onStorageDirtyChange = useCallback(
		(dirty: boolean) => setSectionDirty("storage", dirty),
		[setSectionDirty],
	);
	const onVoiceDirtyChange = useCallback(
		(dirty: boolean) => setSectionDirty("voice", dirty),
		[setSectionDirty],
	);
	const onSecurityDirtyChange = useCallback(
		(dirty: boolean) => setSectionDirty("security", dirty),
		[setSectionDirty],
	);
	const onUiDirtyChange = useCallback(
		(dirty: boolean) => setSectionDirty("ui", dirty),
		[setSectionDirty],
	);

	const syncRuntimeStore = useCallback((next: AdminSiteSettingsResponse) => {
		useRuntimeConfigStore.getState().apply({
			storageMode: next.storage.mode,
			maxMediaUploadBytes: next.storage.maxMediaUploadMb * 1024 * 1024,
			maxThemeUploadBytes: next.storage.maxThemeUploadMb * 1024 * 1024,
		});
		void useRuntimeConfigStore.getState().load(true);
	}, []);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const [nextSettings, nextThemes] = await Promise.all([
				fetchAdminSettings(),
				listThemes().catch(() => [] as ThemeSummaryDto[]),
			]);
			setSettings(nextSettings);
			setThemes(nextThemes);
			syncRuntimeStore(nextSettings);
		} catch (error) {
			toast.error(errorText(error, "admin.settings.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, [syncRuntimeStore]);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function handleSave(payload: UpdateSiteSettingsRequest) {
		setSaving(true);
		try {
			const updated = await updateAdminSettings(payload);
			setSettings(updated);
			syncRuntimeStore(updated);
			toast.success(t("admin.settings.saved"));
		} catch (error) {
			toast.error(errorText(error, "admin.settings.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	async function handleConfirmReset() {
		const target = resetTarget;
		setResetTarget(null);
		if (!target) {
			return;
		}
		setSaving(true);
		try {
			const updated = await resetAdminSettings(target);
			setSettings(updated);
			syncRuntimeStore(updated);
			toast.success(t("admin.settings.resetDone"));
		} catch (error) {
			toast.error(errorText(error, "admin.settings.resetFailed"));
		} finally {
			setSaving(false);
		}
	}

	const overridden = new Set(settings?.overriddenSections ?? []);

	return (
		<AdminShell>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("admin.settings.title")}
					description={t("admin.settings.description")}
				/>

				{loading || !settings ? (
					<ListSkeleton rows={4} />
				) : (
					<Tabs defaultValue="storage" className="gap-6">
						<div className="overflow-x-auto">
							<TabsList>
								<TabsTrigger value="storage">
									<Cloud /> {t("admin.settings.tab.storage")}
									{dirtySections.storage ? <UnsavedDot /> : null}
								</TabsTrigger>
								<TabsTrigger value="voice">
									<Volume2 /> {t("admin.settings.tab.voice")}
									{dirtySections.voice ? <UnsavedDot /> : null}
								</TabsTrigger>
								<TabsTrigger value="security">
									<Shield /> {t("admin.settings.tab.security")}
									{dirtySections.security ? <UnsavedDot /> : null}
								</TabsTrigger>
								<TabsTrigger value="ui">
									<Palette /> {t("admin.settings.tab.ui")}
									{dirtySections.ui ? <UnsavedDot /> : null}
								</TabsTrigger>
								<TabsTrigger value="system">
									<Server /> {t("admin.settings.tab.system")}
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent
							value="storage"
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<StorageSettingsPanel
								settings={settings.storage}
								overridden={overridden.has("storage")}
								saving={saving}
								onSave={(storage) => handleSave({ storage })}
								onRequestReset={() => setResetTarget("storage")}
								onDirtyChange={onStorageDirtyChange}
							/>
						</TabsContent>

						<TabsContent
							value="voice"
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<VoiceSettingsPanel
								settings={settings.voice}
								overridden={overridden.has("voice")}
								saving={saving}
								onSave={(voice) => handleSave({ voice })}
								onRequestReset={() => setResetTarget("voice")}
								onDirtyChange={onVoiceDirtyChange}
							/>
						</TabsContent>

						<TabsContent
							value="security"
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<SecuritySettingsPanel
								settings={settings.security}
								overridden={overridden.has("security")}
								saving={saving}
								onSave={(security) => handleSave({ security })}
								onRequestReset={() => setResetTarget("security")}
								onDirtyChange={onSecurityDirtyChange}
							/>
						</TabsContent>

						<TabsContent
							value="ui"
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<UiSettingsPanel
								settings={settings.ui}
								themes={themes}
								overridden={overridden.has("ui")}
								saving={saving}
								onSave={(ui) => handleSave({ ui })}
								onRequestReset={() => setResetTarget("ui")}
								onDirtyChange={onUiDirtyChange}
							/>
						</TabsContent>

						<TabsContent
							value="system"
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<SystemInfoPanel system={settings.system} />
						</TabsContent>
					</Tabs>
				)}
			</div>

			<ConfirmDialog
				open={resetTarget !== null}
				onOpenChange={(open) => !open && setResetTarget(null)}
				icon={RotateCcw}
				confirmIcon={RotateCcw}
				title={t("admin.settings.resetTitle")}
				description={t("admin.settings.resetDescription")}
				confirmLabel={t("admin.settings.resetConfirm")}
				onConfirm={() => void handleConfirmReset()}
			/>
		</AdminShell>
	);
}
