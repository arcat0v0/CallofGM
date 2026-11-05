import { type BuildInfo, normalizeBuildInfo } from "@cogm/shared";

const injected =
	typeof __COGM_CLIENT_BUILD__ === "object" && __COGM_CLIENT_BUILD__ !== null
		? (__COGM_CLIENT_BUILD__ as Record<string, unknown>)
		: {};

export const clientBuildInfo: BuildInfo = normalizeBuildInfo({
	version: injected.version,
	commit: injected.commit,
	buildTime: injected.buildTime,
	component: "client",
});
