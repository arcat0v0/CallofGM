import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

describe("systemd deployment assets", () => {
	test("cogm.service targets /opt/cogm and config/cogm.systemd.toml", async () => {
		const unit = await readFile(
			resolve(repoRoot, "deploy/systemd/cogm.service"),
			"utf8",
		);
		expect(unit).toContain("WorkingDirectory=/opt/cogm");
		expect(unit).toContain(
			"Environment=COGM_CONFIG=/opt/cogm/config/cogm.systemd.toml",
		);
		expect(unit).toContain("EnvironmentFile=-/etc/cogm/cogm.env");
		expect(unit).toContain("EnvironmentFile=-/etc/cogm/build.env");
		expect(unit).toContain(
			"ExecStart=/usr/local/bin/bun --cwd /opt/cogm/apps/server src/index.ts",
		);
		expect(unit).toContain("ReadWritePaths=/opt/cogm/data");
		expect(unit).toContain("KillSignal=SIGTERM");
	});

	test("deploy.sh passes bash syntax check", () => {
		expect(() =>
			execFileSync("bash", [
				"-n",
				resolve(repoRoot, "deploy/systemd/deploy.sh"),
			]),
		).not.toThrow();
	});
});
