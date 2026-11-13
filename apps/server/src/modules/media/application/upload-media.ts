import { createHash } from "crypto";
import type { DbClient } from "@/platform/db/client";
import { mediaAssets } from "@/platform/db/schema";
import { detectFileMimeType } from "@/platform/file-type";
import type { Clock, IdGenerator } from "@/platform/ports";
import {
	FileSizeExceededError,
	UnsupportedMimeTypeError,
} from "../domain/media-errors";
import type { MediaStorage } from "./ports";

export interface UploadMediaInput {
	ownerId: string;
	blob: Blob;
	filename: string;
	purpose: string;
}

export class UploadMediaUseCase {
	constructor(
		private readonly db: DbClient,
		private readonly mediaStorage: MediaStorage,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: UploadMediaInput) {
		if (input.blob.size > 10 * 1024 * 1024) {
			throw new FileSizeExceededError();
		}
		const arrayBuffer = await input.blob.arrayBuffer();
		const data = new Uint8Array(arrayBuffer);

		const size = data.length;
		if (size > 10 * 1024 * 1024) {
			throw new FileSizeExceededError();
		}

		const mimeType = detectFileMimeType(data);
		if (!mimeType) {
			throw new UnsupportedMimeTypeError();
		}

		const sha256 = createHash("sha256").update(data).digest("hex");
		const id = this.idGenerator.nextId();
		const storageKey = crypto.randomUUID();
		const now = this.clock.nowEpochMs();

		await this.mediaStorage.store(storageKey, data);

		const asset = {
			id,
			ownerId: input.ownerId,
			purpose: input.purpose || "general",
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
			await this.db.insert(mediaAssets).values(asset);
		} catch (error) {
			await this.mediaStorage.delete(storageKey).catch(() => undefined);
			throw error;
		}

		return asset;
	}
}
