import {
	DEFAULT_SITE_RATE_LIMITS,
	type SiteRateLimits,
} from "@cogm/shared";
import { RateLimiter } from "./rate-limiter";

export class HttpLimits {
	readonly loginRateLimiter: RateLimiter;
	readonly identityRateLimiter: RateLimiter;
	readonly joinRateLimiter: RateLimiter;
	readonly sessionReferenceRateLimiter: RateLimiter;
	readonly uploadRateLimiter: RateLimiter;

	constructor(limits?: {
		login?: RateLimiter;
		identity?: RateLimiter;
		join?: RateLimiter;
		sessionReference?: RateLimiter;
		upload?: RateLimiter;
	}) {
		this.loginRateLimiter =
			limits?.login ??
			new RateLimiter(
				DEFAULT_SITE_RATE_LIMITS.login.limit,
				DEFAULT_SITE_RATE_LIMITS.login.windowSeconds * 1000,
			);
		this.identityRateLimiter =
			limits?.identity ??
			new RateLimiter(
				DEFAULT_SITE_RATE_LIMITS.identity.limit,
				DEFAULT_SITE_RATE_LIMITS.identity.windowSeconds * 1000,
			);
		this.joinRateLimiter =
			limits?.join ??
			new RateLimiter(
				DEFAULT_SITE_RATE_LIMITS.join.limit,
				DEFAULT_SITE_RATE_LIMITS.join.windowSeconds * 1000,
			);
		this.sessionReferenceRateLimiter =
			limits?.sessionReference ??
			new RateLimiter(
				DEFAULT_SITE_RATE_LIMITS.sessionReference.limit,
				DEFAULT_SITE_RATE_LIMITS.sessionReference.windowSeconds * 1000,
			);
		this.uploadRateLimiter =
			limits?.upload ??
			new RateLimiter(
				DEFAULT_SITE_RATE_LIMITS.upload.limit,
				DEFAULT_SITE_RATE_LIMITS.upload.windowSeconds * 1000,
			);
	}

	applyConfig(rules: SiteRateLimits): void {
		this.loginRateLimiter.updateConfig(
			rules.login.limit,
			rules.login.windowSeconds * 1000,
		);
		this.identityRateLimiter.updateConfig(
			rules.identity.limit,
			rules.identity.windowSeconds * 1000,
		);
		this.joinRateLimiter.updateConfig(
			rules.join.limit,
			rules.join.windowSeconds * 1000,
		);
		this.sessionReferenceRateLimiter.updateConfig(
			rules.sessionReference.limit,
			rules.sessionReference.windowSeconds * 1000,
		);
		this.uploadRateLimiter.updateConfig(
			rules.upload.limit,
			rules.upload.windowSeconds * 1000,
		);
	}

	getConfig(): SiteRateLimits {
		const toRule = (limiter: RateLimiter) => {
			const cfg = limiter.getConfig();
			return {
				limit: cfg.limit,
				windowSeconds: Math.max(1, Math.round(cfg.windowMs / 1000)),
			};
		};
		return {
			login: toRule(this.loginRateLimiter),
			identity: toRule(this.identityRateLimiter),
			join: toRule(this.joinRateLimiter),
			sessionReference: toRule(this.sessionReferenceRateLimiter),
			upload: toRule(this.uploadRateLimiter),
		};
	}

	reset(): void {
		this.loginRateLimiter.reset();
		this.identityRateLimiter.reset();
		this.joinRateLimiter.reset();
		this.sessionReferenceRateLimiter.reset();
		this.uploadRateLimiter.reset();
	}
}
