import { AppError } from "@/platform/errors/app-error";

export class SkillNotFoundError extends AppError {
  constructor(message = "Skill or attribute not found on character sheet") {
    super("SKILL_NOT_FOUND", message, 400);
  }
}

export class CheckRequestNotFoundError extends AppError {
  constructor(message = "Check request not found") {
    super("CHECK_REQUEST_NOT_FOUND", message, 404);
  }
}

export class CheckRequestAlreadyResolvedError extends AppError {
  constructor(message = "Check request has already been resolved") {
    super("CHECK_REQUEST_ALREADY_RESOLVED", message, 409);
  }
}

export class InvalidSanLossExpressionError extends AppError {
  constructor(message = "Invalid SAN loss expression, expected format: success/failure (e.g. 1/1d6)") {
    super("INVALID_SAN_LOSS_EXPRESSION", message, 400);
  }
}
