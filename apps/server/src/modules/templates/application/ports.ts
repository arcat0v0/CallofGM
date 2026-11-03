export interface TemplateRecord {
	id: string;
	ownerId: string;
	name: string;
	description: string;
	ruleId: string;
	themeId: string | null;
	settingsJson: string;
	currentVersion: number;
	sourceModuleId: string | null;
	sourceTemplateId: string | null;
	deletedAt: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface TemplateVersionRecord {
	id: string;
	templateId: string;
	version: number;
	note: string | null;
	snapshotJson: string;
	createdByUserId: string | null;
	createdAt: number;
}

export interface TemplateSceneRecord {
	id: string;
	templateId: string;
	name: string;
	sortOrder: number;
	bgAssetId: string | null;
	deletedAt: number | null;
	createdAt: number;
}

export interface TemplateTrackRecord {
	id: string;
	templateId: string;
	name: string;
	audioAssetId: string;
	type: string;
	duration: number;
	deletedAt: number | null;
	createdAt: number;
}

export interface TemplateHandoutRecord {
	id: string;
	templateId: string;
	title: string;
	content: string;
	imageAssetId: string | null;
	deletedAt: number | null;
	createdAt: number;
}

export interface TemplateCharacterRecord {
	characterId: string;
	name: string;
	kind: string;
	ruleId: string;
	sheetJson: string;
	sheetVersion: number;
}

export interface TemplateSnapshot {
	scenes: Array<{ name: string; sortOrder: number; bgAssetId: string | null }>;
	tracks: Array<{
		name: string;
		audioAssetId: string;
		type: string;
		duration: number;
	}>;
	handouts: Array<{
		title: string;
		content: string;
		imageAssetId: string | null;
	}>;
	settingsJson: string;
	themeId: string | null;
	characters: Array<{
		name: string;
		kind: string;
		ruleId: string;
		sheetJson: string;
		sheetVersion: number;
	}>;
}

export interface TemplateSummaryCounts {
	sceneCount: number;
	trackCount: number;
	handoutCount: number;
	characterCount: number;
}

export interface TemplatesRepository {
	findById(id: string): Promise<TemplateRecord | null>;
	listByOwner(
		ownerId: string,
		limit: number,
		cursor?: string,
	): Promise<{ items: TemplateRecord[]; nextCursor: string | null }>;
	save(
		template: Omit<TemplateRecord, "deletedAt"> & { deletedAt?: number | null },
	): Promise<void>;
	update(
		id: string,
		patch: Partial<Omit<TemplateRecord, "id" | "createdAt">>,
	): Promise<void>;
	softDelete(id: string, deletedAt: number): Promise<void>;
	counts(templateId: string): Promise<TemplateSummaryCounts>;

	saveVersion(
		version: Omit<TemplateVersionRecord, "createdAt"> & { createdAt: number },
	): Promise<void>;
	listVersions(templateId: string): Promise<TemplateVersionRecord[]>;
	findVersion(
		templateId: string,
		version: number,
	): Promise<TemplateVersionRecord | null>;

	listScenes(templateId: string): Promise<TemplateSceneRecord[]>;
	saveScene(
		scene: Omit<TemplateSceneRecord, "deletedAt"> & {
			deletedAt?: number | null;
		},
	): Promise<void>;
	listTracks(templateId: string): Promise<TemplateTrackRecord[]>;
	saveTrack(
		track: Omit<TemplateTrackRecord, "deletedAt"> & {
			deletedAt?: number | null;
		},
	): Promise<void>;
	listHandouts(templateId: string): Promise<TemplateHandoutRecord[]>;
	saveHandout(
		handout: Omit<TemplateHandoutRecord, "deletedAt"> & {
			deletedAt?: number | null;
		},
	): Promise<void>;
	listCharacters(templateId: string): Promise<TemplateCharacterRecord[]>;
	linkCharacter(templateId: string, characterId: string): Promise<void>;
	unlinkCharacter(templateId: string, characterId: string): Promise<void>;
}
