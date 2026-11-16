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
	constructor(
		message = "Invalid SAN loss expression, expected format: success/failure (e.g. 1/1d6)",
	) {
		super("INVALID_SAN_LOSS_EXPRESSION", message, 400);
	}
}

export class LuckSpendNotAllowedError extends AppError {
	constructor(message = "Luck cannot be spent on this check") {
		super("LUCK_SPEND_NOT_ALLOWED", message, 400);
	}
}

export class LuckSpendNotLatestError extends AppError {
	constructor(message = "Only the most recent check can be amended") {
		super("LUCK_SPEND_NOT_LATEST", message, 409);
	}
}

export class LuckSpendAlreadyUsedError extends AppError {
	constructor(message = "Luck has already been spent on this check") {
		super("LUCK_SPEND_ALREADY_USED", message, 409);
	}
}

export class LuckSpendInsufficientError extends AppError {
	constructor(message = "Not enough current luck") {
		super("LUCK_SPEND_INSUFFICIENT", message, 400);
	}
}

export class LuckSpendInvalidPointsError extends AppError {
	constructor(message = "Luck points do not match an available tier") {
		super("LUCK_SPEND_INVALID_POINTS", message, 400);
	}
}
