import { AppError } from "@/platform/errors/app-error";

export class AuthRequiredError extends AppError {
  constructor(message = "Authentication required") {
    super("AUTH_REQUIRED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid credentials") {
    super("INVALID_CREDENTIALS", message, 401);
  }
}

export class GmPasswordNotConfiguredError extends AppError {
  constructor() {
    super("GM_PASSWORD_NOT_CONFIGURED", "尚未设置 GM 密码。请运行 bun run --cwd apps/server setup:gm <密码> 完成初始化", 503);
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = "Session expired") {
    super("SESSION_EXPIRED", message, 401);
  }
}

export class BlacklistedFingerprintError extends AppError {
  constructor(message = "Access denied from this fingerprint") {
    super("BLACKLISTED_FINGERPRINT", message, 403);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = "Invalid token") {
    super("INVALID_TOKEN", message, 401);
  }
}
