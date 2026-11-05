import { z } from "zod";

export const BUILD_UNKNOWN = "unknown";
export const BUILD_COMPONENTS = ["client", "server"] as const;

export const BuildComponentSchema = z.enum(BUILD_COMPONENTS);

export const BuildInfoSchema = z.object({
	version: z.string().trim().min(1),
	commit: z.string().trim().min(1),
	buildTime: z.string().trim().min(1),
	component: BuildComponentSchema,
});

export type BuildComponent = z.infer<typeof BuildComponentSchema>;
export type BuildInfo = z.infer<typeof BuildInfoSchema>;

export const VersionResponseSchema = z.object({
	client: BuildInfoSchema.optional(),
	server: BuildInfoSchema,
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;

function normalizedText(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeVersion(value: unknown): string {
	return normalizedText(value) ?? BUILD_UNKNOWN;
}

function normalizeCommit(value: unknown): string {
	const commit = normalizedText(value);
	if (!commit) {
		return BUILD_UNKNOWN;
	}
	const lower = commit.toLowerCase();
	if (lower === BUILD_UNKNOWN) {
		return BUILD_UNKNOWN;
	}
	return /^[0-9a-f]{7,40}$/.test(lower) ? lower : BUILD_UNKNOWN;
}

function normalizeBuildTime(value: unknown): string {
	const buildTime = normalizedText(value);
	if (!buildTime || buildTime.toLowerCase() === BUILD_UNKNOWN) {
		return BUILD_UNKNOWN;
	}
	const parsed = new Date(buildTime);
	return Number.isNaN(parsed.getTime()) ? BUILD_UNKNOWN : parsed.toISOString();
}

export function normalizeBuildInfo(input: {
	version?: unknown;
	commit?: unknown;
	buildTime?: unknown;
	component: unknown;
}): BuildInfo {
	return BuildInfoSchema.parse({
		version: normalizeVersion(input.version),
		commit: normalizeCommit(input.commit),
		buildTime: normalizeBuildTime(input.buildTime),
		component: input.component,
	});
}

export function formatCommit(commit: string): string {
	return commit === BUILD_UNKNOWN
		? BUILD_UNKNOWN
		: commit.slice(0, 7).toLowerCase();
}

export function formatBuildTime(buildTime: string): string {
	if (buildTime === BUILD_UNKNOWN) {
		return BUILD_UNKNOWN;
	}
	const parsed = new Date(buildTime);
	if (Number.isNaN(parsed.getTime())) {
		return BUILD_UNKNOWN;
	}
	return `${parsed.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function buildsAligned(client: BuildInfo, server: BuildInfo): boolean {
	if (client.version !== server.version) {
		return false;
	}
	if (client.commit === BUILD_UNKNOWN || server.commit === BUILD_UNKNOWN) {
		return true;
	}
	return client.commit === server.commit;
}
