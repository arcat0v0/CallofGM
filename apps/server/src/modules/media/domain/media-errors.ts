import { AppError } from "@/platform/errors/app-error";

export class MediaAssetNotFoundError extends AppError {
	constructor(message = "Media asset not found") {
		super("MEDIA_NOT_FOUND", message, 404);
	}
}

export class UnauthorizedMediaAccessError extends AppError {
	constructor(message = "Unauthorized access to media asset") {
		super("UNAUTHORIZED_MEDIA_ACCESS", message, 403);
	}
}

export class FileSizeExceededError extends AppError {
	constructor(message = "File size exceeds the maximum limit of 10MB") {
		super("FILE_SIZE_EXCEEDED", message, 400);
	}
}

export class UnsupportedMimeTypeError extends AppError {
	constructor(message = "Unsupported mime type") {
		super("UNSUPPORTED_MIME_TYPE", message, 400);
	}
}

export class InvalidFileContentError extends AppError {
	constructor(message = "Invalid file content or format mismatch") {
		super("INVALID_FILE_CONTENT", message, 400);
	}
}
