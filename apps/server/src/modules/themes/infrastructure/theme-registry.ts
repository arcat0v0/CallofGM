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
import { THEME_API_VERSION, ThemeManifest, ThemeVersion } from "@cogm/shared";
import { type UnzipFileInfo, unzipSync } from "fflate";
import { logger } from "@/platform/logging/logger";
import type { Clock } from "@/platform/ports";
import {
	ThemeIncompatibleError,
	ThemeInvalidError,
	ThemeTooLargeError,
	ThemeVersionConflictError,
} from "../domain/errors";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
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
};

type StoredTheme = InstalledTheme & {
	versionDir: string;
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

export class ThemeRegistry {
	private readonly themes = new Map<string, StoredTheme>();
	private initPromise: Promise<void> | null = null;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly rootDir: string,
		private readonly clock: Clock,
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
			.map(({ versionDir: _versionDir, ...theme }) => theme)
			.sort((left, right) =>
				left.manifest.name.localeCompare(right.manifest.name),
			);
	}

	get(id: string): InstalledTheme | null {
		const theme = this.themes.get(id);
		if (!theme) {
			return null;
		}
		const { versionDir: _versionDir, ...rest } = theme;
		return rest;
	}

	has(id: string): boolean {
		return this.themes.has(id);
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
			if (archive.byteLength > MAX_ARCHIVE_BYTES) {
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
			const manifest = parsed.data;
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

			await mkdir(join(this.rootDir, ".tmp"), { recursive: true });
			const tempDir = join(this.rootDir, ".tmp", crypto.randomUUID());
			const versionDir = join(this.rootDir, manifest.id, manifest.version);
			try {
				await mkdir(tempDir, { recursive: true });
				for (const [name, data] of Object.entries(files)) {
					if (name.endsWith("/")) {
						continue;
					}
					const target = join(tempDir, name);
					if (!target.startsWith(`${tempDir}${sep}`)) {
						throw new ThemeInvalidError(`非法路径：${name}`);
					}
					await mkdir(dirname(target), { recursive: true });
					await writeFile(target, data);
				}
				const manifestFile = join(tempDir, "theme.json");
				await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
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

			const installed: StoredTheme = {
				manifest,
				digest: manifest.bundleHash,
				installedAt: this.clock.nowEpochMs(),
				hasPreview: Boolean(files["preview.png"]),
				versionDir,
			};
			this.themes.set(manifest.id, installed);
			await this.pruneVersions(manifest.id);
			logger.info("theme installed", {
				themeId: manifest.id,
				version: manifest.version,
			});
			const { versionDir: _versionDir, ...summary } = installed;
			return summary;
		});
	}

	async remove(id: string): Promise<void> {
		return this.withLock(async () => {
			await this.ready();
			if (!this.themes.has(id)) {
				return;
			}
			await rm(join(this.rootDir, id), { recursive: true, force: true });
			this.themes.delete(id);
			logger.info("theme removed", { themeId: id });
		});
	}

	async previewPath(id: string): Promise<string | null> {
		await this.ready();
		const theme = this.themes.get(id);
		if (!theme) {
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

	private async scan(): Promise<void> {
		this.themes.clear();
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
			const candidates: StoredTheme[] = [];
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
					const manifest = parsed.data;
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
					candidates.push({
						manifest,
						digest: manifest.bundleHash,
						installedAt: Math.round(info.mtimeMs),
						hasPreview: preview,
						versionDir,
					});
				} catch (error) {
					logger.warn("theme version skipped", {
						themeId: idEntry.name,
						version: versionEntry.name,
						reason: error instanceof Error ? error.message : String(error),
					});
				}
			}
			if (candidates.length === 0) {
				continue;
			}
			candidates.sort((left, right) =>
				Bun.semver.order(right.manifest.version, left.manifest.version),
			);
			const latest = candidates[0];
			if (latest) {
				this.themes.set(idEntry.name, latest);
			}
		}
	}

	private async pruneVersions(id: string): Promise<void> {
		const idDir = join(this.rootDir, id);
		let entries;
		try {
			entries = await readdir(idDir, { withFileTypes: true });
		} catch {
			return;
		}
		const versions = entries
			.filter(
				(entry) =>
					entry.isDirectory() && ThemeVersion.safeParse(entry.name).success,
			)
			.map((entry) => entry.name)
			.sort((left, right) => Bun.semver.order(right, left));
		for (const version of versions.slice(KEEP_VERSIONS)) {
			await rm(join(idDir, version), { recursive: true, force: true });
		}
	}
}
