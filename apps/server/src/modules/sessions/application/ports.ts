import type { DbClient } from "@/platform/db/client";

export type HolderKind = "user" | "anonymous";

export interface SeatHolderInput {
	holderKind: HolderKind;
	playerId: string | null;
	userId: string | null;
}

export function holderMatches(
	holder: SeatHolderInput,
	other: SeatHolderInput,
): boolean {
	if (holder.holderKind !== other.holderKind) {
		return false;
	}
	return holder.holderKind === "user"
		? holder.userId === other.userId
		: holder.playerId === other.playerId;
}

export function holderKeyOf(holder: SeatHolderInput): string {
	return holder.holderKind === "user"
		? `user:${holder.userId}`
		: `player:${holder.playerId}`;
}

export interface SessionRecord {
	id: string;
	ownerId: string;
	name: string | null;
	moduleId: string;
	ruleId: string;
	status: string;
	phase: string;
	currentSceneId: string | null;
	lastEventId: number;
	sharePcSheets: number;
	obSeePcState: number;
	diceSkin: string;
	portraitLayout: string;
	portraitScale: string;
	growthConfirmedAt: number | null;
	deletedAt: number | null;
	createdAt: number;
}

export interface CharacterItem {
	id: string;
	ownerId: string;
	name: string;
	background: string;
	kind: string;
	ruleId: string;
	sheetJson: string;
	sheetVersion: number;
	profileVersion: number;
}

export interface SessionCharacterSnapshotItem {
	id: string;
	characterId: string;
	name: string;
	background: string;
	kind: string;
	ruleId: string;
	sheetJson: string;
	baseSheetVersion: number;
	baseProfileVersion: number;
	currentExpressionKey: string | null;
	state: unknown;
	claim: {
		holderKind: HolderKind;
		holderId: string;
		playerId: string | null;
		userId: string | null;
		displayName: string | null;
		role: string;
	} | null;
}

export interface ClaimRecord {
	id: string;
	sessionId: string;
	holderKind: HolderKind;
	playerId: string | null;
	userId: string | null;
	role: string;
	characterId: string | null;
	releasedAt: number | null;
	createdAt: number;
}

export interface SessionKickRecord {
	id: string;
	sessionId: string;
	holderKind: HolderKind;
	playerId: string | null;
	userId: string | null;
	reason: string | null;
	createdAt: number;
	liftedAt: number | null;
}

export interface SessionKickInput {
	id: string;
	sessionId: string;
	holderKind: HolderKind;
	playerId: string | null;
	userId: string | null;
	reason: string | null;
	createdAt: number;
}

export interface SessionsRepository {
	findSessionById(id: string, db?: DbClient): Promise<SessionRecord | null>;
	saveSession(session: SessionRecord): Promise<void>;
	updateSession(
		id: string,
		updates: Partial<Omit<SessionRecord, "id" | "createdAt">>,
		db?: DbClient,
	): Promise<void>;
	softDeleteSession(id: string, deletedAt: number): Promise<void>;
	createSession(
		session: SessionRecord,
		charactersToSave: Array<{
			id: string;
			sessionId: string;
			characterId: string;
			kind: string;
			name: string;
			background: string;
			ruleId: string;
			sheetJson: string;
			baseSheetVersion: number;
			baseProfileVersion: number;
			currentExpressionKey: string | null;
			stateJson: string;
			createdAt: number;
		}>,
		checkpoint?: {
			id: string;
			eventId: number;
			stateJson: string;
			createdAt: number;
		},
	): Promise<void>;
	findCharactersByIds(ids: string[]): Promise<CharacterItem[]>;
	saveSessionCharacterSnapshot(row: {
		id: string;
		sessionId: string;
		characterId: string;
		kind: string;
		name: string;
		background: string;
		ruleId: string;
		sheetJson: string;
		baseSheetVersion: number;
		baseProfileVersion: number;
		currentExpressionKey: string | null;
		stateJson: string;
		createdAt: number;
	}): Promise<void>;
	findLinkedCharacterIds(moduleId: string, ids: string[]): Promise<string[]>;
	linkCharacterToModule(input: {
		id: string;
		moduleId: string;
		characterId: string;
		createdAt: number;
	}): Promise<void>;
	moduleExists(moduleId: string): Promise<boolean>;
	findModuleById(moduleId: string): Promise<{
		id: string;
		ownerId: string;
		name: string;
		ruleId: string;
		themeId: string | null;
	} | null>;
	findSessionCharacterKind(
		sessionId: string,
		characterId: string,
	): Promise<string | null>;
	softDeleteSessionCharacter(
		sessionId: string,
		characterId: string,
		deletedAt: number,
	): Promise<boolean>;
	isCharacterInSession(
		sessionId: string,
		characterId: string,
	): Promise<boolean>;
	findActiveClaimByCharacterId(
		sessionId: string,
		characterId: string,
	): Promise<ClaimRecord | null>;
	listActiveSessionsForUser(userId: string): Promise<
		Array<{
			sessionId: string;
			name: string | null;
			status: string;
			phase: string;
			ruleId: string;
			role: string;
			characterId: string | null;
			characterName: string | null;
		}>
	>;
	findActiveClaimByHolder(
		sessionId: string,
		holder: SeatHolderInput,
	): Promise<ClaimRecord | null>;
	releaseHolderClaims(
		sessionId: string,
		holder: SeatHolderInput,
		releasedAt: number,
	): Promise<void>;
	saveClaim(claim: ClaimRecord): Promise<void>;
	replaceHolderClaim(claim: ClaimRecord, releasedAt: number): Promise<boolean>;
	forceReplaceHolderClaim(
		claim: ClaimRecord,
		releasedAt: number,
	): Promise<{ displacedHolderKeys: string[] }>;
	listSessions(options: {
		ownerId?: string;
		limit: number;
		offset?: number;
		cursor?: string;
	}): Promise<{ items: SessionRecord[]; nextCursor: string | null }>;
	findSessionCharactersWithClaims(
		sessionId: string,
	): Promise<SessionCharacterSnapshotItem[]>;
	findSessionCharacterSnapshot(
		sessionId: string,
		characterId: string,
	): Promise<{
		characterId: string;
		name: string;
		background: string;
		sheetJson: string;
		stateJson: string;
		baseSheetVersion: number;
		baseProfileVersion: number;
		kind: string;
		ruleId: string;
	} | null>;
	updateSessionCharacterSnapshot(
		sessionId: string,
		characterId: string,
		patch: {
			name?: string;
			background?: string;
			sheetJson?: string;
			stateJson?: string;
			baseSheetVersion?: number;
			baseProfileVersion?: number;
		},
	): Promise<void>;
	/** 本团已通过审核的可认领人物 id 列表；空表示未使用审核流程，全部 PC 可认领 */
	findApprovedReviewCharacters(sessionId: string): Promise<string[]>;
	findActiveClaims(sessionId: string): Promise<ClaimRecord[]>;
	findActiveSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
	): Promise<SessionKickRecord | null>;
	findActiveSessionKickByUserId(
		sessionId: string,
		userId: string,
	): Promise<SessionKickRecord | null>;
	recordSessionKick(kick: SessionKickInput): Promise<void>;
	liftSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
		liftedAt: number,
	): Promise<boolean>;
}
