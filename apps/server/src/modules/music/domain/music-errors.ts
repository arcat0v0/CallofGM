import { AppError } from "@/platform/errors/app-error";

export class MusicReferenceInvalidError extends AppError {
	constructor() {
		super(
			"MUSIC_REFERENCE_INVALID",
			"Invalid official music song reference",
			400,
		);
	}
}

export class MusicPlaylistReferenceInvalidError extends AppError {
	constructor() {
		super(
			"MUSIC_PLAYLIST_REFERENCE_INVALID",
			"Invalid official music playlist reference",
			400,
		);
	}
}

export class MusicPlaylistNotFoundError extends AppError {
	constructor() {
		super(
			"MUSIC_PLAYLIST_NOT_FOUND",
			"Music playlist not found or not publicly accessible",
			404,
		);
	}
}

export class MusicPlaylistEmptyError extends AppError {
	constructor() {
		super("MUSIC_PLAYLIST_EMPTY", "Music playlist is empty", 422);
	}
}

export class MusicNotFoundError extends AppError {
	constructor() {
		super("MUSIC_NOT_FOUND", "Music track not found", 404);
	}
}

export class MusicUnavailableError extends AppError {
	constructor() {
		super(
			"MUSIC_UNAVAILABLE",
			"This song is not publicly playable without login, purchase, VIP or regional rights",
			422,
		);
	}
}

export class MusicProviderError extends AppError {
	constructor() {
		super(
			"MUSIC_PROVIDER_ERROR",
			"The official music provider could not be reached",
			502,
		);
	}
}

export class MusicProviderTimeoutError extends AppError {
	constructor() {
		super(
			"MUSIC_PROVIDER_TIMEOUT",
			"The official music provider timed out",
			504,
		);
	}
}

export class MusicProviderResponseInvalidError extends AppError {
	constructor() {
		super(
			"MUSIC_PROVIDER_RESPONSE_INVALID",
			"The official music provider returned an invalid or disallowed response",
			502,
		);
	}
}

export class MusicStreamTooLargeError extends AppError {
	constructor() {
		super(
			"MUSIC_STREAM_TOO_LARGE",
			"The official music stream exceeds the size limit",
			502,
		);
	}
}

export class MusicRangeInvalidError extends AppError {
	constructor() {
		super("MUSIC_RANGE_INVALID", "Only one byte range is supported", 416);
	}
}
