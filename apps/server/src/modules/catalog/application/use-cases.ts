import type { CreateTrackRequest } from "@cogm/shared";
import type { MusicService } from "@/modules/music";
import type { Clock, IdGenerator } from "@/platform/ports";
import {
	HandoutNotFoundError,
	MediaAssetInvalidError,
	MediaAssetNotFoundError,
	ModuleInUseError,
	ModuleNotFoundError,
	SceneNotFoundError,
	TrackSourceUpdateError,
} from "../domain/errors";
import type {
	CatalogHandout,
	CatalogModule,
	CatalogRepository,
	CatalogScene,
	CatalogTrack,
} from "./ports";

async function requireImageAsset(
	repo: CatalogRepository,
	assetId: string,
): Promise<void> {
	const asset = await repo.findMediaAsset(assetId);
	if (!asset) {
		throw new MediaAssetNotFoundError();
	}
	if (!asset.mimeType.startsWith("image/")) {
		throw new MediaAssetInvalidError();
	}
}

async function requireAudioAsset(
	repo: CatalogRepository,
	assetId: string,
): Promise<void> {
	const asset = await repo.findMediaAsset(assetId);
	if (!asset) {
		throw new MediaAssetNotFoundError();
	}
	if (asset.purpose !== "audio" || !asset.mimeType.startsWith("audio/")) {
		throw new MediaAssetInvalidError();
	}
}

export class CreateModuleUseCase {
	constructor(
		private readonly repo: CatalogRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		name: string;
		description: string;
		ruleId: string;
		themeId?: string | null;
		sourceTemplateId?: string | null;
		sourceTemplateVersion?: number | null;
	}): Promise<CatalogModule> {
		const now = this.clock.nowEpochMs();
		const module: CatalogModule = {
			id: this.idGenerator.nextId(),
			ownerId: input.ownerId,
			name: input.name,
			description: input.description,
			ruleId: input.ruleId,
			themeId: input.themeId ?? null,
			sourceTemplateId: input.sourceTemplateId ?? null,
			sourceTemplateVersion: input.sourceTemplateVersion ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.saveModule(module);
		return module;
	}
}

export class DeleteModuleUseCase {
	constructor(
		private readonly repo: CatalogRepository,
		private readonly clock: Clock,
	) {}

	async execute(id: string): Promise<void> {
		const inUse = await this.repo.isModuleInUse(id);
		if (inUse) {
			throw new ModuleInUseError();
		}
		await this.repo.softDeleteModule(id, this.clock.nowEpochMs());
	}
}

export class CreateSceneUseCase {
	constructor(
		private readonly repo: CatalogRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		moduleId: string;
		name: string;
		sortOrder: number;
		bgAssetId?: string | null;
	}): Promise<CatalogScene> {
		const moduleExists = await this.repo.findModuleById(input.moduleId);
		if (!moduleExists) {
			throw new ModuleNotFoundError();
		}
		if (input.bgAssetId) {
			await requireImageAsset(this.repo, input.bgAssetId);
		}
		const scene: CatalogScene = {
			id: this.idGenerator.nextId(),
			moduleId: input.moduleId,
			name: input.name,
			sortOrder: input.sortOrder,
			bgAssetId: input.bgAssetId || null,
			createdAt: this.clock.nowEpochMs(),
		};
		await this.repo.saveScene(scene);
		return scene;
	}
}

export class UpdateSceneUseCase {
	constructor(private readonly repo: CatalogRepository) {}

	async execute(
		id: string,
		updates: Partial<Omit<CatalogScene, "id" | "moduleId" | "createdAt">>,
	): Promise<CatalogScene> {
		const scene = await this.repo.findSceneById(id);
		if (!scene) {
			throw new SceneNotFoundError();
		}
		if (updates.bgAssetId) {
			await requireImageAsset(this.repo, updates.bgAssetId);
		}
		return this.repo.updateScene(id, updates);
	}
}

export class ListScenesUseCase {
	constructor(private readonly repo: CatalogRepository) {}

	async execute(
		moduleId: string,
		options: {
			limit: number;
			offset?: number;
			cursor?: string;
		},
	): Promise<{ items: CatalogScene[]; nextCursor: string | null }> {
		const module = await this.repo.findModuleById(moduleId);
		if (!module) {
			throw new ModuleNotFoundError();
		}
		return this.repo.listScenesByModuleId(moduleId, options);
	}
}

export class CreateTrackUseCase {
	constructor(
		private readonly repo: CatalogRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly musicService: MusicService,
	) {}

	async execute(
		module: CatalogModule,
		input: CreateTrackRequest,
	): Promise<CatalogTrack> {
		if (input.source === "upload") {
			await requireAudioAsset(this.repo, input.audioAssetId);
			const track: CatalogTrack = {
				id: this.idGenerator.nextId(),
				moduleId: module.id,
				name: input.name,
				source: "upload",
				audioAssetId: input.audioAssetId,
				externalId: null,
				artists: [],
				album: null,
				sourceUrl: null,
				type: input.type,
				duration: input.duration,
				audioSize: null,
				audioUploadedAt: null,
				createdAt: this.clock.nowEpochMs(),
			};
			await this.repo.saveTrack(track);
			return track;
		}
		const resolved = await this.musicService.resolve(
			input.source,
			input.reference,
		);
		const track: CatalogTrack = {
			id: this.idGenerator.nextId(),
			moduleId: module.id,
			name: input.name ?? resolved.name,
			source: input.source,
			audioAssetId: null,
			externalId: resolved.externalId,
			artists: resolved.artists,
			album: resolved.album,
			sourceUrl: resolved.sourceUrl,
			type: input.type,
			duration: resolved.durationMs,
			audioSize: null,
			audioUploadedAt: null,
			createdAt: this.clock.nowEpochMs(),
		};
		await this.repo.saveTrack(track);
		return track;
	}
}

export class UpdateTrackUseCase {
	constructor(private readonly repo: CatalogRepository) {}

	async execute(
		track: CatalogTrack,
		updates: Partial<Omit<CatalogTrack, "id" | "moduleId" | "createdAt">>,
	): Promise<CatalogTrack> {
		if (updates.audioAssetId) {
			if (track.source !== "upload") {
				throw new TrackSourceUpdateError();
			}
			await requireAudioAsset(this.repo, updates.audioAssetId);
		}
		return this.repo.updateTrack(track.id, updates);
	}
}

export class CreateHandoutUseCase {
	constructor(
		private readonly repo: CatalogRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		moduleId: string;
		title: string;
		content: string;
		imageAssetId?: string | null;
	}): Promise<CatalogHandout> {
		const moduleExists = await this.repo.findModuleById(input.moduleId);
		if (!moduleExists) {
			throw new ModuleNotFoundError();
		}
		if (input.imageAssetId) {
			await requireImageAsset(this.repo, input.imageAssetId);
		}
		const handout: CatalogHandout = {
			id: this.idGenerator.nextId(),
			moduleId: input.moduleId,
			title: input.title,
			content: input.content,
			imageAssetId: input.imageAssetId || null,
			createdAt: this.clock.nowEpochMs(),
		};
		await this.repo.saveHandout(handout);
		return handout;
	}
}

export class UpdateHandoutUseCase {
	constructor(private readonly repo: CatalogRepository) {}

	async execute(
		id: string,
		updates: Partial<Omit<CatalogHandout, "id" | "moduleId" | "createdAt">>,
	): Promise<CatalogHandout> {
		const handout = await this.repo.findHandoutById(id);
		if (!handout) {
			throw new HandoutNotFoundError();
		}
		if (updates.imageAssetId) {
			await requireImageAsset(this.repo, updates.imageAssetId);
		}
		return this.repo.updateHandout(id, updates);
	}
}

export class ListHandoutsUseCase {
	constructor(private readonly repo: CatalogRepository) {}

	async execute(
		moduleId: string,
		options: {
			limit: number;
			offset?: number;
			cursor?: string;
		},
	): Promise<{ items: CatalogHandout[]; nextCursor: string | null }> {
		const module = await this.repo.findModuleById(moduleId);
		if (!module) {
			throw new ModuleNotFoundError();
		}
		return this.repo.listHandoutsByModuleId(moduleId, options);
	}
}
