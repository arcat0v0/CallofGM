import { AppError } from "@/platform/errors/app-error";

export class ModuleNotFoundError extends AppError {
	constructor(message = "Module not found") {
		super("MODULE_NOT_FOUND", message, 404);
	}
}

export class SceneNotFoundError extends AppError {
	constructor(message = "Scene not found") {
		super("SCENE_NOT_FOUND", message, 404);
	}
}

export class TrackNotFoundError extends AppError {
	constructor(message = "Track not found") {
		super("TRACK_NOT_FOUND", message, 404);
	}
}

export class HandoutNotFoundError extends AppError {
	constructor(message = "Handout not found") {
		super("HANDOUT_NOT_FOUND", message, 404);
	}
}

export class MediaAssetNotFoundError extends AppError {
	constructor(message = "Media asset not found") {
		super("MEDIA_NOT_FOUND", message, 404);
	}
}

export class MediaAssetInvalidError extends AppError {
	constructor(message = "Media asset is not valid for this purpose") {
		super("MEDIA_INVALID", message, 400);
	}
}

export class ModuleInUseError extends AppError {
	constructor(
		message = "Module is referenced by sessions and cannot be deleted",
	) {
		super("MODULE_IN_USE", message, 409);
	}
}
