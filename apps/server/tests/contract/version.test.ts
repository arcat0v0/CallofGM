import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type BuildInfo, VersionResponseSchema } from "@cogm/shared";
import { type App, createApp } from "@/app";
import { Container } from "@/bootstrap/container";

const override: BuildInfo = {
	version: "9.8.7",
	commit: "abcdef0123456789abcdef0123456789abcdef01",
	buildTime: "2026-11-05T10:20:30.000Z",
	component: "server",
};

describe("Version endpoint", () => {
	let container: Container;
	let app: App;
	const previousCommit = process.env.COGM_COMMIT;
	const previousBuildTime = process.env.COGM_BUILD_TIME;

	beforeAll(() => {
		process.env.DATABASE_URL = ":memory:";
		process.env.COGM_COMMIT = "fedcba9876543210fedcba9876543210fedcba98";
		process.env.COGM_BUILD_TIME = "2026-11-05T11:22:33Z";
		container = new Container();
		app = createApp(container, { serverBuildInfo: override });
	});

	afterAll(() => {
		container.dbContext.sqlite.close();
		if (previousCommit === undefined) {
			delete process.env.COGM_COMMIT;
		} else {
			process.env.COGM_COMMIT = previousCommit;
		}
		if (previousBuildTime === undefined) {
			delete process.env.COGM_BUILD_TIME;
		} else {
			process.env.COGM_BUILD_TIME = previousBuildTime;
		}
	});

	test("returns only the server build with no-store caching", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/version"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		const body = await response.json();
		expect(VersionResponseSchema.parse(body)).toEqual({ server: override });
		expect(body).not.toHaveProperty("client");
		expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
		expect(JSON.stringify(body)).not.toContain("db.sqlite");
	});

	test("reads the root package version and injects commit metadata", async () => {
		const rootPackage = JSON.parse(
			readFileSync(
				new URL("../../../../package.json", import.meta.url),
				"utf8",
			),
		) as { version: string };
		const defaultApp = createApp(container);
		const response = await defaultApp.handle(
			new Request("http://localhost/api/version"),
		);
		const body = VersionResponseSchema.parse(await response.json());

		expect(body.server.version).toBe(rootPackage.version);
		expect(body.server.commit).toBe("fedcba9876543210fedcba9876543210fedcba98");
		expect(body.server.buildTime).toBe("2026-11-05T11:22:33.000Z");
		expect(body.server.component).toBe("server");
	});

	test("stays public and does not require authentication", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/version", {
				headers: { authorization: "" },
			}),
		);
		expect(response.status).toBe(200);
	});
});
