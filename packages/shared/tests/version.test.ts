import { describe, expect, test } from "bun:test";
import {
	BUILD_UNKNOWN,
	BuildInfoSchema,
	buildsAligned,
	formatBuildTime,
	formatCommit,
	normalizeBuildInfo,
	VersionResponseSchema,
} from "../src/version";

const fullSha = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";

describe("build info normalization", () => {
	test("normalizes valid build fields", () => {
		const info = normalizeBuildInfo({
			version: " 0.1.0 ",
			commit: fullSha,
			buildTime: "2026-11-05T10:20:30Z",
			component: "server",
		});

		expect(info).toEqual({
			version: "0.1.0",
			commit: fullSha.toLowerCase(),
			buildTime: "2026-11-05T10:20:30.000Z",
			component: "server",
		});
		expect(BuildInfoSchema.parse(info)).toEqual(info);
	});

	test("falls back to unknown for blank and malformed values", () => {
		expect(
			normalizeBuildInfo({
				version: " ",
				commit: "not-a-git-commit",
				buildTime: "not-a-date",
				component: "client",
			}),
		).toEqual({
			version: BUILD_UNKNOWN,
			commit: BUILD_UNKNOWN,
			buildTime: BUILD_UNKNOWN,
			component: "client",
		});
	});

	test("keeps short commits and accepts unknown explicitly", () => {
		expect(
			normalizeBuildInfo({
				version: "0.1.0",
				commit: "abc1234",
				buildTime: "unknown",
				component: "server",
			}).commit,
		).toBe("abc1234");
		expect(
			normalizeBuildInfo({
				version: "0.1.0",
				commit: "unknown",
				buildTime: "unknown",
				component: "server",
			}).buildTime,
		).toBe(BUILD_UNKNOWN);
	});

	test("rejects missing mandatory response fields", () => {
		expect(
			VersionResponseSchema.safeParse({
				server: {
					version: "0.1.0",
					commit: "abc1234",
					component: "server",
				},
			}).success,
		).toBe(false);
	});
});

describe("build info display helpers", () => {
	test("formats commits and timestamps for display", () => {
		expect(formatCommit(fullSha)).toBe("abcdef0");
		expect(formatCommit(BUILD_UNKNOWN)).toBe(BUILD_UNKNOWN);
		expect(formatBuildTime("2026-11-05T10:20:30Z")).toBe(
			"2026-11-05 10:20:30 UTC",
		);
		expect(formatBuildTime("bad")).toBe(BUILD_UNKNOWN);
		expect(formatBuildTime(BUILD_UNKNOWN)).toBe(BUILD_UNKNOWN);
	});

	test("detects version and known-commit mismatches", () => {
		const base = {
			version: "0.1.0",
			commit: "abc1234",
			buildTime: "2026-11-05T10:20:30.000Z",
			component: "client" as const,
		};
		expect(buildsAligned(base, { ...base, component: "server" })).toBe(true);
		expect(
			buildsAligned(base, {
				...base,
				version: "0.2.0",
				component: "server",
			}),
		).toBe(false);
		expect(
			buildsAligned(base, {
				...base,
				commit: "def5678",
				component: "server",
			}),
		).toBe(false);
		expect(
			buildsAligned(base, {
				...base,
				commit: BUILD_UNKNOWN,
				component: "server",
			}),
		).toBe(true);
	});
});
