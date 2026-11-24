import { createHash } from "crypto";
import {
	MAX_MEDIA_UPLOAD_BYTES,
	MAX_MEDIA_UPLOAD_MB,
	type PresignMediaUploadResponse,
} from "@cogm/shared";
import {
	type ActorContext,
	ForbiddenError,
	requireActor,
} from "@/modules/identity";
import {
	detectFileMimeType,
	detectFileMimeTypeFromRanges,
	hasAudioMp4FtypPrefix,
} from "@/platform/file-type";
import { logger } from "@/platform/logging/logger";
import type { Clock, IdGenerator } from "@/platform/ports";
import {
	extensionForMimeType,
	joinObjectKey,
} from "@/platform/storage/s3-client";
import {
	FileSizeExceededError,
	PendingUploadExpiredError,
	PendingUploadNotFoundError,
	StorageUnavailableError,
	UnsupportedMimeTypeError,
	UploadedObjectMissingError,
	UploadSizeMismatchError,
} from "../domain/media-errors";
import type {
	MediaAsset,
	MediaRepository,
	MediaRuntimeStoragePort,
	MediaStorage,
} from "./ports";

const HEAD_PROBE_BYTES = 64 * 1024;
const TAIL_PROBE_BYTES = 128 * 1024;
const PRESIGN_EXPIRES_SECONDS = 15 * 60;

export interface UploadMediaInput {
	ownerId: string;
	blob: Blob;
	filename: string;
	purpose: string;
}

export interface PresignMediaUploadInput {
	ownerId: string;
	filename: string;
	size: number;
	contentType: string;
	purpose: string;
}

export interface CompleteMediaUploadInput {
	ownerId: string;
	uploadToken: string;
	sha256?: string;
}

export function requireMediaUploader(actor: ActorContext | null): string {
	const authenticated = requireActor(actor);
	if (
		authenticated.type !== "user" ||
		(authenticated.role !== "gm" && authenticated.role !== "pl")
	) {
		throw new ForbiddenError(
			"Only a game master or player account can upload media",
		);
	}
	return authenticated.userId;
}

function defaultRuntimeStorage(): MediaRuntimeStoragePort {
	return {
		getStorageConfig: () => ({
			mode: "local",
			maxMediaUploadMb: MAX_MEDIA_UPLOAD_MB,
			maxMediaUploadBytes: MAX_MEDIA_UPLOAD_BYTES,
			s3: {
				bucket: "",
				keyPrefix: "",
				accessMode: "public",
				signedUrlTtlSeconds: 600,
			},
		}),
		getS3Client: () => null,
	};
}

export class UploadMediaUseCase {
	private readonly runtimeStorage: MediaRuntimeStoragePort;

	constructor(
		private readonly repo: MediaRepository,
		private readonly mediaStorage: MediaStorage,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		runtimeStorage?: MediaRuntimeStoragePort,
	) {
		this.runtimeStorage = runtimeStorage ?? defaultRuntimeStorage();
	}

	async execute(input: UploadMediaInput): Promise<MediaAsset> {
		const storageConfig = this.runtimeStorage.getStorageConfig();
		const maxBytes = storageConfig.maxMediaUploadBytes;
		const maxMb = storageConfig.maxMediaUploadMb;

		if (input.blob.size > maxBytes) {
			throw new FileSizeExceededError(
				`File size exceeds the maximum limit of ${maxMb}MB`,
			);
		}
		const arrayBuffer = await input.blob.arrayBuffer();
		const data = new Uint8Array(arrayBuffer);

		const size = data.length;
		if (size > maxBytes) {
			throw new FileSizeExceededError(
				`File size exceeds the maximum limit of ${maxMb}MB`,
			);
		}

		const mimeType = detectFileMimeType(data);
		if (!mimeType) {
			throw new UnsupportedMimeTypeError();
		}

		const sha256 = createHash("sha256").update(data).digest("hex");
		const id = this.idGenerator.nextId();
		const now = this.clock.nowEpochMs();

		if (storageConfig.mode === "s3") {
			const s3Client = this.runtimeStorage.getS3Client();
			if (!s3Client) {
				throw new StorageUnavailableError(
					"Object storage is enabled but not configured",
				);
			}
			const ext = extensionForMimeType(mimeType, input.filename);
			const storageKey = joinObjectKey(
				storageConfig.s3.keyPrefix,
				"media",
				`${id}${ext}`,
			);
			try {
				await s3Client.putObject(storageKey, data, {
					contentType: mimeType,
					cacheControl: "public, max-age=31536000, immutable",
				});
			} catch (error) {
				throw new StorageUnavailableError(
					error instanceof Error
						? error.message
						: "Failed to upload media to object storage",
				);
			}

			const asset: MediaAsset = {
				id,
				ownerId: input.ownerId,
				purpose: input.purpose || "general",
				storageProvider: "s3",
				storageBucket: storageConfig.s3.bucket,
				storageKey,
				filename: input.filename,
				mimeType,
				size,
				sha256,
				metadataJson: JSON.stringify({}),
				deletedAt: null,
				createdAt: now,
			};

			try {
				await this.repo.insert(asset);
			} catch (error) {
				await s3Client.deleteObject(storageKey).catch(() => undefined);
				throw error;
			}
			return asset;
		}

		const storageKey = crypto.randomUUID();
		await this.mediaStorage.store(storageKey, data);

		const asset: MediaAsset = {
			id,
			ownerId: input.ownerId,
			purpose: input.purpose || "general",
			storageProvider: "local",
			storageBucket: null,
			storageKey,
			filename: input.filename,
			mimeType,
			size,
			sha256,
			metadataJson: JSON.stringify({}),
			deletedAt: null,
			createdAt: now,
		};

		try {
			await this.repo.insert(asset);
		} catch (error) {
			await this.mediaStorage.delete(storageKey).catch(() => undefined);
			throw error;
		}

		return asset;
	}
}

export class PresignMediaUploadUseCase {
	constructor(
		private readonly repo: MediaRepository,
		private readonly runtimeStorage: MediaRuntimeStoragePort,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(
		input: PresignMediaUploadInput,
	): Promise<PresignMediaUploadResponse> {
		const storageConfig = this.runtimeStorage.getStorageConfig();
		if (input.size > storageConfig.maxMediaUploadBytes) {
			throw new FileSizeExceededError(
				`File size exceeds the maximum limit of ${storageConfig.maxMediaUploadMb}MB`,
			);
		}

		if (storageConfig.mode !== "s3") {
			return {
				mode: "local",
				maxUploadBytes: storageConfig.maxMediaUploadBytes,
			};
		}

		const s3Client = this.runtimeStorage.getS3Client();
		if (!s3Client) {
			throw new StorageUnavailableError(
				"Object storage is enabled but not configured",
			);
		}

		const uploadToken = this.idGenerator.nextId();
		const objectId = this.idGenerator.nextId();
		const ext = extensionForMimeType(input.contentType, input.filename);
		const storageKey = joinObjectKey(
			storageConfig.s3.keyPrefix,
			"media",
			`${objectId}${ext}`,
		);
		const now = this.clock.nowEpochMs();
		const presigned = s3Client.presignPutUrl(storageKey, {
			contentType: input.contentType,
			expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
			usePublicUploadEndpoint: true,
			now: new Date(now),
		});

		await this.repo.insertPendingUpload({
			id: uploadToken,
			ownerId: input.ownerId,
			purpose: input.purpose || "general",
			storageKey,
			storageBucket: storageConfig.s3.bucket,
			filename: input.filename,
			declaredContentType: input.contentType,
			expectedSize: input.size,
			expiresAt: presigned.expiresAt,
			createdAt: now,
		});

		return {
			mode: "direct",
			maxUploadBytes: storageConfig.maxMediaUploadBytes,
			uploadToken,
			uploadUrl: presigned.url,
			method: "PUT",
			headers: presigned.headers,
			expiresAt: presigned.expiresAt,
		};
	}
}

export class CompleteMediaUploadUseCase {
	constructor(
		private readonly repo: MediaRepository,
		private readonly runtimeStorage: MediaRuntimeStoragePort,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: CompleteMediaUploadInput): Promise<MediaAsset> {
		const pending = await this.repo.findPendingUploadById(input.uploadToken);
		if (!pending) {
			throw new PendingUploadNotFoundError();
		}
		if (pending.ownerId !== input.ownerId) {
			throw new ForbiddenError("Cannot finalize another user's upload");
		}

		const s3Client = this.runtimeStorage.getS3Client();
		if (!s3Client) {
			throw new StorageUnavailableError(
				"Object storage is not configured to verify this upload",
			);
		}

		const now = this.clock.nowEpochMs();
		if (pending.expiresAt <= now) {
			await this.repo.deletePendingUpload(pending.id).catch(() => undefined);
			await s3Client.deleteObject(pending.storageKey).catch(() => undefined);
			throw new PendingUploadExpiredError();
		}

		const storageConfig = this.runtimeStorage.getStorageConfig();

		let head;
		try {
			head = await s3Client.headObject(pending.storageKey);
		} catch (error) {
			throw new StorageUnavailableError(
				error instanceof Error
					? error.message
					: "Failed to verify uploaded object",
			);
		}
		if (!head) {
			throw new UploadedObjectMissingError();
		}

		const cleanupBadObject = async () => {
			await s3Client.deleteObject(pending.storageKey).catch(() => undefined);
			await this.repo.deletePendingUpload(pending.id).catch(() => undefined);
		};

		if (
			head.contentLength <= 0 ||
			head.contentLength > storageConfig.maxMediaUploadBytes
		) {
			await cleanupBadObject();
			throw new FileSizeExceededError(
				`File size exceeds the maximum limit of ${storageConfig.maxMediaUploadMb}MB`,
			);
		}

		if (head.contentLength !== pending.expectedSize) {
			await cleanupBadObject();
			throw new UploadSizeMismatchError();
		}

		let headBytes: Uint8Array;
		try {
			const headEnd = Math.min(head.contentLength - 1, HEAD_PROBE_BYTES - 1);
			headBytes = await s3Client.getObjectRange(pending.storageKey, 0, headEnd);
		} catch (error) {
			throw new StorageUnavailableError(
				error instanceof Error
					? error.message
					: "Failed to inspect uploaded object header",
			);
		}

		let detectedMime = detectFileMimeTypeFromRanges(headBytes);
		if (
			!detectedMime &&
			hasAudioMp4FtypPrefix(headBytes) &&
			head.contentLength > HEAD_PROBE_BYTES
		) {
			try {
				const tailStart = Math.max(0, head.contentLength - TAIL_PROBE_BYTES);
				const tailBytes = await s3Client.getObjectRange(
					pending.storageKey,
					tailStart,
					head.contentLength - 1,
				);
				detectedMime = detectFileMimeTypeFromRanges(headBytes, tailBytes);
			} catch (error) {
				logger.warn("media.direct_upload.tail_probe_failed", {
					storageKey: pending.storageKey,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}

		if (!detectedMime) {
			await cleanupBadObject();
			throw new UnsupportedMimeTypeError();
		}

		const asset: MediaAsset = {
			id: this.idGenerator.nextId(),
			ownerId: pending.ownerId,
			purpose: pending.purpose || "general",
			storageProvider: "s3",
			storageBucket: pending.storageBucket,
			storageKey: pending.storageKey,
			filename: pending.filename,
			mimeType: detectedMime,
			size: head.contentLength,
			sha256: input.sha256?.toLowerCase() ?? "",
			metadataJson: JSON.stringify({}),
			deletedAt: null,
			createdAt: now,
		};

		try {
			await this.repo.insert(asset);
			await this.repo.deletePendingUpload(pending.id);
		} catch (error) {
			await s3Client.deleteObject(pending.storageKey).catch(() => undefined);
			throw error;
		}

		return asset;
	}
}

export class CleanupExpiredPendingUploadsUseCase {
	constructor(
		private readonly repo: MediaRepository,
		private readonly runtimeStorage: MediaRuntimeStoragePort,
		private readonly clock: Clock,
	) {}

	async execute(): Promise<number> {
		const expired = await this.repo.listExpiredPendingUploads(
			this.clock.nowEpochMs(),
			100,
		);
		if (expired.length === 0) {
			return 0;
		}
		const s3Client = this.runtimeStorage.getS3Client();
		const activeBucket = this.runtimeStorage.getStorageConfig().s3.bucket;
		let cleaned = 0;
		for (const item of expired) {
			if (s3Client && item.storageBucket === activeBucket) {
				await s3Client.deleteObject(item.storageKey).catch(() => undefined);
			}
			await this.repo.deletePendingUpload(item.id).catch(() => undefined);
			cleaned += 1;
		}
		logger.info("media.pending_uploads.cleaned", { count: cleaned });
		return cleaned;
	}
}
