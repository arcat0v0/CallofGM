import { describe, expect, test } from "bun:test";
import { LoginSearch, loginHref, safeReturnTo } from "../src/login";

describe("login return destination", () => {
	test("builds a typed login link for a session invitation", () => {
		const href = loginHref("/join/session-1");
		expect(href).toBe("/login?returnTo=%2Fjoin%2Fsession-1");
		expect(LoginSearch.parse({ returnTo: "/join/session-1" }).returnTo).toBe(
			"/join/session-1",
		);
	});

	test("accepts only the application entry paths", () => {
		expect(safeReturnTo("/join/session-1")).toBe("/join/session-1");
		expect(safeReturnTo("/play/session-1")).toBe("/play/session-1");
		expect(safeReturnTo("/submit/invite-token")).toBe("/submit/invite-token");
		expect(safeReturnTo("/admin/users")).toBeNull();
		expect(safeReturnTo("https://example.com/join/session-1")).toBeNull();
		expect(safeReturnTo("//example.com/join/session-1")).toBeNull();
		expect(safeReturnTo("/join/../admin")).toBeNull();
		expect(safeReturnTo(null)).toBeNull();
	});
});
