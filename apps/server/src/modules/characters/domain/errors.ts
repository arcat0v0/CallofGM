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
