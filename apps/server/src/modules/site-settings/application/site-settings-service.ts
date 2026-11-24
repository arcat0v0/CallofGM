import {
	type AdminSiteSettingsResponse,
	DEFAULT_MAX_THEME_UPLOAD_MB,
	MAX_MEDIA_UPLOAD_MB,
	type OssAccessMode,
	type PublicRuntimeConfigDto,
	type S3ConfigInput,
	type SiteRateLimits,
	type SiteSettingsSection,
	type SiteSystemInfoDto,
	type StorageMode,
	type TestStorageConnectionRequest,
	type TestStorageConnectionResponse,
	type UpdateSecuritySettingsInput,
	type UpdateSiteSettingsRequest,
	type UpdateStorageSettingsInput,
	type UpdateVoiceSettingsInput,
} from "@cogm/shared";
import type { AppConfig } from "@/config/app-config";
import { logger } from "@/platform/logging/logger";
import type { Clock } from "@/platform/ports";
import type { HttpLimits } from "@/platform/security/http-limits";
import { assertTrustedOrigin } from "@/platform/security/origin";
import {
	type EncryptedSecretEnvelope,
	isEncryptedSecretEnvelope,
	maskSecret,
	type SecretBox,
} from "@/platform/security/secret-box";
import {
	joinObjectKey,
	normalizeKeyPrefix,
	type S3ClientConfig,
	S3CompatibleClient,
} from "@/platform/storage/s3-client";
import {
	OriginLockoutError,
	StorageConfigInvalidError,
	StorageNotConfiguredError,
	StorageProbeNotFoundError,
	VoiceConfigInvalidError,
} from "../domain/errors";
import type { SiteSettingsRepository, UiThemeSettingsPort } from "./ports";

export interface EffectiveVoiceConfig {
	maxParticipants: number;
	stunUrls: string[];
	turnUrls: string[];
	turnRestSecret: string | undefined;
	turnRestSecretMask: string | null;
	turnTtlSeconds: number;
}

export interface EffectiveSecurityConfig {
	trustProxy: boolean;
	corsOrigins: string[];
	rateLimits: SiteRateLimits;
}

export interface EffectiveS3Config {
	endpoint: string;
	publicUploadEndpoint: string;
	region: string;
	bucket: string;
	forcePathStyle: boolean;
	keyPrefix: string;
	accessKeyId: string;
	secretAccessKey: string | undefined;
	secretAccessKeyMask: string | null;
	downloadBaseUrl: string;
	accessMode: OssAccessMode;
	signedUrlTtlSeconds: number;
}

export interface EffectiveStorageConfig {
	mode: StorageMode;
	maxMediaUploadMb: number;
	maxMediaUploadBytes: number;
	maxThemeUploadMb: number;
	maxThemeUploadBytes: number;
	s3: EffectiveS3Config;
}

interface StoredStoragePayload {
	mode: StorageMode;
	maxMediaUploadMb: number;
	maxThemeUploadMb: number;
	s3: {
		endpoint: string;
		publicUploadEndpoint: string;
		region: string;
		bucket: string;
		forcePathStyle: boolean;
		keyPrefix: string;
		accessKeyId: string;
		secretAccessKey: EncryptedSecretEnvelope | null;
		downloadBaseUrl: string;
		accessMode: OssAccessMode;
		signedUrlTtlSeconds: number;
	};
}

interface StoredVoicePayload {
	maxParticipants: number;
	stunUrls: string[];
	turnUrls: string[];
	turnRestSecret: EncryptedSecretEnvelope | null;
	turnTtlSeconds: number;
}

interface StoredSecurityPayload {
	trustProxy: boolean;
	corsOrigins: string[];
	rateLimits: SiteRateLimits;
}

interface BrowserProbeEntry {
	client: S3CompatibleClient;
	key: string;
	expiresAt: number;
}

const BROWSER_PROBE_TTL_MS = 5 * 60 * 1000;

function trimTrailingSlashes(url: string): string {
	return url.trim().replace(/\/+$/, "");
}

function cloneRateLimits(rules: SiteRateLimits): SiteRateLimits {
	return {
		login: { ...rules.login },
		identity: { ...rules.identity },
		join: { ...rules.join },
		sessionReference: { ...rules.sessionReference },
		upload: { ...rules.upload },
	};
}

function isS3Usable(s3: EffectiveS3Config): boolean {
	return Boolean(
		s3.endpoint &&
			s3.bucket &&
			s3.accessKeyId &&
			s3.secretAccessKey &&
			s3.downloadBaseUrl,
	);
}

function toS3ClientConfig(s3: EffectiveS3Config): S3ClientConfig {
	return {
		endpoint: s3.endpoint,
		publicUploadEndpoint: s3.publicUploadEndpoint || undefined,
		region: s3.region || "us-east-1",
		bucket: s3.bucket,
		forcePathStyle: s3.forcePathStyle,
		keyPrefix: s3.keyPrefix,
		accessKeyId: s3.accessKeyId,
		secretAccessKey: s3.secretAccessKey ?? "",
		downloadBaseUrl: s3.downloadBaseUrl,
		accessMode: s3.accessMode,
		signedUrlTtlSeconds: s3.signedUrlTtlSeconds,
	};
}

export class SiteSettingsService {
	private readonly baseRateLimits: SiteRateLimits;
	private storage: EffectiveStorageConfig;
	private voice: EffectiveVoiceConfig;
	private security: EffectiveSecurityConfig;
	private s3Client: S3CompatibleClient | null = null;
	private overriddenSections = new Set<SiteSettingsSection>();
	private updatedAt: number | null = null;
	private readonly browserProbes = new Map<string, BrowserProbeEntry>();

	constructor(
		private readonly baseConfig: AppConfig,
		private readonly repo: SiteSettingsRepository,
		private readonly secretBox: SecretBox,
		private readonly httpLimits: HttpLimits,
		private readonly clock: Clock,
		private readonly uiThemeSettings?: UiThemeSettingsPort,
		private readonly fetchImpl: typeof fetch = fetch,
	) {
		this.baseRateLimits = cloneRateLimits(this.httpLimits.getConfig());
		this.storage = this.defaultStorageConfig();
		this.voice = this.defaultVoiceConfig();
		this.security = this.defaultSecurityConfig();
		this.rebuildS3Client();
	}

	private defaultStorageConfig(): EffectiveStorageConfig {
		return {
			mode: "local",
			maxMediaUploadMb: MAX_MEDIA_UPLOAD_MB,
			maxMediaUploadBytes: MAX_MEDIA_UPLOAD_MB * 1024 * 1024,
			maxThemeUploadMb: DEFAULT_MAX_THEME_UPLOAD_MB,
			maxThemeUploadBytes: DEFAULT_MAX_THEME_UPLOAD_MB * 1024 * 1024,
			s3: {
				endpoint: "",
				publicUploadEndpoint: "",
				region: "us-east-1",
				bucket: "",
				forcePathStyle: false,
				keyPrefix: "",
				accessKeyId: "",
				secretAccessKey: undefined,
				secretAccessKeyMask: null,
				downloadBaseUrl: "",
				accessMode: "public",
				signedUrlTtlSeconds: 600,
			},
		};
	}

	private defaultVoiceConfig(): EffectiveVoiceConfig {
		const secret = this.baseConfig.voice.turnRestSecret;
		return {
			maxParticipants: this.baseConfig.voice.maxParticipants,
			stunUrls: [...this.baseConfig.voice.stunUrls],
			turnUrls: [...this.baseConfig.voice.turnUrls],
			turnRestSecret: secret,
			turnRestSecretMask: secret ? maskSecret(secret) : null,
			turnTtlSeconds: this.baseConfig.voice.turnTtlSeconds,
		};
	}

	private defaultSecurityConfig(): EffectiveSecurityConfig {
		return {
			trustProxy: this.baseConfig.trustProxy,
			corsOrigins: [...this.baseConfig.corsOrigins],
			rateLimits: cloneRateLimits(this.baseRateLimits),
		};
	}

	private rebuildS3Client(): void {
		if (isS3Usable(this.storage.s3)) {
			this.s3Client = new S3CompatibleClient(
				toS3ClientConfig(this.storage.s3),
				this.fetchImpl,
			);
		} else {
			this.s3Client = null;
		}
	}

	private decryptEnvelope(
		envelope: unknown,
		label: string,
	): { plaintext: string | undefined; mask: string | null } {
		if (!isEncryptedSecretEnvelope(envelope)) {
			return { plaintext: undefined, mask: null };
		}
		try {
			const plaintext = this.secretBox.decrypt(envelope);
			return { plaintext, mask: envelope.mask };
		} catch (error) {
			logger.error("site-settings.secret.decrypt_failed", {
				label,
				reason: error instanceof Error ? error.message : String(error),
			});
			return { plaintext: undefined, mask: null };
		}
	}

	async loadFromDb(): Promise<void> {
		this.storage = this.defaultStorageConfig();
		this.voice = this.defaultVoiceConfig();
		this.security = this.defaultSecurityConfig();
		this.overriddenSections.clear();
		this.updatedAt = null;

		const rows = await this.repo.listAll();
		for (const row of rows) {
			if (this.updatedAt === null || row.updatedAt > this.updatedAt) {
				this.updatedAt = row.updatedAt;
			}
			let parsed: unknown;
			try {
				parsed = JSON.parse(row.valueJson);
			} catch (error) {
				logger.warn("site-settings.row.parse_failed", {
					section: row.section,
					reason: error instanceof Error ? error.message : String(error),
				});
				continue;
			}

			if (row.section === "storage" && parsed && typeof parsed === "object") {
				const raw = parsed as Partial<StoredStoragePayload>;
				const s3Raw = raw.s3;
				const secret = this.decryptEnvelope(
					s3Raw?.secretAccessKey,
					"storage.s3.secretAccessKey",
				);
				const maxMediaMb =
					typeof raw.maxMediaUploadMb === "number" && raw.maxMediaUploadMb >= 1
						? Math.min(1_024, Math.round(raw.maxMediaUploadMb))
						: MAX_MEDIA_UPLOAD_MB;
				const maxThemeMb =
					typeof raw.maxThemeUploadMb === "number" && raw.maxThemeUploadMb >= 1
						? Math.min(512, Math.round(raw.maxThemeUploadMb))
						: DEFAULT_MAX_THEME_UPLOAD_MB;
				this.storage = {
					mode: raw.mode === "s3" ? "s3" : "local",
					maxMediaUploadMb: maxMediaMb,
					maxMediaUploadBytes: maxMediaMb * 1024 * 1024,
					maxThemeUploadMb: maxThemeMb,
					maxThemeUploadBytes: maxThemeMb * 1024 * 1024,
					s3: {
						endpoint: trimTrailingSlashes(s3Raw?.endpoint ?? ""),
						publicUploadEndpoint: trimTrailingSlashes(
							s3Raw?.publicUploadEndpoint ?? "",
						),
						region: (s3Raw?.region ?? "us-east-1").trim() || "us-east-1",
						bucket: (s3Raw?.bucket ?? "").trim(),
						forcePathStyle: Boolean(s3Raw?.forcePathStyle),
						keyPrefix: normalizeKeyPrefix(s3Raw?.keyPrefix ?? ""),
						accessKeyId: (s3Raw?.accessKeyId ?? "").trim(),
						secretAccessKey: secret.plaintext,
						secretAccessKeyMask: secret.mask,
						downloadBaseUrl: trimTrailingSlashes(s3Raw?.downloadBaseUrl ?? ""),
						accessMode: s3Raw?.accessMode === "private" ? "private" : "public",
						signedUrlTtlSeconds:
							typeof s3Raw?.signedUrlTtlSeconds === "number"
								? Math.max(60, Math.min(86_400, Math.round(s3Raw.signedUrlTtlSeconds)))
								: 600,
					},
				};
				this.overriddenSections.add("storage");
			} else if (
				row.section === "voice" &&
				parsed &&
				typeof parsed === "object"
			) {
				const raw = parsed as Partial<StoredVoicePayload>;
				const secret = this.decryptEnvelope(
					raw.turnRestSecret,
					"voice.turnRestSecret",
				);
				this.voice = {
					maxParticipants:
						typeof raw.maxParticipants === "number"
							? Math.max(2, Math.min(256, Math.round(raw.maxParticipants)))
							: this.baseConfig.voice.maxParticipants,
					stunUrls: Array.isArray(raw.stunUrls)
						? raw.stunUrls.filter((u): u is string => typeof u === "string")
						: [...this.baseConfig.voice.stunUrls],
					turnUrls: Array.isArray(raw.turnUrls)
						? raw.turnUrls.filter((u): u is string => typeof u === "string")
						: [...this.baseConfig.voice.turnUrls],
					turnRestSecret: secret.plaintext,
					turnRestSecretMask: secret.mask,
					turnTtlSeconds:
						typeof raw.turnTtlSeconds === "number"
							? Math.max(60, Math.min(86_400, Math.round(raw.turnTtlSeconds)))
							: this.baseConfig.voice.turnTtlSeconds,
				};
				this.overriddenSections.add("voice");
			} else if (
				row.section === "security" &&
				parsed &&
				typeof parsed === "object"
			) {
				const raw = parsed as Partial<StoredSecurityPayload>;
				this.security = {
					trustProxy:
						typeof raw.trustProxy === "boolean"
							? raw.trustProxy
							: this.baseConfig.trustProxy,
					corsOrigins: Array.isArray(raw.corsOrigins)
						? raw.corsOrigins.filter((o): o is string => typeof o === "string")
						: [...this.baseConfig.corsOrigins],
					rateLimits: raw.rateLimits
						? cloneRateLimits(raw.rateLimits)
						: cloneRateLimits(this.baseRateLimits),
				};
				this.overriddenSections.add("security");
			}
		}

		this.httpLimits.applyConfig(this.security.rateLimits);
		this.rebuildS3Client();
	}

	getStorageConfig(): EffectiveStorageConfig {
		return this.storage;
	}

	getVoiceConfig(): EffectiveVoiceConfig {
		return this.voice;
	}

	getSecurityConfig(): EffectiveSecurityConfig {
		return this.security;
	}

	getS3Client(): S3CompatibleClient | null {
		return this.s3Client;
	}

	requireS3Client(): S3CompatibleClient {
		if (!this.s3Client) {
			throw new StorageNotConfiguredError();
		}
		return this.s3Client;
	}

	getPublicRuntimeConfig(): PublicRuntimeConfigDto {
		return {
			storageMode: this.storage.mode,
			maxMediaUploadBytes: this.storage.maxMediaUploadBytes,
			maxThemeUploadBytes: this.storage.maxThemeUploadBytes,
		};
	}

	async getAdminSettings(buildInfo: {
		version: string;
		commit: string | null;
		buildTime: string | null;
	}): Promise<AdminSiteSettingsResponse> {
		const gmThemeId = this.uiThemeSettings
			? await this.uiThemeSettings.getGmThemeId()
			: null;
		const overridden = [...this.overriddenSections];
		if (gmThemeId !== null && !overridden.includes("ui")) {
			overridden.push("ui");
		}
		const system: SiteSystemInfoDto = {
			host: this.baseConfig.host ?? null,
			port: this.baseConfig.port,
			environment: this.baseConfig.environment,
			databaseUrl: this.baseConfig.databaseUrl,
			backupDir: this.baseConfig.backupDir ?? null,
			mediaDir: this.baseConfig.mediaDir,
			themesDir: this.baseConfig.themesDir,
			secretsEncryptionSource: this.secretBox.source,
			version: buildInfo.version,
			commit: buildInfo.commit,
			buildTime: buildInfo.buildTime,
		};
		return {
			storage: {
				mode: this.storage.mode,
				maxMediaUploadMb: this.storage.maxMediaUploadMb,
				maxThemeUploadMb: this.storage.maxThemeUploadMb,
				s3: {
					endpoint: this.storage.s3.endpoint,
					publicUploadEndpoint: this.storage.s3.publicUploadEndpoint,
					region: this.storage.s3.region,
					bucket: this.storage.s3.bucket,
					forcePathStyle: this.storage.s3.forcePathStyle,
					keyPrefix: this.storage.s3.keyPrefix.replace(/\/+$/, ""),
					accessKeyId: this.storage.s3.accessKeyId,
					hasSecretAccessKey: Boolean(this.storage.s3.secretAccessKey),
					secretAccessKeyMask: this.storage.s3.secretAccessKeyMask,
					downloadBaseUrl: this.storage.s3.downloadBaseUrl,
					accessMode: this.storage.s3.accessMode,
					signedUrlTtlSeconds: this.storage.s3.signedUrlTtlSeconds,
				},
			},
			voice: {
				maxParticipants: this.voice.maxParticipants,
				stunUrls: [...this.voice.stunUrls],
				turnUrls: [...this.voice.turnUrls],
				hasTurnRestSecret: Boolean(this.voice.turnRestSecret),
				turnRestSecretMask: this.voice.turnRestSecretMask,
				turnTtlSeconds: this.voice.turnTtlSeconds,
			},
			security: {
				trustProxy: this.security.trustProxy,
				corsOrigins: [...this.security.corsOrigins],
				rateLimits: cloneRateLimits(this.security.rateLimits),
			},
			ui: {
				gmThemeId,
			},
			system,
			overriddenSections: overridden,
			updatedAt: this.updatedAt,
		};
	}

	async updateSettings(
		input: UpdateSiteSettingsRequest,
		currentRequest: Request,
		buildInfo: {
			version: string;
			commit: string | null;
			buildTime: string | null;
		},
	): Promise<AdminSiteSettingsResponse> {
		const now = this.clock.nowEpochMs();

		// Pre-validate every provided section before persisting anything.
		let nextStorage: {
			effective: EffectiveStorageConfig;
			stored: StoredStoragePayload;
		} | null = null;
		if (input.storage) {
			nextStorage = this.prepareStorageUpdate(input.storage);
		}

		let nextVoice: {
			effective: EffectiveVoiceConfig;
			stored: StoredVoicePayload;
		} | null = null;
		if (input.voice) {
			nextVoice = this.prepareVoiceUpdate(input.voice);
		}

		let nextSecurity: {
			effective: EffectiveSecurityConfig;
			stored: StoredSecurityPayload;
		} | null = null;
		if (input.security) {
			nextSecurity = this.prepareSecurityUpdate(input.security, currentRequest);
		}

		if (input.ui && this.uiThemeSettings) {
			await this.uiThemeSettings.setGmThemeId(input.ui.gmThemeId);
		}

		if (nextStorage) {
			await this.repo.upsert(
				"storage",
				JSON.stringify(nextStorage.stored),
				now,
			);
			this.storage = nextStorage.effective;
			this.overriddenSections.add("storage");
			this.rebuildS3Client();
		}

		if (nextVoice) {
			await this.repo.upsert("voice", JSON.stringify(nextVoice.stored), now);
			this.voice = nextVoice.effective;
			this.overriddenSections.add("voice");
		}

		if (nextSecurity) {
			await this.repo.upsert(
				"security",
				JSON.stringify(nextSecurity.stored),
				now,
			);
			this.security = nextSecurity.effective;
			this.overriddenSections.add("security");
			this.httpLimits.applyConfig(this.security.rateLimits);
		}

		this.updatedAt = now;
		logger.audit("admin.site-settings.updated", {
			sections: [
				...(input.storage ? ["storage"] : []),
				...(input.voice ? ["voice"] : []),
				...(input.security ? ["security"] : []),
				...(input.ui ? ["ui"] : []),
			],
			storageMode: this.storage.mode,
		});

		return this.getAdminSettings(buildInfo);
	}

	async resetSettings(
		section: "all" | SiteSettingsSection,
		currentRequest: Request,
		buildInfo: {
			version: string;
			commit: string | null;
			buildTime: string | null;
		},
	): Promise<AdminSiteSettingsResponse> {
		if (section === "all" || section === "security") {
			const fallbackSecurity = this.defaultSecurityConfig();
			this.assertNoOriginLockout(
				currentRequest,
				fallbackSecurity.corsOrigins,
				fallbackSecurity.trustProxy,
			);
		}

		if (section === "all") {
			await this.repo.deleteAll();
			if (this.uiThemeSettings) {
				await this.uiThemeSettings.setGmThemeId(null);
			}
		} else if (section === "ui") {
			if (this.uiThemeSettings) {
				await this.uiThemeSettings.setGmThemeId(null);
			}
		} else {
			await this.repo.deleteSection(section);
		}

		await this.loadFromDb();
		logger.audit("admin.site-settings.reset", { section });
		return this.getAdminSettings(buildInfo);
	}

	async testStorageConnection(
		input: TestStorageConnectionRequest,
	): Promise<TestStorageConnectionResponse> {
		const effectiveS3 = input.s3
			? this.resolveCandidateS3(input.s3)
			: this.storage.s3;
		this.validateCompleteS3(effectiveS3);

		const client = new S3CompatibleClient(
			toS3ClientConfig(effectiveS3),
			this.fetchImpl,
		);
		const probeKey = joinObjectKey(
			effectiveS3.keyPrefix,
			".cogm-healthcheck",
			`${crypto.randomUUID()}.txt`,
		);
		const probeBytes = new TextEncoder().encode("cogm-s3-connectivity-probe");

		const checks: TestStorageConnectionResponse["checks"] = {
			putObject: { ok: false },
			headObject: { ok: false },
			rangeRead: { ok: false },
			downloadDomain: { ok: false },
			deleteObject: { ok: false },
		};

		let putSucceeded = false;
		const putStart = Date.now();
		try {
			await client.putObject(probeKey, probeBytes, {
				contentType: "text/plain; charset=utf-8",
				cacheControl: "no-store",
				timeoutMs: 15_000,
			});
			putSucceeded = true;
			checks.putObject = { ok: true, latencyMs: Date.now() - putStart };
		} catch (error) {
			checks.putObject = {
				ok: false,
				latencyMs: Date.now() - putStart,
				error: error instanceof Error ? error.message : String(error),
			};
		}

		if (putSucceeded) {
			const headStart = Date.now();
			try {
				const head = await client.headObject(probeKey, { timeoutMs: 15_000 });
				if (!head || head.contentLength !== probeBytes.byteLength) {
					throw new Error("HeadObject did not return expected object length");
				}
				checks.headObject = { ok: true, latencyMs: Date.now() - headStart };
			} catch (error) {
				checks.headObject = {
					ok: false,
					latencyMs: Date.now() - headStart,
					error: error instanceof Error ? error.message : String(error),
				};
			}

			const rangeStart = Date.now();
			try {
				const slice = await client.getObjectRange(probeKey, 0, 7, {
					timeoutMs: 15_000,
				});
				const decoded = new TextDecoder().decode(slice);
				if (!decoded.startsWith("cogm-s3-")) {
					throw new Error("Range GET returned unexpected bytes");
				}
				checks.rangeRead = { ok: true, latencyMs: Date.now() - rangeStart };
			} catch (error) {
				checks.rangeRead = {
					ok: false,
					latencyMs: Date.now() - rangeStart,
					error: error instanceof Error ? error.message : String(error),
				};
			}

			const downloadStart = Date.now();
			const downloadUrl =
				effectiveS3.accessMode === "private"
					? client.presignGetUrl(probeKey, {
							expiresInSeconds: 120,
							useCustomDownloadDomain: true,
						})
					: client.buildPublicUrl(probeKey);
			try {
				const res = await this.fetchImpl(downloadUrl, {
					method: "GET",
					signal: AbortSignal.timeout(15_000),
				});
				const text = await res.text().catch(() => "");
				if (!res.ok) {
					checks.downloadDomain = {
						ok: false,
						status: res.status,
						url: downloadUrl,
						latencyMs: Date.now() - downloadStart,
						error: `HTTP ${res.status}`,
					};
				} else if (text !== "cogm-s3-connectivity-probe") {
					checks.downloadDomain = {
						ok: false,
						status: res.status,
						url: downloadUrl,
						latencyMs: Date.now() - downloadStart,
						error: "Downloaded content mismatch",
					};
				} else {
					checks.downloadDomain = {
						ok: true,
						status: res.status,
						url: downloadUrl,
						latencyMs: Date.now() - downloadStart,
					};
				}
			} catch (error) {
				checks.downloadDomain = {
					ok: false,
					url: downloadUrl,
					latencyMs: Date.now() - downloadStart,
					error: error instanceof Error ? error.message : String(error),
				};
			}

			const delStart = Date.now();
			try {
				await client.deleteObject(probeKey, { timeoutMs: 15_000 });
				checks.deleteObject = { ok: true, latencyMs: Date.now() - delStart };
			} catch (error) {
				checks.deleteObject = {
					ok: false,
					latencyMs: Date.now() - delStart,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		let browserProbe: TestStorageConnectionResponse["browserProbe"] = null;
		if (checks.putObject.ok && checks.headObject.ok) {
			this.sweepExpiredProbes();
			const probeToken = crypto.randomUUID();
			const browserProbeKey = joinObjectKey(
				effectiveS3.keyPrefix,
				".cogm-healthcheck",
				`browser-${probeToken}.txt`,
			);
			const probeContent = `cogm-browser-probe-${probeToken}`;
			const presignedPut = client.presignPutUrl(browserProbeKey, {
				contentType: "text/plain",
				expiresInSeconds: 300,
				usePublicUploadEndpoint: true,
			});
			const browserDownloadUrl =
				effectiveS3.accessMode === "private"
					? client.presignGetUrl(browserProbeKey, {
							expiresInSeconds: 300,
							useCustomDownloadDomain: true,
						})
					: client.buildPublicUrl(browserProbeKey);
			this.browserProbes.set(probeToken, {
				client,
				key: browserProbeKey,
				expiresAt: this.clock.nowEpochMs() + BROWSER_PROBE_TTL_MS,
			});
			browserProbe = {
				uploadUrl: presignedPut.url,
				downloadUrl: browserDownloadUrl,
				headers: presignedPut.headers,
				probeToken,
				probeContent,
			};
		}

		const ok =
			checks.putObject.ok &&
			checks.headObject.ok &&
			checks.rangeRead.ok &&
			checks.downloadDomain.ok &&
			checks.deleteObject.ok;

		return { ok, checks, browserProbe };
	}

	async cleanupBrowserProbe(probeToken: string): Promise<void> {
		this.sweepExpiredProbes();
		const entry = this.browserProbes.get(probeToken);
		if (!entry) {
			throw new StorageProbeNotFoundError();
		}
		this.browserProbes.delete(probeToken);
		await entry.client.deleteObject(entry.key).catch(() => undefined);
	}

	private sweepExpiredProbes(): void {
		const now = this.clock.nowEpochMs();
		for (const [token, entry] of this.browserProbes) {
			if (entry.expiresAt <= now) {
				this.browserProbes.delete(token);
				void entry.client.deleteObject(entry.key).catch(() => undefined);
			}
		}
	}

	private resolveCandidateS3(input: S3ConfigInput): EffectiveS3Config {
		let secretAccessKey = this.storage.s3.secretAccessKey;
		let secretAccessKeyMask = this.storage.s3.secretAccessKeyMask;
		if (input.clearSecretAccessKey) {
			secretAccessKey = undefined;
			secretAccessKeyMask = null;
		} else if (input.secretAccessKey && input.secretAccessKey.trim() !== "") {
			secretAccessKey = input.secretAccessKey.trim();
			secretAccessKeyMask = maskSecret(secretAccessKey);
		}
		return {
			endpoint: trimTrailingSlashes(input.endpoint),
			publicUploadEndpoint: trimTrailingSlashes(input.publicUploadEndpoint),
			region: input.region.trim() || "us-east-1",
			bucket: input.bucket.trim(),
			forcePathStyle: input.forcePathStyle,
			keyPrefix: normalizeKeyPrefix(input.keyPrefix),
			accessKeyId: input.accessKeyId.trim(),
			secretAccessKey,
			secretAccessKeyMask,
			downloadBaseUrl: trimTrailingSlashes(input.downloadBaseUrl),
			accessMode: input.accessMode,
			signedUrlTtlSeconds: input.signedUrlTtlSeconds,
		};
	}

	private validateCompleteS3(s3: EffectiveS3Config): void {
		const missing: string[] = [];
		if (!s3.endpoint) missing.push("endpoint");
		if (!s3.bucket) missing.push("bucket");
		if (!s3.accessKeyId) missing.push("accessKeyId");
		if (!s3.secretAccessKey) missing.push("secretAccessKey");
		if (!s3.downloadBaseUrl) missing.push("downloadBaseUrl");
		if (missing.length > 0) {
			throw new StorageConfigInvalidError(
				`OSS configuration is incomplete: missing ${missing.join(", ")}`,
				{ missing },
			);
		}
	}

	private prepareStorageUpdate(input: UpdateStorageSettingsInput): {
		effective: EffectiveStorageConfig;
		stored: StoredStoragePayload;
	} {
		const s3 = this.resolveCandidateS3(input.s3);
		if (input.mode === "s3") {
			this.validateCompleteS3(s3);
		}
		const effective: EffectiveStorageConfig = {
			mode: input.mode,
			maxMediaUploadMb: input.maxMediaUploadMb,
			maxMediaUploadBytes: input.maxMediaUploadMb * 1024 * 1024,
			maxThemeUploadMb: input.maxThemeUploadMb,
			maxThemeUploadBytes: input.maxThemeUploadMb * 1024 * 1024,
			s3,
		};
		const stored: StoredStoragePayload = {
			mode: effective.mode,
			maxMediaUploadMb: effective.maxMediaUploadMb,
			maxThemeUploadMb: effective.maxThemeUploadMb,
			s3: {
				endpoint: s3.endpoint,
				publicUploadEndpoint: s3.publicUploadEndpoint,
				region: s3.region,
				bucket: s3.bucket,
				forcePathStyle: s3.forcePathStyle,
				keyPrefix: s3.keyPrefix,
				accessKeyId: s3.accessKeyId,
				secretAccessKey: s3.secretAccessKey
					? this.secretBox.encrypt(s3.secretAccessKey)
					: null,
				downloadBaseUrl: s3.downloadBaseUrl,
				accessMode: s3.accessMode,
				signedUrlTtlSeconds: s3.signedUrlTtlSeconds,
			},
		};
		return { effective, stored };
	}

	private prepareVoiceUpdate(input: UpdateVoiceSettingsInput): {
		effective: EffectiveVoiceConfig;
		stored: StoredVoicePayload;
	} {
		let turnRestSecret = this.voice.turnRestSecret;
		let turnRestSecretMask = this.voice.turnRestSecretMask;
		if (input.clearTurnRestSecret) {
			turnRestSecret = undefined;
			turnRestSecretMask = null;
		} else if (input.turnRestSecret && input.turnRestSecret.trim() !== "") {
			turnRestSecret = input.turnRestSecret.trim();
			turnRestSecretMask = maskSecret(turnRestSecret);
		}

		const hasTurnUrls = input.turnUrls.length > 0;
		const hasTurnSecret = Boolean(turnRestSecret);
		if (hasTurnUrls && !hasTurnSecret) {
			throw new VoiceConfigInvalidError(
				"TURN URLs require turnRestSecret to be configured",
			);
		}

		const effective: EffectiveVoiceConfig = {
			maxParticipants: input.maxParticipants,
			stunUrls: [...input.stunUrls],
			turnUrls: [...input.turnUrls],
			turnRestSecret,
			turnRestSecretMask,
			turnTtlSeconds: input.turnTtlSeconds,
		};
		const stored: StoredVoicePayload = {
			maxParticipants: effective.maxParticipants,
			stunUrls: effective.stunUrls,
			turnUrls: effective.turnUrls,
			turnRestSecret: turnRestSecret
				? this.secretBox.encrypt(turnRestSecret)
				: null,
			turnTtlSeconds: effective.turnTtlSeconds,
		};
		return { effective, stored };
	}

	private assertNoOriginLockout(
		request: Request,
		corsOrigins: string[],
		trustProxy: boolean,
	): void {
		const hasOriginOrReferer =
			Boolean(request.headers.get("origin")) ||
			Boolean(request.headers.get("referer"));
		if (!hasOriginOrReferer) {
			return;
		}
		try {
			assertTrustedOrigin(request, corsOrigins, trustProxy);
		} catch {
			throw new OriginLockoutError();
		}
	}

	private prepareSecurityUpdate(
		input: UpdateSecuritySettingsInput,
		currentRequest: Request,
	): {
		effective: EffectiveSecurityConfig;
		stored: StoredSecurityPayload;
	} {
		this.assertNoOriginLockout(
			currentRequest,
			input.corsOrigins,
			input.trustProxy,
		);
		const effective: EffectiveSecurityConfig = {
			trustProxy: input.trustProxy,
			corsOrigins: [...input.corsOrigins],
			rateLimits: cloneRateLimits(input.rateLimits),
		};
		const stored: StoredSecurityPayload = {
			trustProxy: effective.trustProxy,
			corsOrigins: effective.corsOrigins,
			rateLimits: effective.rateLimits,
		};
		return { effective, stored };
	}
}
