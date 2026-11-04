import { AppError } from "@/platform/errors/app-error";

export class MessageNotFoundError extends AppError {
	constructor(message = "Message not found") {
		super("MESSAGE_NOT_FOUND", message, 404);
	}
}

export class MessageNotPendingError extends AppError {
	constructor(message = "Message is not pending presentation") {
		super("MESSAGE_NOT_PENDING", message, 409);
	}
}

export class ExpressionNotFoundError extends AppError {
	constructor(message = "Expression portrait not found for this character") {
		super("EXPRESSION_NOT_FOUND", message, 400);
	}
}

export class ChatSpeakerInvalidError extends AppError {
	constructor(
		message = "Chat speaker is not a controllable NPC in this session",
	) {
		super("CHAT_SPEAKER_INVALID", message, 400);
	}
}
