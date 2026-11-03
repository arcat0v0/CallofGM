export interface CatalogModule {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  ruleId: string;
  themeId: string | null;
  sourceTemplateId?: string | null;
  sourceTemplateVersion?: number | null;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt?: number;
}

export interface CatalogScene {
  id: string;
  moduleId: string;
  name: string;
  sortOrder: number;
  bgAssetId: string | null;
  deletedAt?: number | null;
  createdAt: number;
}

export interface CatalogTrack {
  id: string;
  moduleId: string;
  name: string;
  audioAssetId: string;
  type: "bgm" | "se";
  duration: number;
  audioSize: number | null;
  audioUploadedAt: number | null;
  deletedAt?: number | null;
  createdAt: number;
}

export interface ModuleSummary {
  moduleId: string;
  sceneCount: number;
  handoutCount: number;
  trackCount: number;
  characterCount: number;
  coverAssetId: string | null;
  updatedAt: number;
}

export interface CatalogHandout {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  imageAssetId: string | null;
  deletedAt?: number | null;
  createdAt: number;
}

export interface CatalogRepository {
  findModuleById(id: string): Promise<CatalogModule | null>;
  saveModule(module: CatalogModule): Promise<void>;
  updateModule(id: string, updates: Partial<Omit<CatalogModule, "id" | "createdAt">>): Promise<CatalogModule>;
  softDeleteModule(id: string, deletedAt: number): Promise<void>;
  isModuleInUse(id: string): Promise<boolean>;
  listModules(options: {
    ownerId?: string;
    limit: number;
    offset?: number;
    cursor?: string;
  }): Promise<{ items: CatalogModule[]; nextCursor: string | null }>;
  listModuleSummaries(): Promise<ModuleSummary[]>;

  findSceneById(id: string): Promise<CatalogScene | null>;
  saveScene(scene: CatalogScene): Promise<void>;
  updateScene(id: string, updates: Partial<Omit<CatalogScene, "id" | "moduleId" | "createdAt">>): Promise<CatalogScene>;
  deleteScene(id: string): Promise<void>;
  listScenesByModuleId(
    moduleId: string,
    options: {
      limit: number;
      offset?: number;
      cursor?: string;
    }
  ): Promise<{ items: CatalogScene[]; nextCursor: string | null }>;

  findTrackById(id: string): Promise<CatalogTrack | null>;
  saveTrack(track: CatalogTrack): Promise<void>;
  updateTrack(id: string, updates: Partial<Omit<CatalogTrack, "id" | "moduleId" | "createdAt">>): Promise<CatalogTrack>;
  deleteTrack(id: string): Promise<void>;
  listTracksByModuleId(
    moduleId: string,
    options: {
      limit: number;
      offset?: number;
      cursor?: string;
    }
  ): Promise<{ items: CatalogTrack[]; nextCursor: string | null }>;

  findHandoutById(id: string): Promise<CatalogHandout | null>;
  saveHandout(handout: CatalogHandout): Promise<void>;
  updateHandout(id: string, updates: Partial<Omit<CatalogHandout, "id" | "moduleId" | "createdAt">>): Promise<CatalogHandout>;
  deleteHandout(id: string): Promise<void>;
  listHandoutsByModuleId(
    moduleId: string,
    options: {
      limit: number;
      offset?: number;
      cursor?: string;
    }
  ): Promise<{ items: CatalogHandout[]; nextCursor: string | null }>;

  mediaAssetExists(id: string): Promise<boolean>;
  findMediaAsset(id: string): Promise<{ id: string; purpose: string; mimeType: string } | null>;
}
