export interface StoredThemeMetadata {
	key: string;
	id: string;
	version: string;
	manifestJson: string;
	digest: string;
	hasPreview: boolean;
	storageProvider: "local" | "s3";
	storagePrefix: string;
	files: string[];
	installedAt: number;
}

export interface ThemeMetadataRepository {
	listAll(): Promise<StoredThemeMetadata[]>;
	upsert(entry: StoredThemeMetadata): Promise<void>;
	deleteByKey(key: string): Promise<void>;
	deleteById(id: string): Promise<void>;
}
