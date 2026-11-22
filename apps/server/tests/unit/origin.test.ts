import { describe, expect, test } from "bun:test";
import { AppError } from "@/platform/errors/app-error";
import {
	assertTrustedOrigin,
	isAllowedOrigin,
	requestOrigin,
} from "@/platform/security/origin";

function request(headers: Record<string, string>, url = "http://127.0.0.1:15632/api/v1/auth/login") {
	return new Request(url, { method: "POST", headers });
}

describe("origin behind a TLS proxy", () => {
	test("trusted proxy reconstructs the public origin", () => {
		const req = request({
			host: "127.0.0.1:15632",
			"x-forwarded-proto": "https",
			"x-forwarded-host": "cogm.yuy.net.cn",
		});
		expect(requestOrigin(req, true)).toBe("https://cogm.yuy.net.cn");
	});

	test("trusted proxy falls back to the Host header", () => {
		const req = request({
			host: "cogm.yuy.net.cn",
			"x-forwarded-proto": "https",
		});
		expect(requestOrigin(req, true)).toBe("https://cogm.yuy.net.cn");
	});

	test("untrusted requests ignore spoofed forwarded headers", () => {
		const req = request({
			host: "127.0.0.1:15632",
			"x-forwarded-proto": "https",
			"x-forwarded-host": "evil.example",
		});
		expect(requestOrigin(req, false)).toBe("http://127.0.0.1:15632");
	});

	test("invalid forwarded protocol is ignored", () => {
		const req = request({
			host: "cogm.yuy.net.cn",
			"x-forwarded-proto": "javascript",
		});
		expect(requestOrigin(req, true)).toBe("http://127.0.0.1:15632");
	});
});

describe("origin comparison", () => {
	test("explicit allow list wins", () => {
		expect(isAllowedOrigin("https://a.example", ["https://a.example"], "http://b")).toBe(true);
		expect(isAllowedOrigin("https://c.example", ["https://a.example"], "http://b")).toBe(false);
	});

	test("empty allow list compares against the expected origin", () => {
		expect(isAllowedOrigin("https://cogm.yuy.net.cn", [], "https://cogm.yuy.net.cn")).toBe(true);
		expect(isAllowedOrigin("https://evil.example", [], "https://cogm.yuy.net.cn")).toBe(false);
	});

	test("browser write with the public origin passes behind the proxy", () => {
		const req = request({
			origin: "https://cogm.yuy.net.cn",
			host: "127.0.0.1:15632",
			"x-forwarded-proto": "https",
			"x-forwarded-host": "cogm.yuy.net.cn",
		});
		expect(() => assertTrustedOrigin(req, [], true)).not.toThrow();
	});

	test("spoofed forwarded headers do not bypass the check when proxy trust is off", () => {
		const req = request({
			origin: "https://evil.example",
			host: "127.0.0.1:15632",
			"x-forwarded-proto": "https",
			"x-forwarded-host": "evil.example",
		});
		expect(() => assertTrustedOrigin(req, [], false)).toThrow(AppError);
	});

	test("non-browser writes without Origin or Referer still pass", () => {
		expect(() => assertTrustedOrigin(request({}), [], true)).not.toThrow();
	});
});
