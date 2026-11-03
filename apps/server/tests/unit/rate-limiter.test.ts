import { describe, expect, test } from "bun:test";
import { HttpLimits } from "@/platform/security/http-limits";
import { RateLimiter } from "@/platform/security/rate-limiter";

describe("RateLimiter and HttpLimits isolation", () => {
	test("RateLimiter does not honor COGM_SKIP_RATE_LIMIT env bypass", () => {
		process.env.COGM_SKIP_RATE_LIMIT = "1";
		try {
			const limiter = new RateLimiter(2, 60_000);
			expect(limiter.check("ip-1")).toBe(true);
			expect(limiter.check("ip-1")).toBe(true);
			expect(limiter.check("ip-1")).toBe(false);
		} finally {
			delete process.env.COGM_SKIP_RATE_LIMIT;
		}
	});

	test("HttpLimits instances are independent and container-scopeable", () => {
		const limitsA = new HttpLimits();
		const limitsB = new HttpLimits();

		for (let i = 0; i < 10; i++) {
			expect(limitsA.loginRateLimiter.check("10.0.0.1")).toBe(true);
		}
		expect(limitsA.loginRateLimiter.check("10.0.0.1")).toBe(false);
		expect(limitsB.loginRateLimiter.check("10.0.0.1")).toBe(true);

		limitsA.reset();
		expect(limitsA.loginRateLimiter.check("10.0.0.1")).toBe(true);
	});
});
