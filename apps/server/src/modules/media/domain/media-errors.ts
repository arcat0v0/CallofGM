import { MAX_MEDIA_UPLOAD_MB } from "@cogm/shared";
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
	constructor(
		message = `File size exceeds the maximum limit of ${MAX_MEDIA_UPLOAD_MB}MB`,
	) {
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

export class PendingUploadNotFoundError extends AppError {
	constructor(message = "Pending media upload ticket not found") {
		super("PENDING_UPLOAD_NOT_FOUND", message, 404);
	}
}

export class PendingUploadExpiredError extends AppError {
	constructor(message = "Pending media upload ticket has expired") {
		super("PENDING_UPLOAD_EXPIRED", message, 400);
	}
}

export class UploadedObjectMissingError extends AppError {
	constructor(message = "Uploaded object was not found in object storage") {
		super("UPLOADED_OBJECT_MISSING", message, 400);
	}
}

export class UploadSizeMismatchError extends AppError {
	constructor(message = "Uploaded object size does not match declared size") {
		super("UPLOAD_SIZE_MISMATCH", message, 400);
	}
}

export class StorageUnavailableError extends AppError {
	constructor(message = "Object storage is currently unavailable") {
		super("STORAGE_UNAVAILABLE", message, 502);
	}
}
