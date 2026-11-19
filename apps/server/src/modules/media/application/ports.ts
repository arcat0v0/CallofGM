import type { ActorContext } from "@/modules/identity";

export interface MediaStorage {
	store(key: string, data: Uint8Array): Promise<void>;
	read(key: string): Promise<Uint8Array>;
	delete(key: string): Promise<void>;
}

export interface MediaAsset {
	id: string;
	ownerId: string;
	purpose: string;
	storageKey: string;
	filename: string;
	mimeType: string;
	size: number;
	sha256: string;
	metadataJson: string;
	deletedAt: number | null;
	createdAt: number;
}

export interface MediaRepository {
	insert(asset: MediaAsset): Promise<void>;
	findById(id: string): Promise<MediaAsset | undefined>;
	checkMediaAccess(actor: ActorContext, assetId: string): Promise<boolean>;
}
