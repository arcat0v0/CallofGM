import type { SessionsRepository } from "@/modules/sessions";
import {
	SessionNotFoundError,
	SessionStateInvalidError,
} from "@/modules/sessions";
import { AppError } from "@/platform/errors/app-error";
import type { Clock } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import {
	CharacterNotFoundError,
	CharacterSyncVersionConflictError,
} from "../domain/errors";
import type { CharactersRepository } from "./ports";

export interface SessionSyncDiff {
	characterId: string;
	sessionId: string;
	sessionName: string;
	currentName: string;
	currentBackground: string;
	currentSheetJson: string;
	baseName: string;
	baseBackground: string;
	baseSheetJson: string;
	currentVersion: number;
	baseVersion: number;
	staleReview: boolean;
}

export class PreviewCharacterSyncUseCase {
	constructor(
		private readonly characters: CharactersRepository,
		private readonly sessions: SessionsRepository,
	) {}

	async execute(input: {
		ownerId: string;
		sessionId: string;
		characterId: string;
	}): Promise<SessionSyncDiff> {
		const session = await this.sessions.findSessionById(input.sessionId);
		if (!session || session.ownerId !== input.ownerId) {
			throw new SessionNotFoundError();
		}
		const snapshot = await this.sessions.findSessionCharacterSnapshot(
			input.sessionId,
			input.characterId,
		);
		if (!snapshot) {
			throw new CharacterNotFoundError("Character is not part of this session");
		}
		const character = await this.characters.findCharacterById(
			input.characterId,
		);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}

		const review = await this.characters.findReviewForCharacter(
			"session",
			input.sessionId,
			input.characterId,
		);

		return {
			characterId: character.id,
			sessionId: session.id,
			sessionName: session.name ?? session.id,
			currentName: character.name,
			currentBackground: character.background,
			currentSheetJson: character.sheetJson,
			baseName: snapshot.name,
			baseBackground: snapshot.background,
			baseSheetJson: snapshot.sheetJson,
			currentVersion: character.version,
			baseVersion: snapshot.baseSheetVersion,
			staleReview:
				review !== null &&
				review.submittedSheetVersion !== character.sheetVersion,
		};
	}
}

export class ApplyCharacterSyncUseCase {
	constructor(
		private readonly characters: CharactersRepository,
		private readonly sessions: SessionsRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		sessionId: string;
		characterId: string;
		fields: Array<"name" | "background" | "sheet">;
		expectedVersion: number;
	}) {
		const session = await this.sessions.findSessionById(input.sessionId);
		if (!session || session.ownerId !== input.ownerId) {
			throw new SessionNotFoundError();
		}
		if (session.status === "ended") {
			throw new SessionStateInvalidError(
				"Cannot sync characters in an ended session",
			);
		}

		const snapshot = await this.sessions.findSessionCharacterSnapshot(
			input.sessionId,
			input.characterId,
		);
		if (!snapshot) {
			throw new CharacterNotFoundError("Character is not part of this session");
		}
		const character = await this.characters.findCharacterById(
			input.characterId,
		);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (character.version !== input.expectedVersion) {
			throw new CharacterSyncVersionConflictError();
		}

		const patch: {
			name?: string;
			background?: string;
			sheetJson?: string;
			baseSheetVersion?: number;
			baseProfileVersion?: number;
		} = {};

		if (input.fields.includes("name")) {
			patch.name = character.name;
		}
		if (input.fields.includes("background")) {
			patch.background = character.background;
		}
		if (input.fields.includes("sheet")) {
			const ruleSystem = this.ruleRegistry.get(character.ruleId);
			ruleSystem.characterSheetSchema.parse(JSON.parse(character.sheetJson));
			patch.sheetJson = character.sheetJson;
			patch.baseSheetVersion = character.sheetVersion;
		}
		if (input.fields.includes("name") || input.fields.includes("background")) {
			patch.baseProfileVersion = character.profileVersion;
		}

		await this.sessions.updateSessionCharacterSnapshot(
			input.sessionId,
			input.characterId,
			patch,
		);
		return { applied: input.fields, syncedAt: this.clock.nowEpochMs() };
	}
}
