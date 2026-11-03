import { AppError } from "@/platform/errors/app-error";

export class SessionNotFoundError extends AppError {
	constructor(message = "Session not found") {
		super("SESSION_NOT_FOUND", message, 404);
	}
}

export class SessionStateInvalidError extends AppError {
	constructor(message = "Session state is invalid") {
		super("SESSION_STATE_INVALID", message, 400);
	}
}

export class SessionPhaseForbidsActionError extends AppError {
	constructor(message = "Session phase forbids this action") {
		super("SESSION_PHASE_FORBIDS_ACTION", message, 400);
	}
}

export class SeatAlreadyClaimedError extends AppError {
	constructor(message = "Seat already claimed") {
		super("SEAT_ALREADY_CLAIMED", message, 400);
	}
}

export class SessionKickedError extends AppError {
	constructor(message = "You were removed from this session by the GM") {
		super("SESSION_KICKED", message, 403);
	}
}

export class CharacterAlreadyParticipatingError extends AppError {
	constructor(message = "Character already participating in session") {
		super("CHARACTER_ALREADY_PARTICIPATING", message, 400);
	}
}

export class CharacterNotInModuleError extends AppError {
	constructor(message = "Character is not linked to this module") {
		super("CHARACTER_NOT_IN_MODULE", message, 400);
	}
}
