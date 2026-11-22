import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import {
	createConnection,
	createServer,
	isIP,
	type NetworkInterfaceInfo,
} from "node:net";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig, toFileConfig } from "../apps/server/src/config/app-config";

const VIRTUAL_INTERFACE_PREFIXES = [
	"docker",
	"veth",
	"br-",
	"virbr",
	"podman",
	"cni",
];
const CERT_RENEW_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const STARTUP_TIMEOUT_MS = 20_000;
const SHUTDOWN_GRACE_MS = 2_500;

export interface RuntimePaths {
	runtimeDir: string;
	certsDir: string;
	certPath: string;
	keyPath: string;
	sanPath: string;
	nginxDir: string;
	logsDir: string;
	tempDir: string;
	confPath: string;
	pidPath: string;
	errorLogPath: string;
}

export interface HostInfo {
	sanEntries: string[];
	displayHosts: string[];
	corsHosts: string[];
	additionalAllowedHosts: string[];
}

export interface NginxConfigOptions {
	httpsPort: number;
	backendPort: number;
	clientPort: number;
	paths: RuntimePaths;
}

export function resolveRuntimePaths(rootDir: string): RuntimePaths {
	const runtimeDir = join(rootDir, ".dev-https");
	const certsDir = join(runtimeDir, "certs");
	const nginxDir = join(runtimeDir, "nginx");
	const logsDir = join(nginxDir, "logs");
	return {
		runtimeDir,
		certsDir,
		certPath: join(certsDir, "cert.pem"),
		keyPath: join(certsDir, "key.pem"),
		sanPath: join(certsDir, "san.txt"),
		nginxDir,
		logsDir,
		tempDir: join(nginxDir, "temp"),
		confPath: join(nginxDir, "nginx.conf"),
		pidPath: join(nginxDir, "nginx.pid"),
		errorLogPath: join(logsDir, "error.log"),
	};
}

function isVirtualInterface(name: string): boolean {
	return VIRTUAL_INTERFACE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function formatHostForUrl(host: string): string {
	return isIP(host) === 6 && !host.startsWith("[") ? `[${host}]` : host;
}

/**
 * Collect SAN entries, CORS hosts, and LAN display hosts from network interfaces
 * and optional comma-separated `DEV_HTTPS_HOSTS` entries.
 */
export function collectHostInfo(
	interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
	extraHostsRaw?: string,
): HostInfo {
	const sanSet = new Set<string>(["DNS:localhost", "IP:127.0.0.1", "IP:::1"]);
	const corsSet = new Set<string>();
	const displaySet = new Set<string>();
	const allDetectedIps = new Set<string>();
	const allowedHostSet = new Set<string>();

	for (const [name, entries] of Object.entries(interfaces)) {
		if (!entries) continue;
		for (const entry of entries) {
			if (entry.internal) continue;
			const family = String(entry.family);
			if (family !== "IPv4" && family !== "4") continue;
			sanSet.add(`IP:${entry.address}`);
			corsSet.add(entry.address);
			allDetectedIps.add(entry.address);
			if (!isVirtualInterface(name)) {
				displaySet.add(entry.address);
			}
		}
	}

	if (displaySet.size === 0) {
		for (const ip of allDetectedIps) {
			displaySet.add(ip);
		}
	}

	if (extraHostsRaw) {
		for (const rawItem of extraHostsRaw.split(",")) {
			const host = rawItem.trim();
			if (!host) continue;
			if (/[\s/\\]/.test(host)) {
				throw new Error(`Invalid host in DEV_HTTPS_HOSTS: "${host}"`);
			}
			const ipVersion = isIP(host);
			if (ipVersion === 4 || ipVersion === 6) {
				sanSet.add(`IP:${host}`);
			} else {
				sanSet.add(`DNS:${host}`);
				allowedHostSet.add(host);
			}
			corsSet.add(host);
			displaySet.add(host);
		}
	}

	return {
		sanEntries: [...sanSet].sort(),
		displayHosts: [...displaySet].sort(),
		corsHosts: [...corsSet].sort(),
		additionalAllowedHosts: [...allowedHostSet].sort(),
	};
}

export function buildCorsOrigins(
	httpsPort: number,
	hosts: string[],
	existingRaw?: string,
): string {
	const origins = new Set<string>([
		`https://localhost:${httpsPort}`,
		`https://127.0.0.1:${httpsPort}`,
		`http://localhost:${httpsPort}`,
	]);
	for (const host of hosts) {
		origins.add(`https://${formatHostForUrl(host)}:${httpsPort}`);
	}
	if (existingRaw) {
		for (const entry of existingRaw.split(",")) {
			const trimmed = entry.trim();
			if (trimmed) origins.add(trimmed);
		}
	}
	return [...origins].join(",");
}

function escapeNginxString(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/**
 * Generate a self-contained non-root Nginx config that terminates TLS on
 * `httpsPort` and routes `/api/*` directly to the backend and `/` to Vite.
 */
export function generateNginxConfig(options: NginxConfigOptions): string {
	const { httpsPort, backendPort, clientPort, paths } = options;
	if (
		httpsPort === backendPort ||
		httpsPort === clientPort ||
		backendPort === clientPort
	) {
		throw new Error(
			`Ports must be distinct (https=${httpsPort}, backend=${backendPort}, client=${clientPort})`,
		);
	}
	const tempSubdir = (name: string) =>
		escapeNginxString(join(paths.tempDir, name));

	return [
		"worker_processes 1;",
		"daemon off;",
		`pid "${escapeNginxString(paths.pidPath)}";`,
		`error_log "${escapeNginxString(paths.errorLogPath)}" warn;`,
		"",
		"events {",
		"\tworker_connections 1024;",
		"}",
		"",
		"http {",
		"\tdefault_type application/octet-stream;",
		"\taccess_log off;",
		"",
		`\tclient_body_temp_path "${tempSubdir("client_body")}";`,
		`\tproxy_temp_path "${tempSubdir("proxy")}";`,
		`\tfastcgi_temp_path "${tempSubdir("fastcgi")}";`,
		`\tuwsgi_temp_path "${tempSubdir("uwsgi")}";`,
		`\tscgi_temp_path "${tempSubdir("scgi")}";`,
		"",
		"\tmap $http_upgrade $connection_upgrade {",
		"\t\tdefault upgrade;",
		"\t\t'' close;",
		"\t}",
		"",
		"\tserver {",
		`\t\tlisten 0.0.0.0:${httpsPort} ssl;`,
		"\t\tserver_name _;",
		"",
		`\t\tssl_certificate "${escapeNginxString(paths.certPath)}";`,
		`\t\tssl_certificate_key "${escapeNginxString(paths.keyPath)}";`,
		"\t\tssl_protocols TLSv1.2 TLSv1.3;",
		"\t\tssl_session_cache shared:COGM_DEV:10m;",
		"\t\tssl_session_timeout 10m;",
		"",
		"\t\t# Redirect accidental plain HTTP requests on the HTTPS port.",
		"\t\terror_page 497 =307 https://$http_host$request_uri;",
		"",
		"\t\tclient_max_body_size 64m;",
		"",
		"\t\tproxy_http_version 1.1;",
		"\t\tproxy_set_header Host $http_host;",
		"\t\tproxy_set_header X-Real-IP $remote_addr;",
		"\t\tproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
		"\t\tproxy_set_header X-Forwarded-Proto $scheme;",
		"\t\tproxy_set_header Upgrade $http_upgrade;",
		"\t\tproxy_set_header Connection $connection_upgrade;",
		"\t\tproxy_read_timeout 3600s;",
		"\t\tproxy_send_timeout 3600s;",
		"",
		"\t\tlocation /api/ {",
		`\t\t\tproxy_pass http://127.0.0.1:${backendPort};`,
		"\t\t\tproxy_buffering off;",
		"\t\t\tproxy_request_buffering off;",
		"\t\t}",
		"",
		"\t\tlocation = /api {",
		`\t\t\tproxy_pass http://127.0.0.1:${backendPort};`,
		"\t\t}",
		"",
		"\t\tlocation / {",
		`\t\t\tproxy_pass http://127.0.0.1:${clientPort};`,
		"\t\t}",
		"\t}",
		"}",
		"",
	].join("\n");
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function findBinary(
	name: string,
	fallbacks: string[] = [],
): Promise<string | null> {
	const onPath = Bun.which(name);
	if (onPath) return onPath;
	for (const candidate of fallbacks) {
		if (await fileExists(candidate)) return candidate;
	}
	return null;
}

function isCertFresh(
	opensslBin: string,
	certPath: string,
	renewWindowSeconds: number,
): boolean {
	try {
		execFileSync(
			opensslBin,
			[
				"x509",
				"-checkend",
				String(renewWindowSeconds),
				"-noout",
				"-in",
				certPath,
			],
			{ stdio: "ignore" },
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Create or renew a self-signed X.509 certificate with all local SANs.
 * Returns `true` if a new certificate was generated.
 */
export async function ensureDevCertificate(
	paths: RuntimePaths,
	sanEntries: string[],
	opensslBin: string,
): Promise<boolean> {
	await mkdir(paths.certsDir, { recursive: true });
	const expectedSan = sanEntries.join(",");

	const hasFiles =
		(await fileExists(paths.certPath)) &&
		(await fileExists(paths.keyPath)) &&
		(await fileExists(paths.sanPath));

	if (hasFiles) {
		const existingSan = (await readFile(paths.sanPath, "utf8")).trim();
		if (
			existingSan === expectedSan &&
			isCertFresh(opensslBin, paths.certPath, CERT_RENEW_WINDOW_SECONDS)
		) {
			return false;
		}
	}

	execFileSync(
		opensslBin,
		[
			"req",
			"-x509",
			"-newkey",
			"rsa:2048",
			"-nodes",
			"-sha256",
			"-days",
			"365",
			"-keyout",
			paths.keyPath,
			"-out",
			paths.certPath,
			"-subj",
			"/CN=cogm-dev",
			"-addext",
			`subjectAltName=${expectedSan}`,
		],
		{ stdio: ["ignore", "ignore", "pipe"] },
	);
	await chmod(paths.keyPath, 0o600);
	await writeFile(paths.sanPath, `${expectedSan}\n`, "utf8");
	return true;
}

async function prepareNginxFiles(
	paths: RuntimePaths,
	configText: string,
): Promise<void> {
	await mkdir(paths.logsDir, { recursive: true });
	for (const subdir of [
		"client_body",
		"proxy",
		"fastcgi",
		"uwsgi",
		"scgi",
	]) {
		await mkdir(join(paths.tempDir, subdir), { recursive: true });
	}
	await writeFile(paths.confPath, configText, "utf8");
}

function validateNginxConfig(
	nginxBin: string,
	paths: RuntimePaths,
): { supportsErrorFlag: boolean } {
	const withErrorFlag = Bun.spawnSync(
		[
			nginxBin,
			"-t",
			"-p",
			paths.nginxDir,
			"-e",
			paths.errorLogPath,
			"-c",
			paths.confPath,
		],
		{ stderr: "pipe", stdout: "pipe" },
	);
	if (withErrorFlag.exitCode === 0) {
		return { supportsErrorFlag: true };
	}
	const stderr = new TextDecoder().decode(withErrorFlag.stderr);
	if (stderr.includes('invalid option: "-e"')) {
		const fallback = Bun.spawnSync(
			[nginxBin, "-t", "-p", paths.nginxDir, "-c", paths.confPath],
			{ stderr: "pipe", stdout: "pipe" },
		);
		if (fallback.exitCode === 0) {
			return { supportsErrorFlag: false };
		}
		throw new Error(
			`nginx configuration test failed:\n${new TextDecoder().decode(fallback.stderr)}`,
		);
	}
	throw new Error(`nginx configuration test failed:\n${stderr}`);
}

async function assertPortFree(
	host: string,
	port: number,
	label: string,
): Promise<void> {
	await new Promise<void>((resolvePromise, reject) => {
		const probe = createServer();
		probe.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE") {
				reject(
					new Error(
						`${label}端口 ${host}:${port} 已被占用，请先停止冲突进程后重试。`,
					),
				);
				return;
			}
			reject(error);
		});
		probe.listen(port, host, () => {
			probe.close((closeErr) => {
				if (closeErr) reject(closeErr);
				else resolvePromise();
			});
		});
	});
}

async function waitForPort(
	host: string,
	port: number,
	child: ChildProcess,
	label: string,
	timeoutMs: number,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (child.exitCode !== null || child.signalCode !== null) {
			throw new Error(`${label}在启动阶段提前退出。`);
		}
		const ready = await new Promise<boolean>((resolvePromise) => {
			const socket = createConnection({ host, port });
			socket.once("connect", () => {
				socket.destroy();
				resolvePromise(true);
			});
			socket.once("error", () => {
				socket.destroy();
				resolvePromise(false);
			});
		});
		if (ready) return;
		await Bun.sleep(150);
	}
	throw new Error(`等待${label}监听 ${host}:${port} 超时。`);
}

function spawnManaged(
	command: string,
	args: string[],
	options: { cwd: string; env: Record<string, string | undefined> },
): ChildProcess {
	return spawn(command, args, {
		cwd: options.cwd,
		env: options.env,
		stdio: "inherit",
	});
}

async function stopChild(child: ChildProcess | null): Promise<void> {
	if (!child || child.exitCode !== null || child.signalCode !== null) {
		return;
	}
	await new Promise<void>((resolvePromise) => {
		const timer = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
			}
			resolvePromise();
		}, SHUTDOWN_GRACE_MS);
		child.once("exit", () => {
			clearTimeout(timer);
			resolvePromise();
		});
		child.kill("SIGTERM");
	});
}

export async function runDevHttps(): Promise<void> {
	const rootDir = resolve(import.meta.dirname, "..");
	const paths = resolveRuntimePaths(rootDir);

	const nginxBin = await findBinary("nginx", [
		"/usr/bin/nginx",
		"/usr/sbin/nginx",
		"/sbin/nginx",
		"/home/linuxbrew/.linuxbrew/bin/nginx",
	]);
	if (!nginxBin) {
		console.error(
			"未找到 nginx。请先安装（例如 Arch Linux 执行 sudo pacman -S nginx），然后重新运行 bun run dev:https。",
		);
		process.exit(1);
	}

	const opensslBin = await findBinary("openssl", ["/usr/bin/openssl"]);
	if (!opensslBin) {
		console.error("未找到 openssl，无法生成本地自签 SSL 证书。");
		process.exit(1);
	}

	const config = loadConfig();
	const httpsPort = config.dev.httpsPort;
	const backendPort = config.port;
	const clientPort = config.dev.clientPort;

	const configText = generateNginxConfig({
		httpsPort,
		backendPort,
		clientPort,
		paths,
	});

	await assertPortFree("0.0.0.0", httpsPort, "HTTPS 入口");
	await assertPortFree("127.0.0.1", backendPort, "后端服务");
	await assertPortFree("127.0.0.1", clientPort, "Vite 前端");

	const hostInfo = collectHostInfo(
		networkInterfaces(),
		config.dev.httpsHosts.join(","),
	);
	const regenerated = await ensureDevCertificate(
		paths,
		hostInfo.sanEntries,
		opensslBin,
	);
	await prepareNginxFiles(paths, configText);
	const { supportsErrorFlag } = validateNginxConfig(nginxBin, paths);

	const corsOrigins = buildCorsOrigins(
		httpsPort,
		hostInfo.corsHosts,
		config.corsOrigins.join(","),
	);
	const existingAllowedHosts = process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const allowedHosts = [
		...new Set([
			...(existingAllowedHosts ?? []),
			...hostInfo.additionalAllowedHosts,
		]),
	].join(",");

	const runtimeConfigPath = join(paths.runtimeDir, "cogm.json");
	await mkdir(paths.runtimeDir, { recursive: true });
	await writeFile(
		runtimeConfigPath,
		`${JSON.stringify(
			toFileConfig({
				...config,
				host: "127.0.0.1",
				port: backendPort,
				trustProxy: true,
				corsOrigins: corsOrigins.split(",").filter(Boolean),
			}),
			null,
			2,
		)}\n`,
	);

	const serverProc = spawnManaged(
		process.execPath,
		["run", "--watch", "src/index.ts"],
		{
			cwd: join(rootDir, "apps/server"),
			env: {
				...process.env,
				COGM_CONFIG: runtimeConfigPath,
			},
		},
	);

	const clientProc = spawnManaged(
		process.execPath,
		[
			"./node_modules/.bin/vite",
			"--host",
			"127.0.0.1",
			"--port",
			String(clientPort),
			"--strictPort",
		],
		{
			cwd: join(rootDir, "apps/client"),
			env: {
				...process.env,
				...(allowedHosts
					? { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: allowedHosts }
					: {}),
			},
		},
	);

	let nginxProc: ChildProcess | null = null;
	let shuttingDown = false;

	const shutdown = async (exitCode: number) => {
		if (shuttingDown) return;
		shuttingDown = true;
		await Promise.all([
			stopChild(nginxProc),
			stopChild(clientProc),
			stopChild(serverProc),
		]);
		process.exit(exitCode);
	};

	process.on("SIGINT", () => {
		void shutdown(0);
	});
	process.on("SIGTERM", () => {
		void shutdown(0);
	});

	for (const [name, child] of [
		["后端服务", serverProc],
		["Vite 前端", clientProc],
	] as const) {
		child.once("exit", (code, signal) => {
			if (!shuttingDown) {
				console.error(
					`${name}已退出（code=${code ?? "null"}, signal=${signal ?? "null"}），正在停止其余服务…`,
				);
				void shutdown(code && code !== 0 ? code : 1);
			}
		});
	}

	try {
		await Promise.all([
			waitForPort("127.0.0.1", backendPort, serverProc, "后端服务", STARTUP_TIMEOUT_MS),
			waitForPort("127.0.0.1", clientPort, clientProc, "Vite 前端", STARTUP_TIMEOUT_MS),
		]);

		const nginxArgs = supportsErrorFlag
			? [
					"-p",
					paths.nginxDir,
					"-e",
					paths.errorLogPath,
					"-c",
					paths.confPath,
				]
			: ["-p", paths.nginxDir, "-c", paths.confPath];
		nginxProc = spawnManaged(nginxBin, nginxArgs, {
			cwd: rootDir,
			env: process.env,
		});
		nginxProc.once("exit", (code, signal) => {
			if (!shuttingDown) {
				console.error(
					`Nginx 已退出（code=${code ?? "null"}, signal=${signal ?? "null"}），正在停止其余服务…`,
				);
				void shutdown(code && code !== 0 ? code : 1);
			}
		});

		console.log("");
		console.log("CoGM HTTPS 开发入口已启动（非 root Nginx 路径转发）：");
		console.log(`  本机访问: https://localhost:${httpsPort}`);
		for (const host of hostInfo.displayHosts) {
			console.log(`  局域网:   https://${formatHostForUrl(host)}:${httpsPort}`);
		}
		console.log(
			`  路径转发: /api/* -> 127.0.0.1:${backendPort} | /* -> 127.0.0.1:${clientPort}`,
		);
		console.log(
			`  自签证书: ${paths.certPath}${regenerated ? "（已生成）" : "（复用现有）"}`,
		);
		console.log(
			"  提示: 首次使用自签证书时，浏览器需点击“高级 -> 继续前往”以信任证书（含 WSS 与麦克风权限）。",
		);
		console.log("");
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		await shutdown(1);
	}
}

if (import.meta.main) {
	runDevHttps().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
