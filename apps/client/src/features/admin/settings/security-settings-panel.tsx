import type {
	SiteRateLimits,
	SiteSecuritySettingsDto,
	UpdateSecuritySettingsInput,
} from "@cogm/shared";
import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { SettingsActionBar } from "./settings-action-bar";

interface SecuritySettingsPanelProps {
	settings: SiteSecuritySettingsDto;
	overridden: boolean;
	saving: boolean;
	onSave: (input: UpdateSecuritySettingsInput) => Promise<void>;
	onRequestReset: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}

const RATE_LIMIT_KEYS: Array<keyof SiteRateLimits> = [
	"login",
	"identity",
	"join",
	"sessionReference",
	"upload",
];

function parseOrigins(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function SecuritySettingsPanel({
	settings,
	overridden,
	saving,
	onSave,
	onRequestReset,
	onDirtyChange,
}: SecuritySettingsPanelProps) {
	const [trustProxy, setTrustProxy] = useState(settings.trustProxy);
	const [corsText, setCorsText] = useState(settings.corsOrigins.join("\n"));
	const [rateLimits, setRateLimits] = useState<SiteRateLimits>(
		settings.rateLimits,
	);

	const resetDraftFromSettings = useCallback(() => {
		setTrustProxy(settings.trustProxy);
		setCorsText(settings.corsOrigins.join("\n"));
		setRateLimits(settings.rateLimits);
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
		if (trustProxy !== settings.trustProxy) {
			return true;
		}
		const currentOrigins = parseOrigins(corsText);
		if (
			currentOrigins.length !== settings.corsOrigins.length ||
			currentOrigins.some((origin, idx) => origin !== settings.corsOrigins[idx])
		) {
			return true;
		}
		return RATE_LIMIT_KEYS.some(
			(key) =>
				rateLimits[key].limit !== settings.rateLimits[key].limit ||
				rateLimits[key].windowSeconds !==
					settings.rateLimits[key].windowSeconds,
		);
	}, [trustProxy, corsText, rateLimits, settings]);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	function updateRule(
		key: keyof SiteRateLimits,
		field: "limit" | "windowSeconds",
		raw: string,
	) {
		const num = Number(raw);
		setRateLimits((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				[field]: Number.isFinite(num) ? num : 1,
			},
		}));
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const sanitized = { ...rateLimits };
		for (const key of RATE_LIMIT_KEYS) {
			sanitized[key] = {
				limit: Math.max(1, Math.min(10_000, Math.round(sanitized[key].limit))),
				windowSeconds: Math.max(
					1,
					Math.min(3_600, Math.round(sanitized[key].windowSeconds)),
				),
			};
		}
		await onSave({
			trustProxy,
			corsOrigins: parseOrigins(corsText),
			rateLimits: sanitized,
		});
	}

	return (
		<form
			noValidate
			onSubmit={(e) => void handleSubmit(e)}
			className="flex flex-col gap-6"
		>
			<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h2 className="text-foreground font-sans text-title-large-emph">
							{t("admin.settings.security.title")}
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
						{t("admin.settings.security.description")}
					</p>
				</div>

				<div className="bg-md-surface-container-high flex items-center justify-between gap-4 rounded-xl px-4 py-3">
					<div className="flex flex-col gap-0.5">
						<Label htmlFor="security-trust-proxy">
							{t("admin.settings.security.trustProxy")}
						</Label>
						<p className="text-md-on-surface-variant text-body-small">
							{t("admin.settings.security.trustProxyHint")}
						</p>
					</div>
					<Switch
						id="security-trust-proxy"
						checked={trustProxy}
						onCheckedChange={setTrustProxy}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="security-cors-origins">
						{t("admin.settings.security.corsOrigins")}
					</Label>
					<Textarea
						id="security-cors-origins"
						placeholder={t("admin.settings.security.corsPlaceholder")}
						value={corsText}
						onChange={(e) => setCorsText(e.target.value)}
					/>
					<p className="text-md-on-surface-variant text-body-small">
						{t("admin.settings.security.corsHint")}
					</p>
				</div>

				<Alert variant="warning">
					<AlertIcon>
						<ShieldAlert />
					</AlertIcon>
					<AlertContent>
						<AlertDescription>
							{t("admin.settings.security.guardNotice")}
						</AlertDescription>
					</AlertContent>
				</Alert>
			</section>

			<section className="bg-md-surface-container flex flex-col gap-5 rounded-2xl p-6">
				<div className="flex flex-col gap-1">
					<h2 className="text-foreground font-sans text-title-large-emph">
						{t("admin.settings.security.rateLimitsTitle")}
					</h2>
					<p className="text-md-on-surface-variant text-body-medium">
						{t("admin.settings.security.rateLimitsDescription")}
					</p>
				</div>

				<div className="bg-md-surface-container-high divide-separator-secondary/60 divide-y rounded-xl">
					{RATE_LIMIT_KEYS.map((key) => (
						<div
							key={key}
							className="grid items-center gap-3 px-4 py-3 md:grid-cols-[1fr_140px_140px]"
						>
							<span className="text-foreground font-sans text-body-medium">
								{t(`admin.settings.security.rateLimit.${key}`)}
							</span>
							<div className="flex flex-col gap-1">
								<Label
									htmlFor={`rl-limit-${key}`}
									className="text-md-on-surface-variant text-label-small"
								>
									{t("admin.settings.security.rateLimitMax")}
								</Label>
								<Input
									id={`rl-limit-${key}`}
									type="number"
									min={1}
									max={10000}
									value={rateLimits[key].limit}
									onChange={(e) => updateRule(key, "limit", e.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label
									htmlFor={`rl-window-${key}`}
									className="text-md-on-surface-variant text-label-small"
								>
									{t("admin.settings.security.rateLimitWindow")}
								</Label>
								<Input
									id={`rl-window-${key}`}
									type="number"
									min={1}
									max={3600}
									value={rateLimits[key].windowSeconds}
									onChange={(e) =>
										updateRule(key, "windowSeconds", e.target.value)
									}
								/>
							</div>
						</div>
					))}
				</div>
			</section>

			<SettingsActionBar
				sticky
				dirty={isDirty}
				overridden={overridden}
				saving={saving}
				scopeHint={t("admin.settings.security.saveScopeHint")}
				onDiscard={resetDraftFromSettings}
				onRequestReset={onRequestReset}
			/>
		</form>
	);
}
