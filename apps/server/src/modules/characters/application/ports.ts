export type CursorPageOptions = {
	limit: number;
	offset?: number;
	cursor?: string;
};

export interface CharacterRecord {
	id: string;
	ownerId: string;
	ownerKind: string;
	name: string;
	background: string;
	kind: string;
	ruleId: string;
	sheetJson: string;
	sheetVersion: number;
	profileVersion: number;
	version: number;
	originType: string | null;
	originRefId: string | null;
	deletedAt: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface CharacterPortraitRecord {
	id: string;
	characterId: string;
	expressionKey: string;
	label: string | null;
	portraitAssetId: string;
	isDefault: number;
	sortOrder: number;
	deletedAt: number | null;
	createdAt: number;
}

export interface StagingRecord {
	id: string;
	ownerId: string;
	characterName: string;
	sheetJson: string;
	ruleId: string;
	errorsJson: string;
	expiresAt: number;
	consumedAt: number | null;
	createdAt: number;
}

export interface CharacterVersionRecord {
	id: string;
	characterId: string;
	version: number;
	sheetVersion: number;
	name: string;
	background: string;
	sheetJson: string;
	actorUserId: string | null;
	reason: string;
	createdAt: number;
}

export interface CharacterGrowthRecord {
	id: string;
	characterId: string;
	sessionId: string | null;
	skillKey: string;
	oldValue: number;
	newValue: number;
	actorUserId: string | null;
	reason: string;
	createdAt: number;
}

export interface CharacterAuditRecord {
	id: string;
	characterId: string;
	sessionId: string | null;
	gmUserId: string | null;
	field: string;
	oldValue: string;
	newValue: string;
	reason: string | null;
	createdAt: number;
}

export interface CharacterInviteRecord {
	id: string;
	ownerId: string;
	scope: string;
	targetId: string;
	tokenHash: string;
	expiresAt: number;
	revokedAt: number | null;
	deletedAt: number | null;
	createdAt: number;
}

export interface CharacterReviewRecord {
	id: string;
	inviteId: string | null;
	scope: string;
	targetId: string;
	ownerId: string;
	characterId: string;
	submittedByUserId: string;
	submittedSheetVersion: number;
	status: string;
	decisionReason: string | null;
	decidedByUserId: string | null;
	decidedAt: number | null;
	deletedAt: number | null;
	createdAt: number;
}

export interface CharacterReviewDetail extends CharacterReviewRecord {
	characterName: string;
	submittedByName: string | null;
	targetName: string | null;
}

export interface CharacterSyncPreview {
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

export interface CharactersRepository {
	findCharacterById(id: string): Promise<CharacterRecord | null>;
	saveCharacter(
		character: Omit<CharacterRecord, "deletedAt"> & {
			deletedAt?: number | null;
		},
	): Promise<void>;
	updateCharacter(
		id: string,
		updates: Partial<
			Pick<
				CharacterRecord,
				| "name"
				| "background"
				| "kind"
				| "sheetJson"
				| "ownerId"
				| "ownerKind"
				| "sheetVersion"
				| "profileVersion"
				| "version"
				| "updatedAt"
				| "deletedAt"
			>
		>,
	): Promise<CharacterRecord>;
	softDeleteCharacter(id: string, deletedAt: number): Promise<void>;
	listCharacters(
		ownerId: string,
		options: CursorPageOptions & { kind?: string },
	): Promise<{ items: CharacterRecord[]; nextCursor: string | null }>;

	appendVersion(
		version: Omit<CharacterVersionRecord, "id" | "createdAt"> & {
			id: string;
			createdAt: number;
		},
	): Promise<void>;
	listVersions(characterId: string): Promise<CharacterVersionRecord[]>;

	appendGrowth(
		entry: Omit<CharacterGrowthRecord, "id" | "createdAt"> & {
			id: string;
			createdAt: number;
		},
	): Promise<void>;
	listGrowth(characterId: string): Promise<CharacterGrowthRecord[]>;

	appendAudit(
		entry: Omit<CharacterAuditRecord, "id" | "createdAt"> & {
			id: string;
			createdAt: number;
		},
	): Promise<void>;
	listAudits(characterId: string): Promise<CharacterAuditRecord[]>;

	findMediaAsset(id: string): Promise<{
		id: string;
		purpose: string;
		mimeType: string;
		ownerId: string;
	} | null>;
	findPortraitById(id: string): Promise<CharacterPortraitRecord | null>;
	findPortraitByExpression(
		characterId: string,
		expressionKey: string,
	): Promise<CharacterPortraitRecord | null>;
	savePortrait(
		portrait: Omit<CharacterPortraitRecord, "deletedAt"> & {
			deletedAt?: number | null;
		},
	): Promise<void>;
	updatePortrait(
		id: string,
		updates: Partial<
			Pick<
				CharacterPortraitRecord,
				"label" | "isDefault" | "sortOrder" | "deletedAt"
			>
		>,
	): Promise<void>;
	unsetDefaultPortraits(characterId: string): Promise<void>;
	listPortraitsByCharacterId(
		characterId: string,
	): Promise<CharacterPortraitRecord[]>;

	findStagingById(id: string): Promise<StagingRecord | null>;
	saveStaging(
		staging: Omit<StagingRecord, "consumedAt"> & { consumedAt: number | null },
	): Promise<void>;
	consumeStaging(id: string, consumedAt: number): Promise<void>;

	moduleExists(moduleId: string): Promise<boolean>;
	findModule(id: string): Promise<{
		id: string;
		ownerId: string;
		name: string;
		ruleId: string;
	} | null>;
	findSession(id: string): Promise<{
		id: string;
		ownerId: string;
		name: string | null;
		moduleId: string;
		ruleId: string;
	} | null>;
	findModuleCharacterLink(
		moduleId: string,
		characterId: string,
	): Promise<{ id: string } | null>;
	linkCharacterToModule(link: {
		id: string;
		moduleId: string;
		characterId: string;
		createdAt: number;
	}): Promise<void>;
	restoreModuleCharacterLink(
		moduleId: string,
		characterId: string,
	): Promise<void>;
	unlinkModuleCharacter(
		moduleId: string,
		characterId: string,
		deletedAt: number,
	): Promise<void>;
	listModuleCharacters(
		moduleId: string,
		options: CursorPageOptions,
	): Promise<{ items: CharacterRecord[]; nextCursor: string | null }>;

	saveInvite(
		invite: Omit<CharacterInviteRecord, "revokedAt" | "deletedAt"> & {
			revokedAt?: number | null;
			deletedAt?: number | null;
		},
	): Promise<void>;
	findInviteById(id: string): Promise<CharacterInviteRecord | null>;
	findInviteByTokenHash(
		tokenHash: string,
	): Promise<CharacterInviteRecord | null>;
	listInvites(ownerId: string): Promise<CharacterInviteRecord[]>;
	revokeInvite(id: string, revokedAt: number): Promise<void>;

	saveReview(
		review: Omit<
			CharacterReviewRecord,
			"decisionReason" | "decidedByUserId" | "decidedAt" | "deletedAt"
		> & {
			decisionReason?: string | null;
			decidedByUserId?: string | null;
			decidedAt?: number | null;
			deletedAt?: number | null;
		},
	): Promise<void>;
	findReviewById(id: string): Promise<CharacterReviewRecord | null>;
	listReviewsForOwner(
		ownerId: string,
		status?: string,
	): Promise<CharacterReviewDetail[]>;
	listReviewsForSubmitter(userId: string): Promise<CharacterReviewDetail[]>;
	listApprovedReviews(
		scope: string,
		targetId: string,
	): Promise<CharacterReviewRecord[]>;
	decideReview(input: {
		id: string;
		status: string;
		decidedByUserId: string;
		decidedAt: number;
		decisionReason: string | null;
	}): Promise<void>;
	findReviewForCharacter(
		scope: string,
		targetId: string,
		characterId: string,
	): Promise<CharacterReviewRecord | null>;

	findUserDisplayName(userId: string): Promise<string | null>;
}
