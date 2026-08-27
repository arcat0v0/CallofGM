import { AppError } from "@/platform/errors/app-error";

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super("RATE_LIMITED", message, 429);
  }
}

/**
 * 固定窗口内存限速器（单进程）。
 * 用于登录、身份签发等敏感端点；不按身份细节区分，避免响应泄露内部信息。
 */
export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** 返回 true 表示放行；false 表示超限 */
  check(key: string): boolean {
    if (process.env.COGM_SKIP_RATE_LIMIT === "1") {
      return true;
    }
    const now = Date.now();
    this.sweep(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  assert(key: string): void {
    if (!this.check(key)) {
      throw new RateLimitedError();
    }
  }

  reset(): void {
    this.buckets.clear();
    this.lastSweep = 0;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) {
      return;
    }
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
