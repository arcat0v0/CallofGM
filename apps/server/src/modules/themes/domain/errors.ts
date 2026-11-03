import { AppError } from "@/platform/errors/app-error";

export class ThemeNotFoundError extends AppError {
	constructor(message = "Theme not found") {
		super("THEME_NOT_FOUND", message, 404);
	}
}

export class ThemeInvalidError extends AppError {
	constructor(
		message = "Theme package is invalid",
		metadata: Record<string, unknown> = {},
	) {
		super("THEME_INVALID", message, 400, metadata);
	}
}

export class ThemeIncompatibleError extends AppError {
	constructor(message = "Theme API version is not compatible") {
		super("THEME_INCOMPATIBLE", message, 409);
	}
}

export class ThemeVersionConflictError extends AppError {
	constructor(
		message = "Theme version must be greater than the installed version",
	) {
		super("THEME_VERSION_CONFLICT", message, 409);
	}
}

export class ThemeInUseError extends AppError {
	constructor(
		message = "Theme is still in use",
		metadata: Record<string, unknown> = {},
	) {
		super("THEME_IN_USE", message, 409, metadata);
	}
}

export class ThemeTooLargeError extends AppError {
	constructor(message = "Theme package exceeds the size limit") {
		super("THEME_TOO_LARGE", message, 413);
	}
}
