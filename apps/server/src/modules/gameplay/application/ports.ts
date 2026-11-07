export interface CharacterSummary {
	id: string;
	name: string;
	kind: string;
	ruleId: string;
	sheetJson: string;
}

export interface SessionCharacterSummary {
	kind: string;
	stateJson: string;
	sheetJson: string;
}

export interface CheckRequestRecord {
	id: string;
	sessionId: string;
	characterId: string;
	skillKey: string;
	difficulty: string;
	bonusDice: number;
	penaltyDice: number;
	hidden: number;
	sanLossExpression: string | null;
	status: string;
	resolvedCheckResultJson: string | null;
	createdAt: number;
}

export interface GameplayRepository {
	findCharacter(characterId: string): Promise<CharacterSummary | null>;
	findSessionCharacter(
		sessionId: string,
		characterId: string,
	): Promise<SessionCharacterSummary | null>;
	updateSessionCharacterState(
		sessionId: string,
		characterId: string,
		stateJson: string,
	): Promise<void>;
	insertCheckRequest(row: {
		id: string;
		sessionId: string;
		characterId: string;
		skillKey: string;
		difficulty: string;
		bonusDice: number;
		penaltyDice: number;
		hidden: number;
		sanLossExpression: string | null;
		status: string;
		resolvedCheckResultJson: string | null;
		createdAt: number;
	}): Promise<void>;
	findCheckRequest(id: string): Promise<CheckRequestRecord | null>;
	resolveCheckRequestIfPending(
		id: string,
		resolvedCheckResultJson: string,
	): Promise<boolean>;
}
