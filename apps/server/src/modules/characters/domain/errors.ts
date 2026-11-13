import { AppError } from "@/platform/errors/app-error";

export class CharacterNotFoundError extends AppError {
	constructor(message = "Character not found") {
		super("CHARACTER_NOT_FOUND", message, 404);
	}
}

export class CharacterVersionConflictError extends AppError {
	constructor(message = "Character was modified concurrently") {
		super("CHARACTER_VERSION_CONFLICT", message, 409);
	}
}

export class CharacterSyncVersionConflictError extends AppError {
	constructor(
		message = "Session snapshot is out of date; reload before syncing",
	) {
		super("CHARACTER_SYNC_CONFLICT", message, 409);
	}
}

export class CharacterNotOwnedError extends AppError {
	constructor(message = "Character does not belong to this account") {
		super("CHARACTER_NOT_OWNED", message, 403);
	}
}

export class PermanentFieldNotEditableError extends AppError {
	constructor(message = "This field is not a rule-declared permanent field") {
		super("PERMANENT_FIELD_NOT_EDITABLE", message, 400);
	}
}

export class InviteNotFoundError extends AppError {
	constructor(message = "Invite link not found") {
		super("INVITE_NOT_FOUND", message, 404);
	}
}

export class InviteExpiredError extends AppError {
	constructor(message = "Invite link has expired or was revoked") {
		super("INVITE_EXPIRED", message, 410);
	}
}

export class ReviewNotFoundError extends AppError {
	constructor(message = "Review not found") {
		super("REVIEW_NOT_FOUND", message, 404);
	}
}

export class ReviewAlreadyDecidedError extends AppError {
	constructor(message = "Review has already been decided") {
		super("REVIEW_ALREADY_DECIDED", message, 409);
	}
}

export class ReviewSheetVersionConflictError extends AppError {
	constructor(message = "Sheet version has changed since submission") {
		super("REVIEW_SHEET_VERSION_CONFLICT", message, 409);
	}
}

export class CharacterAlreadySubmittedError extends AppError {
	constructor(message = "This character is already submitted or linked") {
		super("CHARACTER_ALREADY_SUBMITTED", message, 409);
	}
}

export class NoReviewedCharacterError extends AppError {
	constructor(message = "No approved character to claim") {
		super("NO_REVIEWED_CHARACTER", message, 404);
	}
}

export class PortraitNotFoundError extends AppError {
	constructor(message = "Portrait not found") {
		super("PORTRAIT_NOT_FOUND", message, 404);
	}
}

export class StagingRecordNotFoundError extends AppError {
	constructor(message = "Staging record not found") {
		super("STAGING_RECORD_NOT_FOUND", message, 404);
	}
}

export class StagingExpiredError extends AppError {
	constructor(message = "Staging record expired") {
		super("STAGING_EXPIRED", message, 400);
	}
}

export class StagingConsumedError extends AppError {
	constructor(message = "Staging record already consumed") {
		super("STAGING_CONSUMED", message, 409);
	}
}

export class StagingHasErrorsError extends AppError {
	constructor(message = "Staging record has parser errors") {
		super("STAGING_HAS_ERRORS", message, 400);
	}
}

export class InvalidKindError extends AppError {
	constructor(message = "Kind must be pc or npc") {
		super("INVALID_KIND", message, 400);
	}
}

export class ModuleCharacterAlreadyLinkedError extends AppError {
	constructor(message = "Character already linked to module") {
		super("MODULE_CHARACTER_ALREADY_LINKED", message, 409);
	}
}

export class ModuleCharacterNotLinkedError extends AppError {
	constructor(message = "Character is not linked to module") {
		super("MODULE_CHARACTER_NOT_LINKED", message, 404);
	}
}

export class StagingOwnerMismatchError extends AppError {
	constructor(message = "Staging record belongs to a different GM session") {
		super("STAGING_OWNER_MISMATCH", message, 403);
	}
}

export class StagingTargetMismatchError extends AppError {
	constructor(
		message = "Staging record target does not match confirm character target",
	) {
		super("STAGING_TARGET_MISMATCH", message, 409);
	}
}

export class InvalidMediaAssetError extends AppError {
	constructor(message = "Media asset is not valid for this purpose") {
		super("MEDIA_INVALID", message, 400);
	}
}

export class CharacterRuleMismatchError extends AppError {
	constructor(message = "Character rule does not match module rule") {
		super("CHARACTER_RULE_MISMATCH", message, 400);
	}
}

export class CharacterInUseError extends AppError {
	constructor(
		message = "Character is referenced by sessions or records and cannot be deleted",
	) {
		super("CHARACTER_IN_USE", message, 409);
	}
}
