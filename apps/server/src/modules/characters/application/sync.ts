import type { SessionsRepository } from "@/modules/sessions";
import {
	SessionNotFoundError,
	SessionStateInvalidError,
} from "@/modules/sessions";
import type { Clock } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import {
	CharacterNotFoundError,
	CharacterSyncVersionConflictError,
} from "../domain/errors";
import type { CharactersRepository } from "./ports";

export interface SyncStatePreview {
	current: {
		hp: number;
		maxHp: number;
		mp: number;
		maxMp: number;
		san: number;
		maxSan: number;
	};
	next: {
		hp: number;
		maxHp: number;
		mp: number;
		maxMp: number;
		san: number;
		maxSan: number;
	};
}

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
	statePreview?: SyncStatePreview;
}

function buildStatePreview(
	ruleRegistry: RuleRegistry,
	ruleId: string,
	currentSheetJson: string,
	newSheetJson: string,
	stateJson: string,
): SyncStatePreview | undefined {
	const rule = ruleRegistry.get(ruleId);
	const sheet = rule.characterSheetSchema.parse(JSON.parse(newSheetJson));
	const state = rule.sessionStateSchema.parse(JSON.parse(stateJson)) as Record<string, number>;
	const next = rule.recalculateStateOnSync(state, sheet) as Record<string, number>;
	return {
		current: {
			hp: state.hp!, maxHp: state.maxHp!,
			mp: state.mp!, maxMp: state.maxMp!,
			san: state.san!, maxSan: state.maxSan!,
		},
		next: {
			hp: next.hp!, maxHp: next.maxHp!,
			mp: next.mp!, maxMp: next.maxMp!,
			san: next.san!, maxSan: next.maxSan!,
		},
	};
}

export class PreviewCharacterSyncUseCase {
	constructor(
		private readonly characters: CharactersRepository,
		private readonly sessions: SessionsRepository,
		private readonly ruleRegistry: RuleRegistry,
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

		let statePreview: SyncStatePreview | undefined;
		if (snapshot.sheetJson !== character.sheetJson && snapshot.stateJson) {
			statePreview = buildStatePreview(
				this.ruleRegistry,
				character.ruleId,
				snapshot.sheetJson,
				character.sheetJson,
				snapshot.stateJson,
			);
		}

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
			statePreview,
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
			stateJson?: string;
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
			const parsedSheet = ruleSystem.characterSheetSchema.parse(
				JSON.parse(character.sheetJson),
			);
			patch.sheetJson = JSON.stringify(parsedSheet);
			patch.baseSheetVersion = character.sheetVersion;

			if (snapshot.stateJson) {
				const state = ruleSystem.sessionStateSchema.parse(
					JSON.parse(snapshot.stateJson),
				);
				const nextState = ruleSystem.recalculateStateOnSync(state, parsedSheet);
				patch.stateJson = JSON.stringify(nextState);
			}
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
