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

export class AccountDisabledError extends AppError {
	constructor(message = "This account is disabled") {
		super("ACCOUNT_DISABLED", message, 403);
	}
}

export class AdminRequiredError extends AppError {
	constructor(message = "Administrator access required") {
		super("ADMIN_REQUIRED", message, 403);
	}
}

export class GmRequiredError extends AppError {
	constructor(message = "Game master access required") {
		super("GM_REQUIRED", message, 403);
	}
}

export class PlayerRequiredError extends AppError {
	constructor(message = "Player account required") {
		super("PLAYER_REQUIRED", message, 403);
	}
}

export class PlayerLoginRequiredError extends AppError {
	constructor(message = "Sign in to claim a player character seat") {
		super("PLAYER_LOGIN_REQUIRED", message, 401);
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

export class UsernameTakenError extends AppError {
	constructor(message = "This username is already taken") {
		super("USERNAME_TAKEN", message, 409);
	}
}

export class UserNotFoundError extends AppError {
	constructor(message = "User not found") {
		super("USER_NOT_FOUND", message, 404);
	}
}

export class LastAdminError extends AppError {
	constructor(message = "At least one active administrator must remain") {
		super("LAST_ADMIN_REQUIRED", message, 409);
	}
}

export class InvalidCurrentPasswordError extends AppError {
	constructor(message = "Current password is incorrect") {
		super("INVALID_CURRENT_PASSWORD", message, 400);
	}
}

export class InvalidPasswordError extends AppError {
	constructor(message = "Password must be between 8 and 128 characters") {
		super("INVALID_PASSWORD", message, 400);
	}
}

export function isPasswordFieldFailure(
	error: { issues: ReadonlyArray<{ path: readonly PropertyKey[] }> },
	field = "password",
): boolean {
	return (
		error.issues.length > 0 &&
		error.issues.every(
			(issue) => issue.path.length === 1 && issue.path[0] === field,
		)
	);
}
