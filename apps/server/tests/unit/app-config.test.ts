import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createAppConfig, loadConfig, toFileConfig } from "@/config/app-config";

const tempDirs: string[] = [];

async function tempFile(name: string, content: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "cogm-config-"));
	tempDirs.push(dir);
	const path = join(dir, name);
	await writeFile(path, content);
	return path;
}

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			await rm(dir, { recursive: true, force: true });
		}
	}
});

describe("app config", () => {
	test("defaults cover server, storage, security, voice, and dev settings", () => {
		const config = createAppConfig();

		expect(config.port).toBe(15632);
		expect(config.databaseUrl).toBe("data/db.sqlite");
		expect(config.mediaDir).toBe("data/media");
		expect(config.themesDir).toBe("data/themes");
		expect(config.trustProxy).toBe(false);
		expect(config.voice.maxParticipants).toBe(8);
		expect(config.voice.turnTtlSeconds).toBe(600);
		expect(config.dev.httpsPort).toBe(15633);
	});

	test("development default CORS allows the local dev origins", () => {
		const config = createAppConfig({ environment: "development" });

		expect(config.corsOrigins).toEqual([
			"http://localhost:15633",
			"http://localhost:15632",
		]);
	});

	test("production CORS stays closed unless origins are configured", () => {
		const config = createAppConfig({ environment: "production" });

		expect(config.corsOrigins).toEqual([]);
	});

	test("TOML file plus local override produce the effective config", async () => {
		const path = await tempFile(
			"cogm.toml",
			[
				"[server]",
				'host = "127.0.0.1"',
				"port = 16000",
				"[database]",
				'url = "data/base.sqlite"',
				"[voice]",
				"maxParticipants = 12",
				'stunUrls = ["stun:stun.example.org"]',
			].join("\n"),
		);
		const localPath = await tempFile(
			"cogm.local.toml",
			[
				"[database]",
				'url = "data/local.sqlite"',
				"[security]",
				"trustProxy = true",
				'corsOrigins = ["https://cogm.example.com"]',
				"[voice]",
				"maxParticipants = 6",
			].join("\n"),
		);

		const config = loadConfig({
			path,
			localPath,
			env: { NODE_ENV: "production" },
		});

		expect(config.host).toBe("127.0.0.1");
		expect(config.port).toBe(16000);
		expect(config.databaseUrl).toBe("data/local.sqlite");
		expect(config.trustProxy).toBe(true);
		expect(config.corsOrigins).toEqual(["https://cogm.example.com"]);
		expect(config.voice.maxParticipants).toBe(6);
		expect(config.voice.stunUrls).toEqual(["stun:stun.example.org"]);
	});

	test("local override is discovered next to the selected config", async () => {
		const dir = await mkdtemp(join(tmpdir(), "cogm-config-"));
		tempDirs.push(dir);
		const path = join(dir, "cogm.toml");
		await writeFile(path, ["[server]", "port = 16001"].join("\n"));
		await writeFile(
			join(dir, "cogm.local.toml"),
			["[server]", "port = 16002"].join("\n"),
		);

		expect(loadConfig({ path, env: {} }).port).toBe(16002);
	});

	test("TURN secret comes from the environment and must pair with TURN URLs", async () => {
		const turnSecret = "unit-test-turn-key";
		const path = await tempFile(
			"cogm.toml",
			[
				"[voice]",
				'turnUrls = ["turn:turn.example.com:3478"]',
				"turnTtlSeconds = 900",
			].join("\n"),
		);

		expect(() => loadConfig({ path, env: { NODE_ENV: "production" } })).toThrow(
			/VOICE_TURN_REST_SECRET/,
		);

		const config = loadConfig({
			path,
			env: {
				NODE_ENV: "production",
				VOICE_TURN_REST_SECRET: turnSecret,
			},
		});
		expect(config.voice.turnRestSecret).toBe(turnSecret);
		expect(config.voice.turnTtlSeconds).toBe(900);
	});

	test("invalid ports and unknown sections fail fast", async () => {
		const badPort = await tempFile(
			"bad-port.toml",
			["[server]", "port = 70000"].join("\n"),
		);
		expect(() => loadConfig({ path: badPort, env: {} })).toThrow();

		const unknown = await tempFile(
			"unknown.toml",
			["[server]", "port = 15632", "[unknown]", "value = true"].join("\n"),
		);
		expect(() => loadConfig({ path: unknown, env: {} })).toThrow();
	});

	test("serialized file config never contains the TURN secret", () => {
		const turnSecret = "unit-test-turn-key";
		const config = createAppConfig({
			voice: {
				turnUrls: ["turn:turn.example.com:3478"],
				turnRestSecret: turnSecret,
			},
		});

		const serialized = JSON.stringify(toFileConfig(config));

		expect(serialized).not.toContain(turnSecret);
		expect(serialized).not.toContain("turnRestSecret");
	});

	test("ships valid base TOML configs for local, docker, and systemd", async () => {
		const repoConfigDir = resolve(import.meta.dir, "../../../../config");
		const missingLocal = join(
			await mkdtemp(join(tmpdir(), "cogm-no-local-")),
			"cogm.local.toml",
		);
		tempDirs.push(resolve(missingLocal, ".."));

		const localCfg = loadConfig({
			path: join(repoConfigDir, "cogm.toml"),
			localPath: missingLocal,
			env: {},
		});
		expect(localCfg.port).toBe(15632);
		expect(localCfg.databaseUrl).toBe("data/db.sqlite");

		const dockerCfg = loadConfig({
			path: join(repoConfigDir, "cogm.docker.toml"),
			localPath: missingLocal,
			env: { NODE_ENV: "production" },
		});
		expect(dockerCfg.databaseUrl).toBe("/app/data/db.sqlite");
		expect(dockerCfg.mediaDir).toBe("/app/data/media");
		expect(dockerCfg.themesDir).toBe("/app/data/themes");

		const systemdCfg = loadConfig({
			path: join(repoConfigDir, "cogm.systemd.toml"),
			localPath: missingLocal,
			env: { NODE_ENV: "production" },
		});
		expect(systemdCfg.host).toBe("127.0.0.1");
		expect(systemdCfg.port).toBe(15632);
		expect(systemdCfg.databaseUrl).toBe("/opt/cogm/data/db.sqlite");
		expect(systemdCfg.mediaDir).toBe("/opt/cogm/data/media");
		expect(systemdCfg.themesDir).toBe("/opt/cogm/data/themes");
	});
});
