import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isReleaseSemver,
	ReleaseCheckError,
	runReleaseCheck,
	validateChangelog,
	validateClientBundle,
	validateReleaseDocs,
	validateRuntimePayload,
	versionFromTag,
} from "./check";

const repos: string[] = [];

async function makeRepo(
	options: {
		packageVersion?: string;
		tag?: string;
		annotated?: boolean;
		changelog?: string;
	} = {},
): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "cogm-release-"));
	repos.push(root);
	const version = options.packageVersion ?? "0.1.0";
	const tag = options.tag ?? `v${version}`;
	const changelog =
		options.changelog ??
		`# Changelog\n\n## [${version}] - 2026-11-05\n\n### Added\n- Version endpoint.\n`;
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({ name: "cogm-test", version }),
	);
	await mkdir(join(root, "docs"), { recursive: true });
	await writeFile(join(root, "CHANGELOG.md"), changelog);
	await writeFile(
		join(root, "AGENTS.md"),
		"bun run release:check\ndocker compose build --pull\ndocker compose up -d\n",
	);
	await writeFile(
		join(root, "docs", "release.md"),
		"bun run release:check\ndocker compose build --pull\ndocker compose up -d\n",
	);
	execFileSync("git", ["init", "-q"], { cwd: root });
	execFileSync("git", ["config", "user.email", "test@example.com"], {
		cwd: root,
	});
	execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
	execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });
	execFileSync("git", ["config", "tag.gpgsign", "false"], { cwd: root });
	execFileSync("git", ["add", "."], { cwd: root });
	execFileSync("git", ["commit", "-qm", "initial"], { cwd: root });
	execFileSync(
		"git",
		options.annotated === false ? ["tag", tag] : ["tag", "-a", tag, "-m", tag],
		{ cwd: root },
	);
	return root;
}

async function expectCode(
	promise: Promise<unknown>,
	code: string,
): Promise<void> {
	try {
		await promise;
		throw new Error("Expected release check to fail");
	} catch (error) {
		expect(error).toBeInstanceOf(ReleaseCheckError);
		expect((error as ReleaseCheckError).code).toBe(code);
	}
}

afterEach(async () => {
	await Promise.all(
		repos.splice(0).map((repo) => rm(repo, { recursive: true, force: true })),
	);
});

describe("release version helpers", () => {
	test("accepts release semver and extracts tag versions", () => {
		expect(isReleaseSemver("0.0.0")).toBe(true);
		expect(isReleaseSemver("0.1.0")).toBe(true);
		expect(isReleaseSemver("12.34.56")).toBe(true);
		expect(isReleaseSemver("v0.1.0")).toBe(false);
		expect(isReleaseSemver("0.1")).toBe(false);
		expect(isReleaseSemver("0.1.0+abc1234")).toBe(false);
		expect(versionFromTag("v1.2.3")).toBe("1.2.3");
		expect(versionFromTag("1.2.3")).toBeNull();
		expect(versionFromTag("v1.2")).toBeNull();
	});

	test("requires a dated, non-placeholder changelog section", () => {
		expect(() =>
			validateChangelog(
				"## [0.1.0] - 2026-11-05\n\n### Added\n- Version endpoint.\n",
				"0.1.0",
			),
		).not.toThrow();
		expect(() =>
			validateChangelog("## [0.1.0] - 2026-11-05\n\nTODO\n", "0.1.0"),
		).toThrow(ReleaseCheckError);
		expect(() =>
			validateChangelog("## [0.2.0] - 2026-11-05\n\n- No.\n", "0.1.0"),
		).toThrow(ReleaseCheckError);
	});

	test("requires release commands in both process documents", () => {
		const document =
			"bun run release:check\ndocker compose build --pull\ndocker compose up -d\n";
		expect(() => validateReleaseDocs(document, document)).not.toThrow();
		expect(() =>
			validateReleaseDocs("bun run release:check", document),
		).toThrow(ReleaseCheckError);
	});

	test("validates runtime and client build identity", () => {
		const payload = {
			server: {
				version: "0.1.0",
				commit: "abcdef0123456789",
				buildTime: "2026-11-05T10:20:30.000Z",
				component: "server",
			},
		};
		expect(() =>
			validateRuntimePayload(payload, "0.1.0", "abcdef0123456789"),
		).not.toThrow();
		expect(() =>
			validateRuntimePayload(payload, "0.2.0", "abcdef0123456789"),
		).toThrow(ReleaseCheckError);
		expect(() =>
			validateRuntimePayload(payload, "0.1.0", "different-commit"),
		).toThrow(ReleaseCheckError);
		expect(() =>
			validateClientBundle(
				'const build={"version":"0.1.0","commit":"abcdef0123456789"}',
				"0.1.0",
				"abcdef0123456789",
			),
		).not.toThrow();
		expect(() =>
			validateClientBundle(
				'const build={"version":"0.2.0"}',
				"0.1.0",
				"abcdef0123456789",
			),
		).toThrow(ReleaseCheckError);
		expect(() =>
			validateClientBundle(
				'const build={"version":"0.1.0"}',
				"0.1.0",
				"abcdef0123456789",
			),
		).toThrow(ReleaseCheckError);
	});
});

describe("runReleaseCheck", () => {
	test("passes for a clean annotated release tag", async () => {
		const root = await makeRepo();
		const result = await runReleaseCheck({ cwd: root });
		expect(result.version).toBe("0.1.0");
		expect(result.tag).toBe("v0.1.0");
		expect(result.commit).toMatch(/^[0-9a-f]{40}$/);
	});

	test("rejects a dirty worktree", async () => {
		const root = await makeRepo();
		await writeFile(join(root, "dirty.txt"), "dirty");
		await expectCode(runReleaseCheck({ cwd: root }), "WORKTREE_DIRTY");
	});

	test("rejects a tag that does not match package.json", async () => {
		const root = await makeRepo({ tag: "v0.2.0" });
		await expectCode(runReleaseCheck({ cwd: root }), "TAG_VERSION_MISMATCH");
	});

	test("rejects lightweight tags", async () => {
		const root = await makeRepo({ annotated: false });
		await expectCode(runReleaseCheck({ cwd: root }), "TAG_NOT_ANNOTATED");
	});

	test("rejects a missing changelog version", async () => {
		const root = await makeRepo({
			changelog: "# Changelog\n\n## [0.9.0] - 2026-11-05\n\n- Old.\n",
		});
		await expectCode(
			runReleaseCheck({ cwd: root }),
			"CHANGELOG_VERSION_MISSING",
		);
	});

	test("rejects a runtime version mismatch", async () => {
		const root = await makeRepo();
		await expectCode(
			runReleaseCheck({
				cwd: root,
				runtimeUrl: "https://cogm.test",
				fetchImpl: async () =>
					Response.json({
						server: {
							version: "0.2.0",
							commit: "abcdef0123456789",
							buildTime: "2026-11-05T10:20:30.000Z",
							component: "server",
						},
					}),
			}),
			"RUNTIME_VERSION_MISMATCH",
		);
	});

	test("reads the committed package without mutating the fixture", async () => {
		const root = await makeRepo();
		await readFile(join(root, "package.json"), "utf8");
		const result = await runReleaseCheck({ cwd: root });
		expect(result.version).toBe("0.1.0");
	});
});
