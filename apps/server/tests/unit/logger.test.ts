import { describe, expect, test } from "bun:test";
import { redactSensitivePath } from "@/platform/logging/logger";

describe("redactSensitivePath", () => {
	test("redacts invite tokens in PL API paths", () => {
		expect(redactSensitivePath("/api/v1/pl/invites/token-value")).toBe(
			"/api/v1/pl/invites/[redacted]",
		);
		expect(
			redactSensitivePath("/api/v1/pl/invites/token-value/submissions"),
		).toBe("/api/v1/pl/invites/[redacted]/submissions");
	});

	test("redacts submit page tokens", () => {
		expect(redactSensitivePath("/submit/token-value")).toBe(
			"/submit/[redacted]",
		);
	});

	test("leaves non-sensitive paths unchanged", () => {
		expect(redactSensitivePath("/api/v1/pl/invites")).toBe(
			"/api/v1/pl/invites",
		);
		expect(redactSensitivePath("/api/v1/gm/invites/invite-id")).toBe(
			"/api/v1/gm/invites/invite-id",
		);
		expect(redactSensitivePath("/submit")).toBe("/submit");
	});
});
