import { RateLimiter } from "./rate-limiter";

export const loginRateLimiter = new RateLimiter(10, 60_000);
export const identityRateLimiter = new RateLimiter(20, 60_000);
export const joinRateLimiter = new RateLimiter(30, 60_000);
export const uploadRateLimiter = new RateLimiter(20, 60_000);

export function resetHttpLimits(): void {
  process.env.COGM_SKIP_RATE_LIMIT = "1";
  loginRateLimiter.reset();
  identityRateLimiter.reset();
  joinRateLimiter.reset();
  uploadRateLimiter.reset();
}
