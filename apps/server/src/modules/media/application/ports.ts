import type { ActorContext } from "@/modules/identity";
import type { S3CompatibleClient } from "@/platform/storage/s3-client";

export interface MediaStorage {
	store(key: string, data: Uint8Array): Promise<void>;
	read(key: string): Promise<Uint8Array>;
	delete(key: string): Promise<void>;
}

export interface MediaAsset {
	id: string;
	ownerId: string;
	purpose: string;
	storageProvider: "local" | "s3";
	storageBucket: string | null;
	storageKey: string;
	filename: string;
	mimeType: string;
	size: number;
	sha256: string;
	metadataJson: string;
	deletedAt: number | null;
	createdAt: number;
}

export interface PendingMediaUpload {
	id: string;
	ownerId: string;
	purpose: string;
	storageKey: string;
	storageBucket: string;
	filename: string;
	declaredContentType: string;
	expectedSize: number;
	expiresAt: number;
	createdAt: number;
}

export interface MediaRuntimeStoragePort {
	getStorageConfig(): {
		mode: "local" | "s3";
		maxMediaUploadMb: number;
		maxMediaUploadBytes: number;
		s3: {
			bucket: string;
			keyPrefix: string;
			accessMode: "public" | "private";
			signedUrlTtlSeconds: number;
		};
	};
	getS3Client(): S3CompatibleClient | null;
}

export interface MediaRepository {
	insert(asset: MediaAsset): Promise<void>;
	findById(id: string): Promise<MediaAsset | undefined>;
	checkMediaAccess(actor: ActorContext, assetId: string): Promise<boolean>;
	insertPendingUpload(record: PendingMediaUpload): Promise<void>;
	findPendingUploadById(id: string): Promise<PendingMediaUpload | undefined>;
	deletePendingUpload(id: string): Promise<void>;
	listExpiredPendingUploads(
		nowEpochMs: number,
		limit?: number,
	): Promise<PendingMediaUpload[]>;
}
