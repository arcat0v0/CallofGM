import { createHash } from "crypto";
import type { DbClient } from "@/platform/db/client";
import { mediaAssets } from "@/platform/db/schema";
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

		const mimeType = this.detectMimeType(data);
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

	private detectMimeType(data: Uint8Array): string | null {
		if (
			data.length >= 8 &&
			data[0] === 0x89 &&
			data[1] === 0x50 &&
			data[2] === 0x4e &&
			data[3] === 0x47 &&
			data[4] === 0x0d &&
			data[5] === 0x0a &&
			data[6] === 0x1a &&
			data[7] === 0x0a
		) {
			return "image/png";
		}
		if (
			data.length >= 3 &&
			data[0] === 0xff &&
			data[1] === 0xd8 &&
			data[2] === 0xff
		) {
			return "image/jpeg";
		}
		if (
			data.length >= 4 &&
			data[0] === 0x47 &&
			data[1] === 0x49 &&
			data[2] === 0x46 &&
			data[3] === 0x38
		) {
			return "image/gif";
		}
		if (
			data.length >= 12 &&
			data[0] === 0x52 &&
			data[1] === 0x49 &&
			data[2] === 0x46 &&
			data[3] === 0x46 &&
			data[8] === 0x57 &&
			data[9] === 0x45 &&
			data[10] === 0x42 &&
			data[11] === 0x50
		) {
			return "image/webp";
		}
		if (
			data.length >= 4 &&
			data[0] === 0x50 &&
			data[1] === 0x4b &&
			data[2] === 0x03 &&
			data[3] === 0x04
		) {
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		}
		if (
			data.length >= 3 &&
			data[0] === 0x49 &&
			data[1] === 0x44 &&
			data[2] === 0x33
		) {
			return "audio/mpeg";
		}
		const b0 = data[0];
		const b1 = data[1];
		if (
			data.length >= 2 &&
			b0 === 0xff &&
			b1 !== undefined &&
			(b1 & 0xe0) === 0xe0
		) {
			return "audio/mpeg";
		}

		const previewLen = Math.min(data.length, 1024);
		const text = new TextDecoder("utf-8", { fatal: false })
			.decode(data.subarray(0, previewLen))
			.trim();

		if (
			text.includes("<svg") &&
			(text.startsWith("<?xml") ||
				text.startsWith("<svg") ||
				text.includes('xmlns="http://www.w3.org/2000/svg"'))
		) {
			return "image/svg+xml";
		}

		return null;
	}
}
