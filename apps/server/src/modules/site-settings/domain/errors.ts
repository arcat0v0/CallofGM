import { AppError } from "@/platform/errors/app-error";

export class OriginLockoutError extends AppError {
	constructor(
		message = "Security settings would reject the current admin request origin; adjust trustProxy or corsOrigins before saving",
	) {
		super("ORIGIN_LOCKOUT", message, 400);
	}
}

export class StorageNotConfiguredError extends AppError {
	constructor(
		message = "Object storage (S3) is not fully configured",
		metadata?: Record<string, unknown>,
	) {
		super("STORAGE_NOT_CONFIGURED", message, 400, metadata);
	}
}

export class StorageConfigInvalidError extends AppError {
	constructor(message: string, metadata?: Record<string, unknown>) {
		super("STORAGE_CONFIG_INVALID", message, 400, metadata);
	}
}

export class VoiceConfigInvalidError extends AppError {
	constructor(message: string, metadata?: Record<string, unknown>) {
		super("VOICE_CONFIG_INVALID", message, 400, metadata);
	}
}

export class MigrationAlreadyRunningError extends AppError {
	constructor(message = "A storage migration task is already running") {
		super("MIGRATION_ALREADY_RUNNING", message, 409);
	}
}

export class StorageProbeNotFoundError extends AppError {
	constructor(message = "Storage test probe not found or expired") {
		super("STORAGE_PROBE_NOT_FOUND", message, 404);
	}
}
