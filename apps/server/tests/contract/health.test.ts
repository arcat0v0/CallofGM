import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type App, createApp } from "@/app";
import { Container } from "@/bootstrap/container";
import { testAppConfig } from "../helpers/setup";

describe("Health endpoints", () => {
	let container: Container;
	let app: App;

	beforeAll(() => {
		container = new Container([], { config: testAppConfig() });
		app = createApp(container);
	});

	afterAll(() => {
		container.dbContext.sqlite.close();
	});

	test("GET /api/health/live should return live status", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/health/live"),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ status: "live" });
	});

	test("GET /api/health/ready should return 503 before startup", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/health/ready"),
		);
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body).toEqual({ status: "service not ready" });
	});

	test("GET /api/health/ready should return 200 after startup", async () => {
		await container.startupService.startup();
		const response = await app.handle(
			new Request("http://localhost/api/health/ready"),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ status: "ready" });
	});
});
