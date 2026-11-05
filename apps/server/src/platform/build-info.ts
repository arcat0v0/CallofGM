import { readFileSync } from "node:fs";
import {
	BUILD_UNKNOWN,
	type BuildInfo,
	normalizeBuildInfo,
} from "@cogm/shared";

const rootPackageUrl = new URL("../../../../package.json", import.meta.url);

function readRootPackageVersion(): string {
	try {
		const parsed = JSON.parse(readFileSync(rootPackageUrl, "utf8")) as {
			version?: unknown;
		};
		return typeof parsed.version === "string" ? parsed.version : BUILD_UNKNOWN;
	} catch {
		return BUILD_UNKNOWN;
	}
}

export function getServerBuildInfo(
	overrides: Partial<Omit<BuildInfo, "component">> = {},
): BuildInfo {
	return normalizeBuildInfo({
		version: overrides.version ?? readRootPackageVersion(),
		commit: overrides.commit ?? process.env.COGM_COMMIT,
		buildTime: overrides.buildTime ?? process.env.COGM_BUILD_TIME,
		component: "server",
	});
}
