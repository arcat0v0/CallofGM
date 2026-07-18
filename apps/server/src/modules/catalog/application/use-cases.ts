import { type IdGenerator, type Clock } from "@/platform/ports";
import {
  ModuleNotFoundError,
  SceneNotFoundError,
  TrackNotFoundError,
  HandoutNotFoundError,
  MediaAssetNotFoundError
} from "../domain/errors";
import type {
  CatalogRepository,
  CatalogModule,
  CatalogScene,
  CatalogTrack,
  CatalogHandout
} from "./ports";

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
      const assetExists = await this.repo.mediaAssetExists(input.bgAssetId);
      if (!assetExists) {
        throw new MediaAssetNotFoundError();
      }
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
      const assetExists = await this.repo.mediaAssetExists(updates.bgAssetId);
      if (!assetExists) {
        throw new MediaAssetNotFoundError();
      }
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

  async execute(moduleId: string): Promise<CatalogScene[]> {
    const module = await this.repo.findModuleById(moduleId);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listScenesByModuleId(moduleId);
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
    const assetExists = await this.repo.mediaAssetExists(input.audioAssetId);
    if (!assetExists) {
      throw new MediaAssetNotFoundError();
    }
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
      const assetExists = await this.repo.mediaAssetExists(updates.audioAssetId);
      if (!assetExists) {
        throw new MediaAssetNotFoundError();
      }
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

  async execute(moduleId: string): Promise<CatalogTrack[]> {
    const module = await this.repo.findModuleById(moduleId);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listTracksByModuleId(moduleId);
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
      const assetExists = await this.repo.mediaAssetExists(input.imageAssetId);
      if (!assetExists) {
        throw new MediaAssetNotFoundError();
      }
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
      const assetExists = await this.repo.mediaAssetExists(updates.imageAssetId);
      if (!assetExists) {
        throw new MediaAssetNotFoundError();
      }
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

  async execute(moduleId: string): Promise<CatalogHandout[]> {
    const module = await this.repo.findModuleById(moduleId);
    if (!module) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listHandoutsByModuleId(moduleId);
  }
}
