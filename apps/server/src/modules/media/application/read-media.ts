import { type ActorContext, requireActor } from "@/modules/identity";
import {
	MediaAssetNotFoundError,
	UnauthorizedMediaAccessError,
} from "../domain/media-errors";
import type { MediaRepository, MediaStorage } from "./ports";

export class ReadMediaUseCase {
	constructor(
		private readonly repo: MediaRepository,
		private readonly storage: MediaStorage,
	) {}

	async execute(actor: ActorContext | null, id: string) {
		const authenticated = requireActor(actor);
		const asset = await this.repo.findById(id);
		if (!asset) {
			throw new MediaAssetNotFoundError();
		}
		if (!(await this.repo.checkMediaAccess(authenticated, asset.id))) {
			throw new UnauthorizedMediaAccessError();
		}
		return {
			data: await this.storage.read(asset.storageKey),
			mimeType: asset.mimeType,
			size: asset.size,
		};
	}
}
