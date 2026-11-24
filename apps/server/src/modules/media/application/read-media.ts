import { type ActorContext, requireActor } from "@/modules/identity";
import {
	MediaAssetNotFoundError,
	StorageUnavailableError,
	UnauthorizedMediaAccessError,
} from "../domain/media-errors";
import type {
	MediaRepository,
	MediaRuntimeStoragePort,
	MediaStorage,
} from "./ports";

export type ReadMediaResult =
	| {
			kind: "local";
			data: Uint8Array;
			mimeType: string;
			size: number;
	  }
	| {
			kind: "redirect";
			url: string;
	  };

export class ReadMediaUseCase {
	constructor(
		private readonly repo: MediaRepository,
		private readonly storage: MediaStorage,
		private readonly runtimeStorage?: MediaRuntimeStoragePort,
	) {}

	async execute(
		actor: ActorContext | null,
		id: string,
	): Promise<ReadMediaResult> {
		const authenticated = requireActor(actor);
		const asset = await this.repo.findById(id);
		if (!asset) {
			throw new MediaAssetNotFoundError();
		}
		if (!(await this.repo.checkMediaAccess(authenticated, asset.id))) {
			throw new UnauthorizedMediaAccessError();
		}

		if (asset.storageProvider === "s3") {
			const s3Client = this.runtimeStorage?.getS3Client() ?? null;
			if (!s3Client) {
				throw new StorageUnavailableError(
					"Object storage is not configured to serve this media asset",
				);
			}
			const s3Config = this.runtimeStorage!.getStorageConfig().s3;
			const url =
				s3Config.accessMode === "private"
					? s3Client.presignGetUrl(asset.storageKey, {
							expiresInSeconds: s3Config.signedUrlTtlSeconds,
							useCustomDownloadDomain: true,
						})
					: s3Client.buildPublicUrl(asset.storageKey);
			return { kind: "redirect", url };
		}

		return {
			kind: "local",
			data: await this.storage.read(asset.storageKey),
			mimeType: asset.mimeType,
			size: asset.size,
		};
	}
}
