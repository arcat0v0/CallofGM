import { AppError } from "@/platform/errors/app-error";

export class HandoutNotFoundError extends AppError {
	constructor(message = "Handout not found in this module") {
		super("HANDOUT_NOT_FOUND", message, 404);
	}
}

export class HandoutGrantNotFoundError extends AppError {
	constructor(message = "Handout grant not found") {
		super("HANDOUT_GRANT_NOT_FOUND", message, 404);
	}
}
