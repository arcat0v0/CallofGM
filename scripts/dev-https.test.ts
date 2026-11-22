import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildCorsOrigins,
	collectHostInfo,
	ensureDevCertificate,
	findBinary,
	generateNginxConfig,
	resolveRuntimePaths,
} from "./dev-https";

const tempDirs: string[] = [];

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			await rm(dir, { recursive: true, force: true });
		}
	}
});

describe("dev:https helpers", () => {
	test("collectHostInfo filters virtual bridges from display while preserving SANs", () => {
		const info = collectHostInfo(
			{
				lo: [
					{
						address: "127.0.0.1",
						netmask: "255.0.0.0",
						family: "IPv4",
						mac: "00:00:00:00:00:00",
						internal: true,
						cidr: "127.0.0.1/8",
					},
				],
				wlan0: [
					{
						address: "192.168.233.212",
						netmask: "255.255.255.0",
						family: "IPv4",
						mac: "00:11:22:33:44:55",
						internal: false,
						cidr: "192.168.233.212/24",
					},
				],
				docker0: [
					{
						address: "172.17.0.1",
						netmask: "255.255.0.0",
						family: "IPv4",
						mac: "02:42:ac:11:00:01",
						internal: false,
						cidr: "172.17.0.1/16",
					},
				],
			},
			"gm.local, 10.0.0.5",
		);

		expect(info.displayHosts).toEqual([
			"10.0.0.5",
			"192.168.233.212",
			"gm.local",
		]);
		expect(info.additionalAllowedHosts).toEqual(["gm.local"]);
		expect(info.sanEntries).toEqual([
			"DNS:gm.local",
			"DNS:localhost",
			"IP:10.0.0.5",
			"IP:127.0.0.1",
			"IP:172.17.0.1",
			"IP:192.168.233.212",
			"IP:::1",
		]);
	});

	test("buildCorsOrigins merges HTTPS LAN origins with existing entries", () => {
		const origins = buildCorsOrigins(
			15633,
			["192.168.233.212", "fd00::1"],
			"https://custom.example:15633",
		);
		expect(origins.split(",")).toEqual([
			"https://localhost:15633",
			"https://127.0.0.1:15633",
			"http://localhost:15633",
			"https://192.168.233.212:15633",
			"https://[fd00::1]:15633",
			"https://custom.example:15633",
		]);
	});

	test("generateNginxConfig creates non-root path-routed TLS config", () => {
		const paths = resolveRuntimePaths("/tmp/cogm-test");
		const config = generateNginxConfig({
			httpsPort: 15633,
			backendPort: 15632,
			clientPort: 15634,
			paths,
		});

		expect(config).not.toMatch(/^\s*user\s+/m);
		expect(config).toContain("daemon off;");
		expect(config).toContain("listen 0.0.0.0:15633 ssl;");
		expect(config).toContain(
			"error_page 497 =307 https://$http_host$request_uri;",
		);
		expect(config).toContain("client_max_body_size 64m;");
		expect(config).toContain(
			"location /api/ {\n\t\t\tproxy_pass http://127.0.0.1:15632;",
		);
		expect(config).toContain(
			"location / {\n\t\t\tproxy_pass http://127.0.0.1:15634;",
		);
		expect(config).toContain(
			'client_body_temp_path "/tmp/cogm-test/.dev-https/nginx/temp/client_body";',
		);
		expect(() =>
			generateNginxConfig({
				httpsPort: 15633,
				backendPort: 15633,
				clientPort: 15634,
				paths,
			}),
		).toThrow();
	});

	test("ensureDevCertificate creates SAN certificate, reuses it, and regenerates on SAN change", async () => {
		const opensslBin = await findBinary("openssl", ["/usr/bin/openssl"]);
		if (!opensslBin) {
			throw new Error("openssl binary is required for this test");
		}
		const root = await mkdtemp(join(tmpdir(), "cogm-dev-https-"));
		tempDirs.push(root);
		const paths = resolveRuntimePaths(root);

		const created = await ensureDevCertificate(
			paths,
			["DNS:localhost", "IP:127.0.0.1", "IP:192.168.233.212"],
			opensslBin,
		);
		expect(created).toBe(true);
		const keyStats = await stat(paths.keyPath);
		expect(keyStats.mode & 0o077).toBe(0);

		const certText = execFileSync(
			opensslBin,
			["x509", "-in", paths.certPath, "-noout", "-text"],
			{ encoding: "utf8" },
		);
		expect(certText).toContain("DNS:localhost");
		expect(certText).toContain("IP Address:127.0.0.1");
		expect(certText).toContain("IP Address:192.168.233.212");

		const firstCert = await readFile(paths.certPath, "utf8");
		const reused = await ensureDevCertificate(
			paths,
			["DNS:localhost", "IP:127.0.0.1", "IP:192.168.233.212"],
			opensslBin,
		);
		expect(reused).toBe(false);
		expect(await readFile(paths.certPath, "utf8")).toBe(firstCert);

		const regenerated = await ensureDevCertificate(
			paths,
			["DNS:localhost", "IP:127.0.0.1", "IP:192.168.233.213"],
			opensslBin,
		);
		expect(regenerated).toBe(true);
		const updatedCertText = execFileSync(
			opensslBin,
			["x509", "-in", paths.certPath, "-noout", "-text"],
			{ encoding: "utf8" },
		);
		expect(updatedCertText).toContain("IP Address:192.168.233.213");
	});
});
