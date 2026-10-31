import { type IdGenerator, type Clock } from "@/platform/ports";
import {
  ModuleNotFoundError,
  SceneNotFoundError,
  TrackNotFoundError,
  HandoutNotFoundError,
  MediaAssetNotFoundError,
  MediaAssetInvalidError,
  ModuleInUseError
} from "../domain/errors";
import type {
  CatalogRepository,
  CatalogModule,
  CatalogScene,
  CatalogTrack,
  CatalogHandout
} from "./ports";

async function requireImageAsset(repo: CatalogRepository, assetId: string): Promise<void> {
  const asset = await repo.findMediaAsset(assetId);
  if (!asset) {
    throw new MediaAssetNotFoundError();
  }
  if (!asset.mimeType.startsWith("image/")) {
    throw new MediaAssetInvalidError();
  }
}

async function requireAudioAsset(repo: CatalogRepository, assetId: string): Promise<void> {
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
    private readonly clock: Clock
  ) {}

  async execute(input: {
    name: string;
    description: string;
    ruleId: string;
  }): Promise<CatalogModule> {
    const module: CatalogModule = {
      id: this.idGenerator.nextId(),
      name: input.name,
      description: input.description,
      ruleId: input.ruleId,
      createdAt: this.clock.nowEpochMs()
    };
    await this.repo.saveModule(module);
    return module;
  }
}

export class UpdateModuleUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(
    id: string,
    updates: Partial<Omit<CatalogModule, "id" | "createdAt">>
  ): Promise<CatalogModule> {
    return this.repo.updateModule(id, updates);
  }
}

export class DeleteModuleUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<void> {
    const inUse = await this.repo.isModuleInUse(id);
    if (inUse) {
      throw new ModuleInUseError();
    }
    await this.repo.deleteModule(id);
  }
}

export class GetModuleUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<CatalogModule> {
    const module = await this.repo.findModuleById(id);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return module;
  }
}

export class ListModulesUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(options: {
    limit: number;
    offset?: number;
    cursor?: string;
  }): Promise<{ items: CatalogModule[]; nextCursor: string | null }> {
    return this.repo.listModules(options);
  }
}

export class CreateSceneUseCase {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
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
      createdAt: this.clock.nowEpochMs()
    };
    await this.repo.saveScene(scene);
    return scene;
  }
}

export class UpdateSceneUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(
    id: string,
    updates: Partial<Omit<CatalogScene, "id" | "moduleId" | "createdAt">>
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

export class DeleteSceneUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.deleteScene(id);
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
    }
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
    private readonly clock: Clock
  ) {}

  async execute(input: {
    moduleId: string;
    name: string;
    audioAssetId: string;
    type: "bgm" | "se";
    duration: number;
  }): Promise<CatalogTrack> {
    const moduleExists = await this.repo.findModuleById(input.moduleId);
    if (!moduleExists) {
      throw new ModuleNotFoundError();
    }
    await requireAudioAsset(this.repo, input.audioAssetId);
    const track: CatalogTrack = {
      id: this.idGenerator.nextId(),
      moduleId: input.moduleId,
      name: input.name,
      audioAssetId: input.audioAssetId,
      type: input.type,
      duration: input.duration,
      createdAt: this.clock.nowEpochMs()
    };
    await this.repo.saveTrack(track);
    return track;
  }
}

export class UpdateTrackUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(
    id: string,
    updates: Partial<Omit<CatalogTrack, "id" | "moduleId" | "createdAt">>
  ): Promise<CatalogTrack> {
    const track = await this.repo.findTrackById(id);
    if (!track) {
      throw new TrackNotFoundError();
    }
    if (updates.audioAssetId) {
      await requireAudioAsset(this.repo, updates.audioAssetId);
    }
    return this.repo.updateTrack(id, updates);
  }
}

export class DeleteTrackUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.deleteTrack(id);
  }
}

export class ListTracksUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(
    moduleId: string,
    options: {
      limit: number;
      offset?: number;
      cursor?: string;
    }
  ): Promise<{ items: CatalogTrack[]; nextCursor: string | null }> {
    const module = await this.repo.findModuleById(moduleId);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listTracksByModuleId(moduleId, options);
  }
}

export class CreateHandoutUseCase {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
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
      createdAt: this.clock.nowEpochMs()
    };
    await this.repo.saveHandout(handout);
    return handout;
  }
}

export class UpdateHandoutUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(
    id: string,
    updates: Partial<Omit<CatalogHandout, "id" | "moduleId" | "createdAt">>
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

export class DeleteHandoutUseCase {
  constructor(private readonly repo: CatalogRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.deleteHandout(id);
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
    }
  ): Promise<{ items: CatalogHandout[]; nextCursor: string | null }> {
    const module = await this.repo.findModuleById(moduleId);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listHandoutsByModuleId(moduleId, options);
  }
}
