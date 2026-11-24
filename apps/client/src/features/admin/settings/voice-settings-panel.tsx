import type {
	SiteVoiceSettingsDto,
	UpdateVoiceSettingsInput,
} from "@cogm/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { SettingsActionBar } from "./settings-action-bar";

interface VoiceSettingsPanelProps {
	settings: SiteVoiceSettingsDto;
	overridden: boolean;
	saving: boolean;
	onSave: (input: UpdateVoiceSettingsInput) => Promise<void>;
	onRequestReset: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}

function parseLines(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function sameStringList(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((item, idx) => item === b[idx]);
}

export function VoiceSettingsPanel({
	settings,
	overridden,
	saving,
	onSave,
	onRequestReset,
	onDirtyChange,
}: VoiceSettingsPanelProps) {
	const [maxParticipants, setMaxParticipants] = useState(
		String(settings.maxParticipants),
	);
	const [turnTtlSeconds, setTurnTtlSeconds] = useState(
		String(settings.turnTtlSeconds),
	);
	const [stunText, setStunText] = useState(settings.stunUrls.join("\n"));
	const [turnText, setTurnText] = useState(settings.turnUrls.join("\n"));
	const [turnRestSecret, setTurnRestSecret] = useState("");
	const [clearTurnRestSecret, setClearTurnRestSecret] = useState(false);

	const resetDraftFromSettings = useCallback(() => {
		setMaxParticipants(String(settings.maxParticipants));
		setTurnTtlSeconds(String(settings.turnTtlSeconds));
		setStunText(settings.stunUrls.join("\n"));
		setTurnText(settings.turnUrls.join("\n"));
		setTurnRestSecret("");
		setClearTurnRestSecret(false);
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
			maxParticipants.trim() !== String(settings.maxParticipants) ||
			turnTtlSeconds.trim() !== String(settings.turnTtlSeconds) ||
			!sameStringList(parseLines(stunText), settings.stunUrls) ||
			!sameStringList(parseLines(turnText), settings.turnUrls) ||
			turnRestSecret.trim().length > 0 ||
			clearTurnRestSecret
		);
	}, [
		maxParticipants,
		turnTtlSeconds,
		stunText,
		turnText,
		turnRestSecret,
		clearTurnRestSecret,
		settings,
	]);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		await onSave({
			maxParticipants: Math.max(2, Math.min(256, Number(maxParticipants) || 8)),
			turnTtlSeconds: Math.max(
				60,
				Math.min(86_400, Number(turnTtlSeconds) || 600),
			),
			stunUrls: parseLines(stunText),
			turnUrls: parseLines(turnText),
			...(turnRestSecret.trim()
				? { turnRestSecret: turnRestSecret.trim() }
				: {}),
			...(clearTurnRestSecret ? { clearTurnRestSecret: true } : {}),
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
							{t("admin.settings.voice.title")}
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
						{t("admin.settings.voice.description")}
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="voice-max-participants">
							{t("admin.settings.voice.maxParticipants")}
						</Label>
						<Input
							id="voice-max-participants"
							type="number"
							min={2}
							max={256}
							value={maxParticipants}
							onChange={(e) => setMaxParticipants(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="voice-turn-ttl">
							{t("admin.settings.voice.turnTtl")}
						</Label>
						<Input
							id="voice-turn-ttl"
							type="number"
							min={60}
							max={86400}
							value={turnTtlSeconds}
							onChange={(e) => setTurnTtlSeconds(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="voice-stun-urls">
							{t("admin.settings.voice.stunUrls")}
						</Label>
						<Textarea
							id="voice-stun-urls"
							placeholder={t("admin.settings.voice.stunPlaceholder")}
							value={stunText}
							onChange={(e) => setStunText(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="voice-turn-urls">
							{t("admin.settings.voice.turnUrls")}
						</Label>
						<Textarea
							id="voice-turn-urls"
							placeholder={t("admin.settings.voice.turnPlaceholder")}
							value={turnText}
							onChange={(e) => setTurnText(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-2 md:col-span-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<Label htmlFor="voice-turn-secret">
								{t("admin.settings.voice.turnSecret")}
							</Label>
							{settings.hasTurnRestSecret && !clearTurnRestSecret ? (
								<Badge variant="soft" tone="success" size="sm">
									{t("admin.settings.storage.secretConfigured", {
										mask: settings.turnRestSecretMask ?? "****",
									})}
								</Badge>
							) : null}
						</div>
						<Input
							id="voice-turn-secret"
							type="password"
							autoComplete="new-password"
							placeholder={
								settings.hasTurnRestSecret && !clearTurnRestSecret
									? t("admin.settings.storage.secretKeepPlaceholder")
									: t("admin.settings.voice.turnSecretPlaceholder")
							}
							value={turnRestSecret}
							onChange={(e) => {
								setTurnRestSecret(e.target.value);
								if (e.target.value) setClearTurnRestSecret(false);
							}}
						/>
						{settings.hasTurnRestSecret ? (
							<div className="flex items-center gap-3 pt-1">
								<Switch
									id="voice-clear-secret"
									size="sm"
									checked={clearTurnRestSecret}
									onCheckedChange={(checked) => {
										setClearTurnRestSecret(checked);
										if (checked) setTurnRestSecret("");
									}}
								/>
								<Label htmlFor="voice-clear-secret" className="text-body-small">
									{t("admin.settings.storage.clearSecret")}
								</Label>
							</div>
						) : null}
					</div>
				</div>
			</section>

			<SettingsActionBar
				sticky
				dirty={isDirty}
				overridden={overridden}
				saving={saving}
				onDiscard={resetDraftFromSettings}
				onRequestReset={onRequestReset}
			/>
		</form>
	);
}
