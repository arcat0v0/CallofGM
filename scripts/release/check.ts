import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { VersionResponseSchema } from "../../packages/shared/src/version";

const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG_VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|占位|待补充|placeholder/i;

const REQUIRED_DOC_COMMANDS = [
	"bun run release:check",
	"docker compose build --pull",
	"docker compose up -d",
];

export class ReleaseCheckError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ReleaseCheckError";
	}
}

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export function isReleaseSemver(value: string): boolean {
	return RELEASE_VERSION.test(value);
}

export function versionFromTag(tag: string): string | null {
	const match = TAG_VERSION.exec(tag);
	return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function fail(code: string, message: string): never {
	throw new ReleaseCheckError(code, message);
}

export function validateChangelog(text: string, version: string): void {
	const heading = new RegExp(
		`^##\\s+\\[?v?${version.replaceAll(".", "\\.")}\\]?\\s+-\\s+(\\d{4}-\\d{2}-\\d{2})\\s*$`,
		"m",
	);
	const match = heading.exec(text);
	if (!match) {
		fail(
			"CHANGELOG_VERSION_MISSING",
			`CHANGELOG.md has no dated heading for ${version}`,
		);
	}
	const rest = text.slice(match.index + match[0].length);
	const nextHeading = rest.search(/^##\s+/m);
	const body = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
	const meaningful = body
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !line.startsWith("###"))
		.filter((line) => !PLACEHOLDER.test(line));
	if (meaningful.length === 0) {
		fail(
			"CHANGELOG_PLACEHOLDER",
			`CHANGELOG.md section for ${version} is still a placeholder`,
		);
	}
}

export function validateReleaseDocs(agents: string, releaseDoc: string): void {
	for (const command of REQUIRED_DOC_COMMANDS) {
		if (!agents.includes(command)) {
			fail("DOCS_MISSING_COMMAND", `AGENTS.md is missing: ${command}`);
		}
		if (!releaseDoc.includes(command)) {
			fail("DOCS_MISSING_COMMAND", `docs/release.md is missing: ${command}`);
		}
	}
}

export function validateRuntimePayload(
	payload: unknown,
	version: string,
	commit: string,
): void {
	const parsed = VersionResponseSchema.safeParse(payload);
	if (!parsed.success) {
		fail("RUNTIME_INVALID", "Runtime /api/version did not match the schema");
	}
	if (parsed.data.server.version !== version) {
		fail(
			"RUNTIME_VERSION_MISMATCH",
			`Runtime reports ${parsed.data.server.version}, expected ${version}`,
		);
	}
	if (parsed.data.server.commit !== commit) {
		fail(
			"RUNTIME_COMMIT_MISMATCH",
			`Runtime commit ${parsed.data.server.commit} does not match ${commit}`,
		);
	}
}

export function validateClientBundle(
	text: string,
	version: string,
	commit: string,
): void {
	if (!text.includes(version)) {
		fail("CLIENT_VERSION_MISSING", "Client bundle lacks the release version");
	}
	if (!text.includes(commit)) {
		fail("CLIENT_COMMIT_MISSING", "Client bundle lacks the release commit");
	}
}

function git(cwd: string, args: string[]): string {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		fail("GIT_FAILED", `git ${args.join(" ")} failed`);
	}
}

async function checkRuntime(
	runtimeUrl: string,
	version: string,
	commit: string,
	fetchImpl: FetchLike,
): Promise<void> {
	const base = new URL(runtimeUrl);
	const apiResponse = await fetchImpl(new URL("/api/version", base), {
		cache: "no-store",
	});
	if (!apiResponse.ok) {
		fail(
			"RUNTIME_UNREACHABLE",
			`Runtime /api/version returned ${apiResponse.status}`,
		);
	}
	validateRuntimePayload(await apiResponse.json(), version, commit);

	const pageResponse = await fetchImpl(new URL("/", base));
	if (!pageResponse.ok) {
		fail(
			"RUNTIME_PAGE_UNREACHABLE",
			`Runtime page returned ${pageResponse.status}`,
		);
	}
	const html = await pageResponse.text();
	const scripts = Array.from(
		html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
		(match) => match[1],
	).filter((source): source is string => Boolean(source));
	if (scripts.length === 0) {
		fail("CLIENT_BUNDLE_MISSING", "Runtime page has no client script");
	}
	for (const source of scripts) {
		const scriptUrl = new URL(source, base);
		if (scriptUrl.origin !== base.origin) {
			continue;
		}
		const response = await fetchImpl(scriptUrl);
		if (!response.ok) {
			continue;
		}
		const bundle = await response.text();
		if (bundle.includes(version) && bundle.includes(commit)) {
			return;
		}
	}
	fail(
		"CLIENT_BUNDLE_MISMATCH",
		"Client bundle does not contain the expected version and commit",
	);
}

export async function runReleaseCheck(options: {
	cwd: string;
	runtimeUrl?: string;
	fetchImpl?: FetchLike;
}): Promise<{ version: string; tag: string; commit: string }> {
	const cwd = options.cwd;
	const packageJson = JSON.parse(
		await readFile(join(cwd, "package.json"), "utf8"),
	) as { version?: unknown };
	if (
		typeof packageJson.version !== "string" ||
		!isReleaseSemver(packageJson.version)
	) {
		fail(
			"INVALID_VERSION",
			"Root package.json version must be MAJOR.MINOR.PATCH",
		);
	}
	const version = packageJson.version;

	const status = git(cwd, [
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	]);
	if (status) {
		fail("WORKTREE_DIRTY", "Working tree has uncommitted changes");
	}

	const commit = git(cwd, ["rev-parse", "HEAD"]);
	const tags = git(cwd, ["tag", "--points-at", "HEAD"])
		.split("\n")
		.map((tag) => tag.trim())
		.filter(Boolean);
	if (tags.length === 0) {
		fail("HEAD_NOT_TAGGED", "HEAD has no release tag");
	}
	const tag = tags.find((candidate) => versionFromTag(candidate) === version);
	if (!tag) {
		fail(
			"TAG_VERSION_MISMATCH",
			`No tag on HEAD matches package version ${version}`,
		);
	}
	if (git(cwd, ["cat-file", "-t", `refs/tags/${tag}`]) !== "tag") {
		fail("TAG_NOT_ANNOTATED", `${tag} is not an annotated tag`);
	}
	const taggedCommit = git(cwd, ["rev-list", "-n", "1", tag]);
	if (taggedCommit !== commit) {
		fail("TAG_TARGET_MISMATCH", `${tag} does not point at HEAD`);
	}

	const changelog = await readFile(join(cwd, "CHANGELOG.md"), "utf8");
	validateChangelog(changelog, version);
	const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
	const releaseDoc = await readFile(join(cwd, "docs/release.md"), "utf8");
	validateReleaseDocs(agents, releaseDoc);

	if (options.runtimeUrl) {
		await checkRuntime(
			options.runtimeUrl,
			version,
			commit,
			options.fetchImpl ?? fetch,
		);
	}

	return { version, tag, commit };
}

function runtimeArgument(args: string[]): string | undefined {
	const index = args.indexOf("--runtime");
	return index >= 0 ? args[index + 1] : undefined;
}

if (import.meta.main) {
	const runtimeUrl = runtimeArgument(process.argv.slice(2));
	if (process.argv.includes("--runtime") && !runtimeUrl) {
		console.error("--runtime requires a URL");
		process.exit(1);
	}
	try {
		const result = await runReleaseCheck({
			cwd: process.cwd(),
			runtimeUrl,
		});
		console.log(
			`Release check passed: ${result.version} ${result.tag} ${result.commit}`,
		);
	} catch (error) {
		if (error instanceof ReleaseCheckError) {
			console.error(`${error.code}: ${error.message}`);
		} else {
			console.error(error);
		}
		process.exit(1);
	}
}
