export interface CatalogModule {
  id: string;
  name: string;
  description: string;
  ruleId: string;
  createdAt: number;
}

export interface CatalogScene {
  id: string;
  moduleId: string;
  name: string;
  sortOrder: number;
  bgAssetId: string | null;
  createdAt: number;
}

export interface CatalogTrack {
  id: string;
  moduleId: string;
  name: string;
  audioAssetId: string;
  type: "bgm" | "se";
  duration: number;
  createdAt: number;
}

export interface CatalogHandout {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  imageAssetId: string | null;
  createdAt: number;
}

export interface CatalogRepository {
  findModuleById(id: string): Promise<CatalogModule | null>;
  saveModule(module: CatalogModule): Promise<void>;
  updateModule(id: string, updates: Partial<Omit<CatalogModule, "id" | "createdAt">>): Promise<CatalogModule>;
  deleteModule(id: string): Promise<void>;
  listModules(options: {
    limit: number;
    offset?: number;
    cursor?: string;
  }): Promise<{ items: CatalogModule[]; nextCursor: string | null }>;

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
