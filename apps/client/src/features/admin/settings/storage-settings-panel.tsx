import type {
	OssAccessMode,
	S3ConfigInput,
	SiteStorageSettingsDto,
	StorageCheckItemDto,
	StorageMigrationStatusDto,
	StorageMode,
	TestStorageConnectionResponse,
	UpdateStorageSettingsInput,
} from "@cogm/shared";
import {
	AlertTriangle,
	ArrowRightLeft,
	CheckCircle2,
	Cloud,
	HardDrive,
	Info,
	RefreshCw,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { errorText } from "@/lib/errors";
import { useRuntimeConfigStore } from "@/stores/runtime-config-store";
import { SettingsActionBar } from "./settings-action-bar";
import {
	fetchStorageMigrationStatus,
	runBrowserStorageProbe,
	startStorageMigration,
	testStorageConnection,
} from "./settings-api";

interface StorageSettingsPanelProps {
	settings: SiteStorageSettingsDto;
	overridden: boolean;
	saving: boolean;
	onSave: (input: UpdateStorageSettingsInput) => Promise<void>;
	onRequestReset: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}

interface CombinedTestResult {
	server: TestStorageConnectionResponse;
	browserPut?: StorageCheckItemDto;
	browserGet?: StorageCheckItemDto;
}

type StorageFieldKey =
	| "maxMediaUploadMb"
	| "maxThemeUploadMb"
	| "endpoint"
	| "publicUploadEndpoint"
	| "bucket"
	| "accessKeyId"
	| "secretAccessKey"
	| "downloadBaseUrl"
	| "signedUrlTtlSeconds";

type StorageFieldErrors = Partial<Record<StorageFieldKey, string>>;

const FIELD_INPUT_IDS: Record<StorageFieldKey, string> = {
	maxMediaUploadMb: "max-media-mb",
	maxThemeUploadMb: "max-theme-mb",
	endpoint: "s3-endpoint",
	publicUploadEndpoint: "s3-public-upload-endpoint",
	bucket: "s3-bucket",
	accessKeyId: "s3-ak",
	secretAccessKey: "s3-sk",
	downloadBaseUrl: "s3-download-base",
	signedUrlTtlSeconds: "s3-signed-ttl",
};

const FIELD_ORDER: StorageFieldKey[] = [
	"maxMediaUploadMb",
	"maxThemeUploadMb",
	"endpoint",
	"publicUploadEndpoint",
	"bucket",
	"accessKeyId",
	"secretAccessKey",
	"downloadBaseUrl",
	"signedUrlTtlSeconds",
];

function trimSlashesRight(value: string): string {
	return value.trim().replace(/\/+$/, "");
}

function normalizePrefix(value: string): string {
	return value.trim().replace(/^\/+|\/+$/g, "");
}

function isValidHttpUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

function parseIntInRange(raw: string, min: number, max: number): number | null {
	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) {
		return null;
	}
	const value = Number(trimmed);
	if (!Number.isSafeInteger(value) || value < min || value > max) {
		return null;
	}
	return value;
}

function focusFirstInvalidField(errors: StorageFieldErrors): void {
	const firstKey = FIELD_ORDER.find((key) => Boolean(errors[key]));
	if (!firstKey) {
		return;
	}
	const el = document.getElementById(FIELD_INPUT_IDS[firstKey]);
	if (!el) {
		return;
	}
	if (typeof el.scrollIntoView === "function") {
		el.scrollIntoView({ behavior: "smooth", block: "center" });
	}
	if (typeof el.focus === "function") {
		el.focus();
	}
}

export function StorageSettingsPanel({
	settings,
	overridden,
	saving,
	onSave,
	onRequestReset,
	onDirtyChange,
}: StorageSettingsPanelProps) {
	const [mode, setMode] = useState<StorageMode>(settings.mode);
	const [maxMediaUploadMb, setMaxMediaUploadMb] = useState(
		String(settings.maxMediaUploadMb),
	);
	const [maxThemeUploadMb, setMaxThemeUploadMb] = useState(
		String(settings.maxThemeUploadMb),
	);
	const [endpoint, setEndpoint] = useState(settings.s3.endpoint);
	const [publicUploadEndpoint, setPublicUploadEndpoint] = useState(
		settings.s3.publicUploadEndpoint,
	);
	const [region, setRegion] = useState(settings.s3.region);
	const [bucket, setBucket] = useState(settings.s3.bucket);
	const [forcePathStyle, setForcePathStyle] = useState(
		settings.s3.forcePathStyle,
	);
	const [keyPrefix, setKeyPrefix] = useState(settings.s3.keyPrefix);
	const [accessKeyId, setAccessKeyId] = useState(settings.s3.accessKeyId);
	const [secretAccessKey, setSecretAccessKey] = useState("");
	const [clearSecretAccessKey, setClearSecretAccessKey] = useState(false);
	const [downloadBaseUrl, setDownloadBaseUrl] = useState(
		settings.s3.downloadBaseUrl,
	);
	const [accessMode, setAccessMode] = useState<OssAccessMode>(
		settings.s3.accessMode,
	);
	const [signedUrlTtlSeconds, setSignedUrlTtlSeconds] = useState(
		String(settings.s3.signedUrlTtlSeconds),
	);
	const [fieldErrors, setFieldErrors] = useState<StorageFieldErrors>({});

	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<CombinedTestResult | null>(null);
	const [migration, setMigration] = useState<StorageMigrationStatusDto | null>(
		null,
	);
	const [migratingReq, setMigratingReq] = useState(false);

	const resetDraftFromSettings = useCallback(() => {
		setMode(settings.mode);
		setMaxMediaUploadMb(String(settings.maxMediaUploadMb));
		setMaxThemeUploadMb(String(settings.maxThemeUploadMb));
		setEndpoint(settings.s3.endpoint);
		setPublicUploadEndpoint(settings.s3.publicUploadEndpoint);
		setRegion(settings.s3.region);
		setBucket(settings.s3.bucket);
		setForcePathStyle(settings.s3.forcePathStyle);
		setKeyPrefix(settings.s3.keyPrefix);
		setAccessKeyId(settings.s3.accessKeyId);
		setSecretAccessKey("");
		setClearSecretAccessKey(false);
		setDownloadBaseUrl(settings.s3.downloadBaseUrl);
		setAccessMode(settings.s3.accessMode);
		setSignedUrlTtlSeconds(String(settings.s3.signedUrlTtlSeconds));
		setFieldErrors({});
	}, [settings]);

	const prevSettingsRef = useRef(settings);
	useEffect(() => {
		if (prevSettingsRef.current === settings) {
			return;
		}
		prevSettingsRef.current = settings;
		resetDraftFromSettings();
	}, [settings, resetDraftFromSettings]);

	const isDirty = useMemo(() => {
		return (
			mode !== settings.mode ||
			maxMediaUploadMb.trim() !== String(settings.maxMediaUploadMb) ||
			maxThemeUploadMb.trim() !== String(settings.maxThemeUploadMb) ||
			trimSlashesRight(endpoint) !== trimSlashesRight(settings.s3.endpoint) ||
			trimSlashesRight(publicUploadEndpoint) !==
				trimSlashesRight(settings.s3.publicUploadEndpoint) ||
			(region.trim() || "us-east-1") !== (settings.s3.region || "us-east-1") ||
			bucket.trim() !== settings.s3.bucket ||
			forcePathStyle !== settings.s3.forcePathStyle ||
			normalizePrefix(keyPrefix) !== normalizePrefix(settings.s3.keyPrefix) ||
			accessKeyId.trim() !== settings.s3.accessKeyId ||
			secretAccessKey.trim().length > 0 ||
			clearSecretAccessKey ||
			trimSlashesRight(downloadBaseUrl) !==
				trimSlashesRight(settings.s3.downloadBaseUrl) ||
			accessMode !== settings.s3.accessMode ||
			signedUrlTtlSeconds.trim() !== String(settings.s3.signedUrlTtlSeconds)
		);
	}, [
		mode,
		maxMediaUploadMb,
		maxThemeUploadMb,
		endpoint,
		publicUploadEndpoint,
		region,
		bucket,
		forcePathStyle,
		keyPrefix,
		accessKeyId,
		secretAccessKey,
		clearSecretAccessKey,
		downloadBaseUrl,
		accessMode,
		signedUrlTtlSeconds,
		settings,
	]);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	useEffect(() => {
		let cancelled = false;
		void fetchStorageMigrationStatus()
			.then((status) => {
				if (!cancelled) {
					setMigration(status);
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (migration?.status !== "running") {
			return;
		}
		const timer = setInterval(() => {
			void fetchStorageMigrationStatus()
				.then((status) => {
					setMigration(status);
					if (status.status === "completed") {
						void useRuntimeConfigStore.getState().load(true);
					}
				})
				.catch(() => undefined);
		}, 1500);
		return () => clearInterval(timer);
	}, [migration?.status]);

	function clearFieldError(key: StorageFieldKey) {
		setFieldErrors((prev) => {
			if (!prev[key]) {
				return prev;
			}
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}

	function validateForm(options: {
		requireCompleteS3: boolean;
		includeUploadLimits: boolean;
	}): StorageFieldErrors {
		const errors: StorageFieldErrors = {};
		if (options.includeUploadLimits) {
			if (parseIntInRange(maxMediaUploadMb, 1, 1_024) === null) {
				errors.maxMediaUploadMb = t("admin.settings.storage.error.range", {
					min: 1,
					max: 1_024,
				});
			}
			if (parseIntInRange(maxThemeUploadMb, 1, 512) === null) {
				errors.maxThemeUploadMb = t("admin.settings.storage.error.range", {
					min: 1,
					max: 512,
				});
			}
		}

		const trimmedEndpoint = endpoint.trim();
		if (trimmedEndpoint && !isValidHttpUrl(trimmedEndpoint)) {
			errors.endpoint = t("admin.settings.storage.error.invalidUrl");
		} else if (options.requireCompleteS3 && !trimmedEndpoint) {
			errors.endpoint = t("admin.settings.storage.error.required");
		}

		const trimmedPublicUpload = publicUploadEndpoint.trim();
		if (trimmedPublicUpload && !isValidHttpUrl(trimmedPublicUpload)) {
			errors.publicUploadEndpoint = t(
				"admin.settings.storage.error.invalidUrl",
			);
		}

		if (options.requireCompleteS3 && !bucket.trim()) {
			errors.bucket = t("admin.settings.storage.error.required");
		}

		if (options.requireCompleteS3 && !accessKeyId.trim()) {
			errors.accessKeyId = t("admin.settings.storage.error.required");
		}

		const hasEffectiveSecret =
			Boolean(secretAccessKey.trim()) ||
			(settings.s3.hasSecretAccessKey && !clearSecretAccessKey);
		if (options.requireCompleteS3 && !hasEffectiveSecret) {
			errors.secretAccessKey = t("admin.settings.storage.error.required");
		}

		const trimmedDownload = downloadBaseUrl.trim();
		if (trimmedDownload && !isValidHttpUrl(trimmedDownload)) {
			errors.downloadBaseUrl = t("admin.settings.storage.error.invalidUrl");
		} else if (options.requireCompleteS3 && !trimmedDownload) {
			errors.downloadBaseUrl = t("admin.settings.storage.error.required");
		}

		if (
			accessMode === "private" &&
			parseIntInRange(signedUrlTtlSeconds, 60, 86_400) === null
		) {
			errors.signedUrlTtlSeconds = t("admin.settings.storage.error.range", {
				min: 60,
				max: 86_400,
			});
		}

		return errors;
	}

	function buildS3Payload(): S3ConfigInput {
		const ttl = parseIntInRange(signedUrlTtlSeconds, 60, 86_400) ?? 600;
		return {
			endpoint: endpoint.trim(),
			publicUploadEndpoint: publicUploadEndpoint.trim(),
			region: region.trim() || "us-east-1",
			bucket: bucket.trim(),
			forcePathStyle,
			keyPrefix: keyPrefix.trim(),
			accessKeyId: accessKeyId.trim(),
			...(secretAccessKey.trim()
				? { secretAccessKey: secretAccessKey.trim() }
				: {}),
			...(clearSecretAccessKey ? { clearSecretAccessKey: true } : {}),
			downloadBaseUrl: downloadBaseUrl.trim(),
			accessMode,
			signedUrlTtlSeconds: ttl,
		};
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const errors = validateForm({
			requireCompleteS3: mode === "s3",
			includeUploadLimits: true,
		});
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			focusFirstInvalidField(errors);
			toast.error(t("admin.settings.storage.validationFailed"));
			return;
		}
		setFieldErrors({});
		const mediaMb = parseIntInRange(maxMediaUploadMb, 1, 1_024) ?? 100;
		const themeMb = parseIntInRange(maxThemeUploadMb, 1, 512) ?? 50;
		await onSave({
			mode,
			maxMediaUploadMb: mediaMb,
			maxThemeUploadMb: themeMb,
			s3: buildS3Payload(),
		});
	}

	async function handleTestConnection() {
		const errors = validateForm({
			requireCompleteS3: true,
			includeUploadLimits: false,
		});
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			focusFirstInvalidField(errors);
			toast.error(t("admin.settings.storage.testValidationFailed"));
			return;
		}
		setFieldErrors({});
		setTesting(true);
		setTestResult(null);
		try {
			const serverResult = await testStorageConnection(buildS3Payload());
			let browserChecks: {
				browserPut?: StorageCheckItemDto;
				browserGet?: StorageCheckItemDto;
			} = {};
			if (serverResult.browserProbe) {
				browserChecks = await runBrowserStorageProbe(serverResult.browserProbe);
			}
			const combined: CombinedTestResult = {
				server: serverResult,
				...browserChecks,
			};
			setTestResult(combined);
			const allPassed =
				serverResult.ok &&
				(browserChecks.browserPut?.ok ?? true) &&
				(browserChecks.browserGet?.ok ?? true);
			if (allPassed) {
				toast.success(t("admin.settings.storage.testPassed"));
			} else {
				toast.warning(t("admin.settings.storage.testPartial"));
			}
		} catch (error) {
			toast.error(errorText(error, "admin.settings.storage.testFailed"));
		} finally {
			setTesting(false);
		}
	}

	async function handleStartMigration() {
		setMigratingReq(true);
		try {
			const status = await startStorageMigration();
			setMigration(status);
			if (status.status === "completed") {
				void useRuntimeConfigStore.getState().load(true);
			}
			toast.success(t("admin.settings.storage.migrateStarted"));
		} catch (error) {
			toast.error(errorText(error, "admin.settings.storage.migrateFailed"));
		} finally {
			setMigratingReq(false);
		}
	}

	async function handleRefreshMigration() {
		try {
			const status = await fetchStorageMigrationStatus();
			setMigration(status);
			if (status.status === "completed") {
				void useRuntimeConfigStore.getState().load(true);
			}
		} catch (error) {
			toast.error(errorText(error, "admin.settings.loadFailed"));
		}
	}

	const migrationTotal =
		(migration?.media.total ?? 0) +
		(migration?.themes.total ?? 0) +
		(migration?.dice?.total ?? 0);
	const migrationDone =
		(migration?.media.migrated ?? 0) +
		(migration?.media.skipped ?? 0) +
		(migration?.media.failed ?? 0) +
		(migration?.themes.migrated ?? 0) +
		(migration?.themes.skipped ?? 0) +
		(migration?.themes.failed ?? 0) +
		(migration?.dice?.migrated ?? 0) +
		(migration?.dice?.skipped ?? 0) +
		(migration?.dice?.failed ?? 0);
	const migrationPercent =
		migrationTotal > 0 ? Math.round((migrationDone / migrationTotal) * 100) : 0;

	const checkRows: Array<{ labelKey: string; item: StorageCheckItemDto }> =
		testResult
			? [
					{
						labelKey: "admin.settings.storage.check.put",
						item: testResult.server.checks.putObject,
					},
					{
						labelKey: "admin.settings.storage.check.head",
						item: testResult.server.checks.headObject,
					},
					{
						labelKey: "admin.settings.storage.check.range",
						item: testResult.server.checks.rangeRead,
					},
					{
						labelKey: "admin.settings.storage.check.download",
						item: testResult.server.checks.downloadDomain,
					},
					{
						labelKey: "admin.settings.storage.check.delete",
						item: testResult.server.checks.deleteObject,
					},
					...(testResult.browserPut
						? [
								{
									labelKey: "admin.settings.storage.check.browserPut",
									item: testResult.browserPut,
								},
							]
						: []),
					...(testResult.browserGet
						? [
								{
									labelKey: "admin.settings.storage.check.browserGet",
									item: testResult.browserGet,
								},
							]
						: []),
				]
			: [];

	const s3RequiredMark =
		mode === "s3" ? (
			<span className="text-danger ml-0.5" aria-hidden="true">
				*
			</span>
		) : null;

	function renderFieldError(key: StorageFieldKey) {
		const message = fieldErrors[key];
		if (!message) {
			return null;
		}
		return (
			<p role="alert" className="text-danger text-body-small">
				{message}
			</p>
		);
	}

	function invalidClass(key: StorageFieldKey): string | undefined {
		return fieldErrors[key]
			? "border-danger focus-visible:border-danger"
			: undefined;
	}

	return (
		<div className="flex flex-col gap-6">
			<form
				noValidate
				onSubmit={(e) => void handleSubmit(e)}
				className="flex flex-col gap-6"
			>
				<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex flex-col gap-1">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="text-foreground font-sans text-title-large-emph">
									{t("admin.settings.storage.modeTitle")}
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
								{t("admin.settings.storage.modeDescription")}
							</p>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="storage-mode">
								{t("admin.settings.storage.modeLabel")}
							</Label>
							<Select
								value={mode}
								onValueChange={(value) => {
									const nextMode = value as StorageMode;
									setMode(nextMode);
									if (nextMode === "local") {
										setFieldErrors((prev) => {
											const next = { ...prev };
											delete next.bucket;
											delete next.accessKeyId;
											delete next.secretAccessKey;
											if (!endpoint.trim()) delete next.endpoint;
											if (!downloadBaseUrl.trim()) delete next.downloadBaseUrl;
											return next;
										});
									}
								}}
							>
								<SelectTrigger id="storage-mode">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="local">
										<span className="inline-flex items-center gap-2">
											<HardDrive className="size-4" />
											{t("admin.settings.storage.modeLocal")}
										</span>
									</SelectItem>
									<SelectItem value="s3">
										<span className="inline-flex items-center gap-2">
											<Cloud className="size-4" />
											{t("admin.settings.storage.modeS3")}
										</span>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="max-media-mb">
								{t("admin.settings.storage.maxMediaMb")}
							</Label>
							<Input
								id="max-media-mb"
								type="number"
								min={1}
								max={1024}
								aria-invalid={
									Boolean(fieldErrors.maxMediaUploadMb) || undefined
								}
								className={invalidClass("maxMediaUploadMb")}
								value={maxMediaUploadMb}
								onChange={(e) => {
									setMaxMediaUploadMb(e.target.value);
									clearFieldError("maxMediaUploadMb");
								}}
							/>
							{renderFieldError("maxMediaUploadMb")}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="max-theme-mb">
								{t("admin.settings.storage.maxThemeMb")}
							</Label>
							<Input
								id="max-theme-mb"
								type="number"
								min={1}
								max={512}
								aria-invalid={
									Boolean(fieldErrors.maxThemeUploadMb) || undefined
								}
								className={invalidClass("maxThemeUploadMb")}
								value={maxThemeUploadMb}
								onChange={(e) => {
									setMaxThemeUploadMb(e.target.value);
									clearFieldError("maxThemeUploadMb");
								}}
							/>
							{renderFieldError("maxThemeUploadMb")}
						</div>
					</div>
				</section>

				<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
					<div className="flex flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-foreground font-sans text-title-large-emph">
								{t("admin.settings.storage.s3Title")}
							</h2>
							<Badge
								variant="soft"
								tone={mode === "s3" ? "accent" : "default"}
								size="sm"
							>
								{mode === "s3"
									? t("admin.settings.storage.s3ActiveBadge")
									: t("admin.settings.storage.s3DraftBadge")}
							</Badge>
						</div>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("admin.settings.storage.s3Description")}
						</p>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-endpoint">
								{t("admin.settings.storage.endpoint")}
								{s3RequiredMark}
							</Label>
							<Input
								id="s3-endpoint"
								type="url"
								placeholder={t("admin.settings.storage.endpointPlaceholder")}
								aria-invalid={Boolean(fieldErrors.endpoint) || undefined}
								className={invalidClass("endpoint")}
								value={endpoint}
								onChange={(e) => {
									setEndpoint(e.target.value);
									clearFieldError("endpoint");
								}}
							/>
							{renderFieldError("endpoint")}
							<p className="text-md-on-surface-variant text-body-small">
								{t("admin.settings.storage.endpointHint")}
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-public-upload-endpoint">
								{t("admin.settings.storage.publicUploadEndpoint")}
							</Label>
							<Input
								id="s3-public-upload-endpoint"
								type="url"
								placeholder={t(
									"admin.settings.storage.publicUploadEndpointPlaceholder",
								)}
								aria-invalid={
									Boolean(fieldErrors.publicUploadEndpoint) || undefined
								}
								className={invalidClass("publicUploadEndpoint")}
								value={publicUploadEndpoint}
								onChange={(e) => {
									setPublicUploadEndpoint(e.target.value);
									clearFieldError("publicUploadEndpoint");
								}}
							/>
							{renderFieldError("publicUploadEndpoint")}
							<p className="text-md-on-surface-variant text-body-small">
								{t("admin.settings.storage.publicUploadEndpointHint")}
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-region">
								{t("admin.settings.storage.region")}
							</Label>
							<Input
								id="s3-region"
								placeholder={t("admin.settings.storage.regionPlaceholder")}
								value={region}
								onChange={(e) => setRegion(e.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-bucket">
								{t("admin.settings.storage.bucket")}
								{s3RequiredMark}
							</Label>
							<Input
								id="s3-bucket"
								placeholder={t("admin.settings.storage.bucketPlaceholder")}
								aria-invalid={Boolean(fieldErrors.bucket) || undefined}
								className={invalidClass("bucket")}
								value={bucket}
								onChange={(e) => {
									setBucket(e.target.value);
									clearFieldError("bucket");
								}}
							/>
							{renderFieldError("bucket")}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-key-prefix">
								{t("admin.settings.storage.keyPrefix")}
							</Label>
							<Input
								id="s3-key-prefix"
								placeholder={t("admin.settings.storage.keyPrefixPlaceholder")}
								value={keyPrefix}
								onChange={(e) => setKeyPrefix(e.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-ak">
								{t("admin.settings.storage.accessKeyId")}
								{s3RequiredMark}
							</Label>
							<Input
								id="s3-ak"
								autoComplete="off"
								aria-invalid={Boolean(fieldErrors.accessKeyId) || undefined}
								className={invalidClass("accessKeyId")}
								value={accessKeyId}
								onChange={(e) => {
									setAccessKeyId(e.target.value);
									clearFieldError("accessKeyId");
								}}
							/>
							{renderFieldError("accessKeyId")}
						</div>

						<div className="flex flex-col gap-2 md:col-span-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<Label htmlFor="s3-sk">
									{t("admin.settings.storage.secretAccessKey")}
									{s3RequiredMark}
								</Label>
								{settings.s3.hasSecretAccessKey && !clearSecretAccessKey ? (
									<Badge variant="soft" tone="success" size="sm">
										{t("admin.settings.storage.secretConfigured", {
											mask: settings.s3.secretAccessKeyMask ?? "****",
										})}
									</Badge>
								) : null}
							</div>
							<Input
								id="s3-sk"
								type="password"
								autoComplete="new-password"
								placeholder={
									settings.s3.hasSecretAccessKey && !clearSecretAccessKey
										? t("admin.settings.storage.secretKeepPlaceholder")
										: t("admin.settings.storage.secretEmptyPlaceholder")
								}
								aria-invalid={Boolean(fieldErrors.secretAccessKey) || undefined}
								className={invalidClass("secretAccessKey")}
								value={secretAccessKey}
								onChange={(e) => {
									setSecretAccessKey(e.target.value);
									if (e.target.value) setClearSecretAccessKey(false);
									clearFieldError("secretAccessKey");
								}}
							/>
							{renderFieldError("secretAccessKey")}
							{settings.s3.hasSecretAccessKey ? (
								<div className="flex items-center gap-3 pt-1">
									<Switch
										id="s3-clear-sk"
										size="sm"
										checked={clearSecretAccessKey}
										onCheckedChange={(checked) => {
											setClearSecretAccessKey(checked);
											if (checked) setSecretAccessKey("");
											clearFieldError("secretAccessKey");
										}}
									/>
									<Label htmlFor="s3-clear-sk" className="text-body-small">
										{t("admin.settings.storage.clearSecret")}
									</Label>
								</div>
							) : null}
						</div>
					</div>

					<div className="bg-md-surface-container-high flex items-center justify-between gap-4 rounded-xl px-4 py-3">
						<div className="flex flex-col gap-0.5">
							<Label htmlFor="s3-path-style">
								{t("admin.settings.storage.forcePathStyle")}
							</Label>
							<p className="text-md-on-surface-variant text-body-small">
								{t("admin.settings.storage.forcePathStyleHint")}
							</p>
						</div>
						<Switch
							id="s3-path-style"
							checked={forcePathStyle}
							onCheckedChange={setForcePathStyle}
						/>
					</div>
				</section>

				<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
					<div className="flex flex-col gap-1">
						<h2 className="text-foreground font-sans text-title-large-emph">
							{t("admin.settings.storage.deliveryTitle")}
						</h2>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("admin.settings.storage.deliveryDescription")}
						</p>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex flex-col gap-2 md:col-span-2">
							<Label htmlFor="s3-download-base">
								{t("admin.settings.storage.downloadBaseUrl")}
								{s3RequiredMark}
							</Label>
							<Input
								id="s3-download-base"
								type="url"
								placeholder={t(
									"admin.settings.storage.downloadBaseUrlPlaceholder",
								)}
								aria-invalid={Boolean(fieldErrors.downloadBaseUrl) || undefined}
								className={invalidClass("downloadBaseUrl")}
								value={downloadBaseUrl}
								onChange={(e) => {
									setDownloadBaseUrl(e.target.value);
									clearFieldError("downloadBaseUrl");
								}}
							/>
							{renderFieldError("downloadBaseUrl")}
							<p className="text-md-on-surface-variant text-body-small">
								{t("admin.settings.storage.downloadBaseUrlHint")}
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-access-mode">
								{t("admin.settings.storage.accessMode")}
							</Label>
							<Select
								value={accessMode}
								onValueChange={(value) => {
									setAccessMode(value as OssAccessMode);
									clearFieldError("signedUrlTtlSeconds");
								}}
							>
								<SelectTrigger id="s3-access-mode">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="public">
										{t("admin.settings.storage.accessPublic")}
									</SelectItem>
									<SelectItem value="private">
										{t("admin.settings.storage.accessPrivate")}
									</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-md-on-surface-variant text-body-small">
								{t("admin.settings.storage.accessHint")}
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="s3-signed-ttl">
								{t("admin.settings.storage.signedTtl")}
							</Label>
							<Input
								id="s3-signed-ttl"
								type="number"
								min={60}
								max={86400}
								disabled={accessMode !== "private"}
								aria-invalid={
									Boolean(fieldErrors.signedUrlTtlSeconds) || undefined
								}
								className={invalidClass("signedUrlTtlSeconds")}
								value={signedUrlTtlSeconds}
								onChange={(e) => {
									setSignedUrlTtlSeconds(e.target.value);
									clearFieldError("signedUrlTtlSeconds");
								}}
							/>
							{renderFieldError("signedUrlTtlSeconds")}
						</div>
					</div>

					<Alert variant="accent">
						<AlertIcon>
							<Info />
						</AlertIcon>
						<AlertContent>
							<AlertTitle>
								{t("admin.settings.storage.corsGuideTitle")}
							</AlertTitle>
							<AlertDescription>
								{t("admin.settings.storage.corsGuideBody")}
							</AlertDescription>
						</AlertContent>
					</Alert>
				</section>

				<SettingsActionBar
					sticky
					dirty={isDirty}
					overridden={overridden}
					saving={saving}
					scopeHint={t("admin.settings.storage.saveScopeHint")}
					onDiscard={resetDraftFromSettings}
					onRequestReset={onRequestReset}
				/>
			</form>

			<section className="bg-md-surface-container flex flex-col gap-4 rounded-2xl p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h2 className="text-foreground font-sans text-title-large-emph">
							{t("admin.settings.storage.testTitle")}
						</h2>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("admin.settings.storage.testDescription")}
						</p>
					</div>
					<Button
						type="button"
						variant="secondary"
						disabled={testing}
						onClick={() => void handleTestConnection()}
					>
						<ShieldCheck />
						{testing
							? t("admin.settings.storage.testing")
							: t("admin.settings.storage.testRun")}
					</Button>
				</div>

				{checkRows.length > 0 ? (
					<div className="bg-md-surface-container-high divide-separator-secondary/60 divide-y rounded-xl">
						{checkRows.map(({ labelKey, item }) => (
							<div
								key={labelKey}
								className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
							>
								<div className="flex items-center gap-2.5">
									{item.ok ? (
										<CheckCircle2 className="text-success size-4 shrink-0" />
									) : (
										<XCircle className="text-danger size-4 shrink-0" />
									)}
									<span className="text-foreground text-body-medium">
										{t(labelKey)}
									</span>
								</div>
								<div className="flex items-center gap-2">
									{item.error ? (
										<span className="text-danger text-body-small">
											{item.error}
										</span>
									) : null}
									{typeof item.latencyMs === "number" ? (
										<span className="text-md-on-surface-variant font-mono text-label-small">
											{item.latencyMs} ms
										</span>
									) : null}
									<Badge
										variant="soft"
										tone={item.ok ? "success" : "danger"}
										size="sm"
									>
										{item.ok
											? t("admin.settings.storage.checkPass")
											: t("admin.settings.storage.checkFail")}
									</Badge>
								</div>
							</div>
						))}
					</div>
				) : null}
			</section>

			<section className="bg-md-surface-container flex flex-col gap-4 rounded-2xl p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<h2 className="text-foreground font-sans text-title-large-emph">
								{t("admin.settings.storage.migrateTitle")}
							</h2>
							{migration ? (
								<Badge
									variant="soft"
									tone={
										migration.status === "completed"
											? "success"
											: migration.status === "failed"
												? "danger"
												: migration.status === "running"
													? "accent"
													: "default"
									}
									size="sm"
								>
									{t(
										`admin.settings.storage.migrateStatus.${migration.status}`,
									)}
								</Badge>
							) : null}
						</div>
						<p className="text-md-on-surface-variant text-body-medium">
							{t("admin.settings.storage.migrateDescription")}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => void handleRefreshMigration()}
						>
							<RefreshCw /> {t("admin.settings.storage.migrateRefresh")}
						</Button>
						<Button
							type="button"
							variant="primary"
							disabled={migratingReq || migration?.status === "running"}
							onClick={() => void handleStartMigration()}
						>
							<ArrowRightLeft />
							{migration?.status === "running"
								? t("admin.settings.storage.migrateRunning")
								: t("admin.settings.storage.migrateStart")}
						</Button>
					</div>
				</div>

				{isDirty ? (
					<Alert variant="warning">
						<AlertIcon>
							<AlertTriangle />
						</AlertIcon>
						<AlertContent>
							<AlertDescription>
								{t("admin.settings.storage.migrateUnsavedNotice")}
							</AlertDescription>
						</AlertContent>
					</Alert>
				) : null}

				{migration && migration.status !== "idle" ? (
					<div className="bg-md-surface-container-high flex flex-col gap-3 rounded-xl p-4">
						{migrationTotal > 0 ? (
							<Progress
								value={migrationPercent}
								wavy={migration.status === "running"}
								playing={migration.status === "running"}
							/>
						) : null}
						<div className="text-foreground-secondary flex flex-wrap gap-x-6 gap-y-1 text-body-small">
							<span>
								{t("admin.settings.storage.migrateMedia", {
									migrated: migration.media.migrated,
									total: migration.media.total,
									failed: migration.media.failed,
								})}
							</span>
							<span>
								{t("admin.settings.storage.migrateThemes", {
									migrated: migration.themes.migrated,
									total: migration.themes.total,
									failed: migration.themes.failed,
								})}
							</span>
							{migration.dice ? (
								<span>
									{t("admin.settings.storage.migrateDice", {
										migrated: migration.dice.migrated,
										skipped: migration.dice.skipped,
										total: migration.dice.total,
										failed: migration.dice.failed,
									})}
								</span>
							) : null}
						</div>
						{migration.errors.length > 0 ? (
							<ul className="text-danger flex max-h-40 flex-col gap-1 overflow-y-auto text-body-small">
								{migration.errors.map((err) => (
									<li key={`${err.kind}-${err.id}`}>
										[{err.kind}] {err.name}: {err.message}
									</li>
								))}
							</ul>
						) : null}
					</div>
				) : null}
			</section>
		</div>
	);
}
