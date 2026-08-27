import { AppError } from "@/platform/errors/app-error";

export class CharacterNotFoundError extends AppError {
  constructor(message = "Character not found") {
    super("CHARACTER_NOT_FOUND", message, 404);
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
