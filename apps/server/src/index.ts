import { createApp } from "./app";
import { Container } from "./bootstrap/container";
import { buildCommandHandlers } from "./bootstrap/handlers";
import { loadConfig } from "./config/app-config";

function loadConfigOrExit() {
	try {
		return loadConfig();
	} catch (error) {
		console.error(
			"Failed to load configuration:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}

const container = new Container([], { config: loadConfigOrExit() });
container.sessionCommandExecutor.registerHandlers(
	buildCommandHandlers(container),
);

try {
	await container.startupService.startup();
	console.log("Startup sequence completed successfully.");
} catch (err) {
	console.error("Startup sequence failed:", err);
	process.exit(1);
}

const app = createApp(container);

const listenTarget = container.config.host
	? { port: container.config.port, hostname: container.config.host }
	: container.config.port;

const server = app.listen(listenTarget, () => {
	console.log(
		`CoGM server running at http://${app.server?.hostname}:${app.server?.port}`,
	);
});

let shuttingDown = false;

/**
 * 优雅退出（带期限）：
 * 停止接受新连接 → 关闭活跃 WS 连接 → 停止后台任务 → 关闭数据库。
 * 已知 Bun 行为：服务端主动关闭过 WS 连接后 server.stop() 可能永不 resolve，
 * 因此所有等待都带期限，到期强制退出。
 */
async function shutdown() {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	console.log("Shutting down gracefully...");

	const deadline = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));

	try {
		container.connectionRegistry.closeAll(1001, "server shutdown");
		await Promise.race([Promise.resolve(server.stop(true)), deadline(2000)]);
	} catch (err) {
		console.error("Error stopping server:", err);
	}

	try {
		container.startupService.stop();
		container.dbContext.sqlite.close();
	} catch (err) {
		console.error("Error closing database:", err);
	}
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
