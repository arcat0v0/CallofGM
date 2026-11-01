import { RateLimiter } from "./rate-limiter";

export class HttpLimits {
  readonly loginRateLimiter: RateLimiter;
  readonly identityRateLimiter: RateLimiter;
  readonly joinRateLimiter: RateLimiter;
  readonly uploadRateLimiter: RateLimiter;

  constructor(
    limits?: {
      login?: RateLimiter;
      identity?: RateLimiter;
      join?: RateLimiter;
      upload?: RateLimiter;
    }
  ) {
    this.loginRateLimiter = limits?.login ?? new RateLimiter(10, 60_000);
    this.identityRateLimiter = limits?.identity ?? new RateLimiter(60, 60_000);
    this.joinRateLimiter = limits?.join ?? new RateLimiter(30, 60_000);
    this.uploadRateLimiter = limits?.upload ?? new RateLimiter(20, 60_000);
  }

  reset(): void {
    this.loginRateLimiter.reset();
    this.identityRateLimiter.reset();
    this.joinRateLimiter.reset();
    this.uploadRateLimiter.reset();
  }
}
