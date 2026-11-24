import { createHash } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import {
	DEFAULT_MAX_THEME_UPLOAD_MB,
	THEME_API_VERSION,
	ThemeManifest,
	ThemeVersion,
} from "@cogm/shared";
import { type UnzipFileInfo, unzipSync } from "fflate";
import { logger } from "@/platform/logging/logger";
import type { Clock } from "@/platform/ports";
import {
	joinObjectKey,
	type S3CompatibleClient,
} from "@/platform/storage/s3-client";
import type {
	StoredThemeMetadata,
	ThemeMetadataRepository,
} from "../application/theme-metadata-repository";
import {
	ThemeIncompatibleError,
	ThemeInvalidError,
	ThemeTooLargeError,
	ThemeVersionConflictError,
} from "../domain/errors";

const DEFAULT_MAX_ARCHIVE_BYTES = DEFAULT_MAX_THEME_UPLOAD_MB * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const KEEP_VERSIONS = 2;

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg|ico)$/i;
const FONT_EXTENSIONS = /\.(?:woff2?|ttf|otf)$/i;
const ROOT_FILES = new Set([
	"theme.json",
	"bundle.js",
	"README.md",
	"preview.png",
]);

export type InstalledTheme = {
	manifest: ThemeManifest;
	digest: string;
	installedAt: number;
	hasPreview: boolean;
	storageProvider: "local" | "s3";
	storagePrefix: string;
};

export type ResolvedThemeAsset =
	| { kind: "local"; filePath: string }
	| { kind: "redirect"; url: string; cacheControl: string };

export interface ThemeRuntimeStoragePort {
	getStorageConfig(): {
		mode: "local" | "s3";
		maxThemeUploadBytes: number;
		s3: {
			keyPrefix: string;
			accessMode: "public" | "private";
			signedUrlTtlSeconds: number;
		};
	};
	getS3Client(): S3CompatibleClient | null;
}

type StoredTheme = InstalledTheme & {
	versionDir: string | null;
	files: string[];
};

function hash(data: Uint8Array | string): string {
	return createHash("sha256").update(data).digest("hex");
}

function isSafeEntry(name: string): boolean {
	if (!name || name.includes("\\") || name.startsWith("/")) {
		return false;
	}
	const parts = name.split("/");
	return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

function isAllowedEntry(name: string): boolean {
	if (!isSafeEntry(name)) {
		return false;
	}
	if (name.endsWith("/")) {
		return true;
	}
	if (ROOT_FILES.has(name)) {
		return true;
	}
	if (/^[^/]+\.css$/i.test(name)) {
		return true;
	}
	if (name.startsWith("assets/")) {
		return IMAGE_EXTENSIONS.test(name) || FONT_EXTENSIONS.test(name);
	}
	return false;
}

function contentTypeFor(path: string): string {
	const extension = path.split(".").pop()?.toLowerCase() ?? "";
	switch (extension) {
		case "js":
			return "text/javascript; charset=utf-8";
		case "css":
			return "text/css; charset=utf-8";
		case "json":
			return "application/json; charset=utf-8";
		case "png":
			return "image/png";
		case "jpg":
			return "image/jpeg";
		case "jpeg":
			return "image/jpeg";
		case "webp":
			return "image/webp";
		case "gif":
			return "image/gif";
		case "svg":
			return "image/svg+xml";
		case "ico":
			return "image/x-icon";
		case "woff":
			return "font/woff";
		case "woff2":
			return "font/woff2";
		case "ttf":
			return "font/ttf";
		case "otf":
			return "font/otf";
		default:
			return "application/octet-stream";
	}
}

async function listLocalFilesRecursive(
	baseDir: string,
	prefix = "",
): Promise<string[]> {
	const entries = await readdir(join(baseDir, prefix), {
		withFileTypes: true,
	});
	const result: string[] = [];
	for (const entry of entries) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			result.push(...(await listLocalFilesRecursive(baseDir, rel)));
		} else if (entry.isFile() && isAllowedEntry(rel)) {
			result.push(rel);
		}
	}
	return result;
}

function stripRuntimeManifestFields(manifest: ThemeManifest): ThemeManifest {
	const { assetBaseUrl: _ignored, ...clean } = manifest;
	return clean;
}

export class ThemeRegistry {
	private readonly themes = new Map<string, StoredTheme>();
	private readonly versionsById = new Map<string, Map<string, StoredTheme>>();
	private initPromise: Promise<void> | null = null;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly rootDir: string,
		private readonly clock: Clock,
		private readonly metadataRepo?: ThemeMetadataRepository,
		private readonly runtimeStorage?: ThemeRuntimeStoragePort,
	) {}

	async ready(): Promise<void> {
		if (!this.initPromise) {
			this.initPromise = this.scan();
		}
		await this.initPromise;
	}

	async rescan(): Promise<void> {
		this.initPromise = this.scan();
		await this.initPromise;
	}

	list(): InstalledTheme[] {
		return [...this.themes.values()]
			.map(({ versionDir: _v, files: _f, ...theme }) => theme)
			.sort((left, right) =>
				left.manifest.name.localeCompare(right.manifest.name),
			);
	}

	get(id: string): InstalledTheme | null {
		const theme = this.themes.get(id);
		if (!theme) {
			return null;
		}
		const { versionDir: _v, files: _f, ...rest } = theme;
		return rest;
	}

	has(id: string): boolean {
		return this.themes.has(id);
	}

	getMaxArchiveBytes(): number {
		return (
			this.runtimeStorage?.getStorageConfig().maxThemeUploadBytes ??
			DEFAULT_MAX_ARCHIVE_BYTES
		);
	}

	resolveManifest(id: string): ThemeManifest | null {
		const theme = this.themes.get(id);
		if (!theme) {
			return null;
		}
		const clean = stripRuntimeManifestFields(theme.manifest);
		if (theme.storageProvider === "s3" && theme.storagePrefix) {
			const s3Client = this.runtimeStorage?.getS3Client() ?? null;
			const accessMode =
				this.runtimeStorage?.getStorageConfig().s3.accessMode ?? "public";
			if (s3Client && accessMode === "public") {
				return {
					...clean,
					assetBaseUrl: s3Client.buildPublicPrefixUrl(theme.storagePrefix),
				};
			}
		}
		return clean;
	}

	resolvePreviewUrl(theme: InstalledTheme): string | null {
		if (!theme.hasPreview) {
			return null;
		}
		if (theme.storageProvider === "s3" && theme.storagePrefix) {
			const s3Client = this.runtimeStorage?.getS3Client() ?? null;
			const accessMode =
				this.runtimeStorage?.getStorageConfig().s3.accessMode ?? "public";
			if (s3Client && accessMode === "public") {
				return s3Client.buildPublicUrl(`${theme.storagePrefix}/preview.png`);
			}
		}
		return `/api/v1/themes/${encodeURIComponent(theme.manifest.id)}/versions/${encodeURIComponent(theme.manifest.version)}/preview.png`;
	}

	async resolveAsset(
		id: string,
		version: string,
		relativePath: string,
	): Promise<ResolvedThemeAsset | null> {
		await this.ready();
		if (
			!this.themes.has(id) ||
			!ThemeVersion.safeParse(version).success ||
			!isAllowedEntry(relativePath) ||
			relativePath.endsWith("/")
		) {
			return null;
		}
		const storedVersion = this.versionsById.get(id)?.get(version);
		if (storedVersion?.storageProvider === "s3" && storedVersion.storagePrefix) {
			if (
				storedVersion.files.length > 0 &&
				!storedVersion.files.includes(relativePath)
			) {
				return null;
			}
			const s3Client = this.runtimeStorage?.getS3Client() ?? null;
			if (!s3Client) {
				return null;
			}
			const s3Config = this.runtimeStorage!.getStorageConfig().s3;
			const objectKey = joinObjectKey(storedVersion.storagePrefix, relativePath);
			if (s3Config.accessMode === "private") {
				return {
					kind: "redirect",
					url: s3Client.presignGetUrl(objectKey, {
						expiresInSeconds: s3Config.signedUrlTtlSeconds,
						useCustomDownloadDomain: true,
					}),
					cacheControl: "private, no-store",
				};
			}
			return {
				kind: "redirect",
				url: s3Client.buildPublicUrl(objectKey),
				cacheControl: "public, max-age=300",
			};
		}

		const localPath = await this.filePath(id, version, relativePath);
		if (!localPath) {
			return null;
		}
		return { kind: "local", filePath: localPath };
	}

	async filePath(
		id: string,
		version: string,
		relativePath: string,
	): Promise<string | null> {
		await this.ready();
		if (!this.themes.has(id)) {
			return null;
		}
		if (
			!ThemeVersion.safeParse(version).success ||
			!isAllowedEntry(relativePath) ||
			relativePath.endsWith("/")
		) {
			return null;
		}
		const versionDir = resolve(this.rootDir, id, version);
		const target = resolve(versionDir, relativePath);
		if (target !== versionDir && !target.startsWith(`${versionDir}${sep}`)) {
			return null;
		}
		try {
			const info = await stat(target);
			return info.isFile() ? target : null;
		} catch {
			return null;
		}
	}

	async install(archive: Uint8Array): Promise<InstalledTheme> {
		return this.withLock(async () => {
			await this.ready();
			const maxArchiveBytes = this.getMaxArchiveBytes();
			if (archive.byteLength > maxArchiveBytes) {
				throw new ThemeTooLargeError();
			}

			let totalBytes = 0;
			let entries = 0;
			let rejected = false;
			let files: Record<string, Uint8Array>;
			try {
				files = unzipSync(archive, {
					filter: (file: UnzipFileInfo) => {
						entries += 1;
						if (entries > MAX_ENTRIES || !isAllowedEntry(file.name)) {
							rejected = true;
							return false;
						}
						const size = file.originalSize ?? 0;
						if (size > MAX_FILE_BYTES) {
							rejected = true;
							return false;
						}
						totalBytes += size;
						if (totalBytes > MAX_TOTAL_BYTES) {
							rejected = true;
							return false;
						}
						return true;
					},
				});
			} catch (error) {
				throw new ThemeInvalidError("无法解压主题包", {
					reason: error instanceof Error ? error.message : String(error),
				});
			}
			if (rejected) {
				throw new ThemeInvalidError("主题包包含不允许或过大的文件");
			}

			for (const [name, data] of Object.entries(files)) {
				if (data.byteLength > MAX_FILE_BYTES) {
					throw new ThemeTooLargeError(`主题文件 ${name} 超过大小限制`);
				}
				if (!isAllowedEntry(name)) {
					throw new ThemeInvalidError(`主题包含不允许的文件：${name}`);
				}
			}

			const manifestBytes = files["theme.json"];
			const bundleBytes = files["bundle.js"];
			if (!manifestBytes || !bundleBytes) {
				throw new ThemeInvalidError("主题包缺少 theme.json 或 bundle.js");
			}

			let rawManifest: unknown;
			try {
				rawManifest = JSON.parse(new TextDecoder().decode(manifestBytes));
			} catch {
				throw new ThemeInvalidError("theme.json 不是有效 JSON");
			}
			const parsed = ThemeManifest.safeParse(rawManifest);
			if (!parsed.success) {
				throw new ThemeInvalidError("theme.json 不符合主题格式", {
					issues: parsed.error.issues.map((issue) => issue.path.join(".")),
				});
			}
			const manifest = stripRuntimeManifestFields(parsed.data);
			if (manifest.apiVersion !== THEME_API_VERSION) {
				throw new ThemeIncompatibleError();
			}
			const actualHash = `sha256:${hash(bundleBytes)}`;
			if (actualHash !== manifest.bundleHash) {
				throw new ThemeInvalidError("bundleHash 与 bundle.js 不一致");
			}
			for (const style of manifest.styles) {
				if (!files[style]) {
					throw new ThemeInvalidError(`样式文件不存在：${style}`);
				}
				if (!style.endsWith(".css")) {
					throw new ThemeInvalidError(`样式文件必须是 CSS：${style}`);
				}
			}
			if (manifest.icon && !files[manifest.icon]) {
				throw new ThemeInvalidError(`图标文件不存在：${manifest.icon}`);
			}

			const existing = this.themes.get(manifest.id);
			if (
				existing &&
				Bun.semver.order(manifest.version, existing.manifest.version) <= 0
			) {
				throw new ThemeVersionConflictError();
			}

			const normalizedManifestText = `${JSON.stringify(manifest, null, 2)}\n`;
			const normalizedManifestBytes = new TextEncoder().encode(
				normalizedManifestText,
			);
			const fileEntries = Object.entries(files).filter(
				([name]) => !name.endsWith("/"),
			);
			const fileNames = Array.from(
				new Set([...fileEntries.map(([name]) => name), "theme.json"]),
			).sort();

			const now = this.clock.nowEpochMs();
			const storageMode =
				this.runtimeStorage?.getStorageConfig().mode ?? "local";

			let installed: StoredTheme;

			if (storageMode === "s3") {
				const s3Client = this.runtimeStorage?.getS3Client() ?? null;
				if (!s3Client) {
					throw new ThemeInvalidError("对象存储已启用但未完成配置");
				}
				const s3Prefix = joinObjectKey(
					this.runtimeStorage!.getStorageConfig().s3.keyPrefix,
					"themes",
					manifest.id,
					manifest.version,
				);
				const uploadedKeys: string[] = [];
				try {
					for (const [name, data] of fileEntries) {
						const payload =
							name === "theme.json" ? normalizedManifestBytes : data;
						const key = joinObjectKey(s3Prefix, name);
						await s3Client.putObject(key, payload, {
							contentType: contentTypeFor(name),
							cacheControl: "public, max-age=31536000, immutable",
						});
						uploadedKeys.push(key);
					}
					if (!files["theme.json"]) {
						const key = joinObjectKey(s3Prefix, "theme.json");
						await s3Client.putObject(key, normalizedManifestBytes, {
							contentType: contentTypeFor("theme.json"),
							cacheControl: "public, max-age=31536000, immutable",
						});
						uploadedKeys.push(key);
					}
				} catch (error) {
					for (const key of uploadedKeys) {
						await s3Client.deleteObject(key).catch(() => undefined);
					}
					throw new ThemeInvalidError("无法上传主题文件到对象存储", {
						reason: error instanceof Error ? error.message : String(error),
					});
				}

				installed = {
					manifest,
					digest: manifest.bundleHash,
					installedAt: now,
					hasPreview: Boolean(files["preview.png"]),
					storageProvider: "s3",
					storagePrefix: s3Prefix,
					versionDir: null,
					files: fileNames,
				};
				await this.persistMetadata(installed);
			} else {
				await mkdir(join(this.rootDir, ".tmp"), { recursive: true });
				const tempDir = join(this.rootDir, ".tmp", crypto.randomUUID());
				const versionDir = join(this.rootDir, manifest.id, manifest.version);
				try {
					await mkdir(tempDir, { recursive: true });
					for (const [name, data] of fileEntries) {
						const target = join(tempDir, name);
						if (!target.startsWith(`${tempDir}${sep}`)) {
							throw new ThemeInvalidError(`非法路径：${name}`);
						}
						await mkdir(dirname(target), { recursive: true });
						await writeFile(target, data);
					}
					const manifestFile = join(tempDir, "theme.json");
					await writeFile(manifestFile, normalizedManifestText);
					await mkdir(dirname(versionDir), { recursive: true });
					await rename(tempDir, versionDir);
				} catch (error) {
					await rm(tempDir, { recursive: true, force: true });
					if (
						error instanceof ThemeInvalidError ||
						error instanceof ThemeVersionConflictError
					) {
						throw error;
					}
					throw new ThemeInvalidError("无法写入主题文件", {
						reason: error instanceof Error ? error.message : String(error),
					});
				}

				installed = {
					manifest,
					digest: manifest.bundleHash,
					installedAt: now,
					hasPreview: Boolean(files["preview.png"]),
					storageProvider: "local",
					storagePrefix: "",
					versionDir,
					files: fileNames,
				};
				await this.persistMetadata(installed);
			}

			this.recordVersion(installed);
			await this.pruneVersions(manifest.id);
			logger.info("theme installed", {
				themeId: manifest.id,
				version: manifest.version,
				storageProvider: installed.storageProvider,
			});
			const { versionDir: _v, files: _f, ...summary } = installed;
			return summary;
		});
	}

	async remove(id: string): Promise<void> {
		return this.withLock(async () => {
			await this.ready();
			if (!this.themes.has(id)) {
				return;
			}
			const versions = this.versionsById.get(id);
			const s3Client = this.runtimeStorage?.getS3Client() ?? null;
			if (versions && s3Client) {
				for (const item of versions.values()) {
					if (item.storageProvider === "s3" && item.storagePrefix) {
						for (const rel of item.files) {
							const key = joinObjectKey(item.storagePrefix, rel);
							await s3Client.deleteObject(key).catch(() => undefined);
						}
					}
				}
			}
			await rm(join(this.rootDir, id), { recursive: true, force: true }).catch(
				() => undefined,
			);
			await this.metadataRepo?.deleteById(id);
			this.versionsById.delete(id);
			this.themes.delete(id);
			logger.info("theme removed", { themeId: id });
		});
	}

	async migrateLocalThemesToS3(
		client: S3CompatibleClient,
		onProgress?: (progress: {
			total: number;
			migrated: number;
			skipped: number;
			failed: number;
		}) => void,
	): Promise<{
		total: number;
		migrated: number;
		skipped: number;
		failed: number;
		errors: Array<{ id: string; name: string; message: string }>;
	}> {
		return this.withLock(async () => {
			await this.ready();
			const targets: StoredTheme[] = [];
			for (const versions of this.versionsById.values()) {
				for (const item of versions.values()) {
					if (item.storageProvider === "local" && item.versionDir) {
						targets.push(item);
					}
				}
			}

			const progress = {
				total: targets.length,
				migrated: 0,
				skipped: 0,
				failed: 0,
			};
			const errors: Array<{ id: string; name: string; message: string }> = [];
			onProgress?.({ ...progress });

			for (const item of targets) {
				try {
					const versionDir = item.versionDir!;
					const relFiles = await listLocalFilesRecursive(versionDir);
					const s3Prefix = joinObjectKey(
						client.config.keyPrefix,
						"themes",
						item.manifest.id,
						item.manifest.version,
					);
					for (const rel of relFiles) {
						const data = new Uint8Array(await readFile(join(versionDir, rel)));
						const key = joinObjectKey(s3Prefix, rel);
						await client.putObject(key, data, {
							contentType: contentTypeFor(rel),
							cacheControl: "public, max-age=31536000, immutable",
						});
					}
					const updated: StoredTheme = {
						...item,
						storageProvider: "s3",
						storagePrefix: s3Prefix,
						files: relFiles,
					};
					await this.persistMetadata(updated);
					this.recordVersion(updated);
					progress.migrated += 1;
				} catch (error) {
					progress.failed += 1;
					errors.push({
						id: `${item.manifest.id}@${item.manifest.version}`,
						name: `${item.manifest.name} (${item.manifest.version})`,
						message: error instanceof Error ? error.message : String(error),
					});
				}
				onProgress?.({ ...progress });
			}

			return { ...progress, errors };
		});
	}

	async previewPath(id: string): Promise<string | null> {
		await this.ready();
		const theme = this.themes.get(id);
		if (!theme || !theme.versionDir) {
			return null;
		}
		const path = resolve(theme.versionDir, "preview.png");
		try {
			const info = await stat(path);
			return info.isFile() ? path : null;
		} catch {
			return null;
		}
	}

	static contentType(path: string): string {
		return contentTypeFor(path);
	}

	private withLock<T>(operation: () => Promise<T>): Promise<T> {
		const next = this.queue.then(operation, operation);
		this.queue = next.catch(() => undefined);
		return next;
	}

	private recordVersion(theme: StoredTheme): void {
		let map = this.versionsById.get(theme.manifest.id);
		if (!map) {
			map = new Map();
			this.versionsById.set(theme.manifest.id, map);
		}
		map.set(theme.manifest.version, theme);
		const sorted = [...map.values()].sort((left, right) =>
			Bun.semver.order(right.manifest.version, left.manifest.version),
		);
		if (sorted[0]) {
			this.themes.set(theme.manifest.id, sorted[0]);
		}
	}

	private async persistMetadata(theme: StoredTheme): Promise<void> {
		if (!this.metadataRepo) {
			return;
		}
		const clean = stripRuntimeManifestFields(theme.manifest);
		const record: StoredThemeMetadata = {
			key: `${clean.id}@${clean.version}`,
			id: clean.id,
			version: clean.version,
			manifestJson: JSON.stringify(clean),
			digest: theme.digest,
			hasPreview: theme.hasPreview,
			storageProvider: theme.storageProvider,
			storagePrefix: theme.storagePrefix,
			files: theme.files,
			installedAt: theme.installedAt,
		};
		await this.metadataRepo.upsert(record);
	}

	private async scan(): Promise<void> {
		this.themes.clear();
		this.versionsById.clear();

		// 1. Scan local themes directory
		await mkdir(this.rootDir, { recursive: true });
		const idEntries = await readdir(this.rootDir, { withFileTypes: true });
		for (const idEntry of idEntries) {
			if (!idEntry.isDirectory() || idEntry.name.startsWith(".")) {
				continue;
			}
			const idDir = join(this.rootDir, idEntry.name);
			let versionEntries;
			try {
				versionEntries = await readdir(idDir, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const versionEntry of versionEntries) {
				if (
					!versionEntry.isDirectory() ||
					!ThemeVersion.safeParse(versionEntry.name).success
				) {
					continue;
				}
				const versionDir = join(idDir, versionEntry.name);
				const manifestPath = join(versionDir, "theme.json");
				try {
					const raw = JSON.parse(
						await readFile(manifestPath, "utf8"),
					) as unknown;
					const parsed = ThemeManifest.safeParse(raw);
					if (!parsed.success) {
						throw new Error(parsed.error.message);
					}
					const manifest = stripRuntimeManifestFields(parsed.data);
					if (
						manifest.id !== idEntry.name ||
						manifest.version !== versionEntry.name
					) {
						throw new Error("manifest id/version 与目录不一致");
					}
					if (manifest.apiVersion !== THEME_API_VERSION) {
						throw new Error("manifest apiVersion 与核心不兼容");
					}
					const bundle = await readFile(join(versionDir, "bundle.js"));
					if (`sha256:${hash(bundle)}` !== manifest.bundleHash) {
						throw new Error("bundleHash 不一致");
					}
					const info = await stat(versionDir);
					const preview = await stat(join(versionDir, "preview.png"))
						.then((value) => value.isFile())
						.catch(() => false);
					const files = await listLocalFilesRecursive(versionDir);
					this.recordVersion({
						manifest,
						digest: manifest.bundleHash,
						installedAt: Math.round(info.mtimeMs),
						hasPreview: preview,
						storageProvider: "local",
						storagePrefix: "",
						versionDir,
						files,
					});
				} catch (error) {
					logger.warn("theme version skipped", {
						themeId: idEntry.name,
						version: versionEntry.name,
						reason: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		// 2. Overlay persisted DB theme metadata (covers S3-hosted and migrated themes)
		if (this.metadataRepo) {
			const storedRows = await this.metadataRepo.listAll();
			for (const row of storedRows) {
				if (row.storageProvider !== "s3") {
					continue;
				}
				try {
					const raw = JSON.parse(row.manifestJson) as unknown;
					const parsed = ThemeManifest.safeParse(raw);
					if (!parsed.success) {
						throw new Error(parsed.error.message);
					}
					const manifest = stripRuntimeManifestFields(parsed.data);
					if (
						manifest.id !== row.id ||
						manifest.version !== row.version ||
						manifest.apiVersion !== THEME_API_VERSION
					) {
						throw new Error("stored theme metadata mismatch");
					}
					const existingLocal = this.versionsById.get(row.id)?.get(row.version);
					this.recordVersion({
						manifest,
						digest: row.digest,
						installedAt: row.installedAt,
						hasPreview: row.hasPreview,
						storageProvider: "s3",
						storagePrefix: row.storagePrefix,
						versionDir: existingLocal?.versionDir ?? null,
						files: row.files,
					});
				} catch (error) {
					logger.warn("stored theme metadata skipped", {
						key: row.key,
						reason: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}
	}

	private async pruneVersions(id: string): Promise<void> {
		const versionsMap = this.versionsById.get(id);
		if (!versionsMap) {
			return;
		}
		const sorted = [...versionsMap.values()].sort((left, right) =>
			Bun.semver.order(right.manifest.version, left.manifest.version),
		);
		const s3Client = this.runtimeStorage?.getS3Client() ?? null;
		for (const obsolete of sorted.slice(KEEP_VERSIONS)) {
			if (obsolete.versionDir) {
				await rm(obsolete.versionDir, { recursive: true, force: true }).catch(
					() => undefined,
				);
			}
			if (obsolete.storageProvider === "s3" && obsolete.storagePrefix && s3Client) {
				for (const rel of obsolete.files) {
					const key = joinObjectKey(obsolete.storagePrefix, rel);
					await s3Client.deleteObject(key).catch(() => undefined);
				}
			}
			await this.metadataRepo?.deleteByKey(
				`${obsolete.manifest.id}@${obsolete.manifest.version}`,
			);
			versionsMap.delete(obsolete.manifest.version);
		}
	}
}
