import { type IdGenerator, type Clock } from "@/platform/ports";
import type { TemplatesRepository, TemplateRecord, TemplateSnapshot } from "./ports";
import {
  TemplateNotFoundError,
  TemplateSourceNotFoundError,
  TemplateVersionNotFoundError,
} from "../domain/errors";
import type { CatalogRepository } from "@/modules/catalog";
import type { CharactersRepository } from "@/modules/characters";
import type { SessionsRepository } from "@/modules/sessions";
import type { RuleRegistry } from "@/rules/registry";
import { SessionSettingsDefaults } from "@cogm/shared";

export class CreateTemplateUseCase {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly catalog: CatalogRepository,
    private readonly characters: CharactersRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    ownerId: string;
    name: string;
    description: string;
    ruleId: string;
    themeId?: string | null;
    sourceModuleId?: string;
  }) {
    const now = this.clock.nowEpochMs();
    const templateId = this.idGenerator.nextId();

    let themeId = input.themeId ?? null;
    if (input.sourceModuleId) {
      const source = await this.catalog.findModuleById(input.sourceModuleId);
      if (!source || source.ownerId !== input.ownerId) {
        throw new TemplateSourceNotFoundError();
      }
      if (source.ruleId !== input.ruleId) {
        throw new TemplateSourceNotFoundError("Source module uses a different rule system");
      }
      themeId = source.themeId;
    }

    await this.repo.save({
      id: templateId,
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      ruleId: input.ruleId,
      themeId,
      settingsJson: JSON.stringify(SessionSettingsDefaults),
      currentVersion: 1,
      sourceModuleId: input.sourceModuleId ?? null,
      sourceTemplateId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    if (input.sourceModuleId) {
      await this.snapshotFromModule(templateId, input.sourceModuleId, input.ownerId);
    }

    const created = await this.repo.findById(templateId);
    if (!created) {
      throw new TemplateNotFoundError();
    }
    return created;
  }

  private async snapshotFromModule(templateId: string, moduleId: string, ownerId: string) {
    const scenes = await this.catalog.listScenesByModuleId(moduleId, { limit: 100 });
    for (const scene of scenes.items) {
      await this.repo.saveScene({
        id: `${templateId}:scene:${scene.id}`,
        templateId,
        name: scene.name,
        sortOrder: scene.sortOrder,
        bgAssetId: scene.bgAssetId,
        deletedAt: null,
        createdAt: this.clock.nowEpochMs(),
      });
    }
    const tracks = await this.catalog.listTracksByModuleId(moduleId, { limit: 100 });
    for (const track of tracks.items) {
      await this.repo.saveTrack({
        id: `${templateId}:track:${track.id}`,
        templateId,
        name: track.name,
        audioAssetId: track.audioAssetId,
        type: track.type,
        duration: track.duration,
        deletedAt: null,
        createdAt: this.clock.nowEpochMs(),
      });
    }
    const handouts = await this.catalog.listHandoutsByModuleId(moduleId, { limit: 100 });
    for (const handout of handouts.items) {
      await this.repo.saveHandout({
        id: `${templateId}:handout:${handout.id}`,
        templateId,
        title: handout.title,
        content: handout.content,
        imageAssetId: handout.imageAssetId,
        deletedAt: null,
        createdAt: this.clock.nowEpochMs(),
      });
    }
    const linked = await this.characters.listModuleCharacters(moduleId, { limit: 100 });
    for (const character of linked.items) {
      await this.repo.linkCharacter(templateId, character.id);
    }
    void ownerId;
  }
}

export class ListTemplatesUseCase {
  constructor(private readonly repo: TemplatesRepository) {}
  async execute(input: { ownerId: string; limit: number; cursor?: string }) {
    const page = await this.repo.listByOwner(input.ownerId, input.limit, input.cursor);
    const items = await Promise.all(
      page.items.map(async (template) => ({
        ...template,
        counts: await this.repo.counts(template.id),
      }))
    );
    return { items, nextCursor: page.nextCursor };
  }
}

export class GetTemplateUseCase {
  constructor(private readonly repo: TemplatesRepository) {}
  async execute(input: { ownerId: string; templateId: string }) {
    const template = await this.repo.findById(input.templateId);
    if (!template || template.ownerId !== input.ownerId) {
      throw new TemplateNotFoundError();
    }
    const [scenes, tracks, handouts, charactersList, versions] = await Promise.all([
      this.repo.listScenes(template.id),
      this.repo.listTracks(template.id),
      this.repo.listHandouts(template.id),
      this.repo.listCharacters(template.id),
      this.repo.listVersions(template.id),
    ]);
    return { template, scenes, tracks, handouts, characters: charactersList, versions };
  }
}

export class UpdateTemplateUseCase {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly clock: Clock
  ) {}
  async execute(input: {
    ownerId: string;
    templateId: string;
    name?: string;
    description?: string;
    themeId?: string | null;
    settings?: unknown;
  }) {
    const template = await this.repo.findById(input.templateId);
    if (!template || template.ownerId !== input.ownerId) {
      throw new TemplateNotFoundError();
    }
    const patch: Partial<TemplateRecord> = { updatedAt: this.clock.nowEpochMs() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.themeId !== undefined) patch.themeId = input.themeId;
    if (input.settings !== undefined) patch.settingsJson = JSON.stringify(input.settings);
    await this.repo.update(template.id, patch);
    const updated = await this.repo.findById(template.id);
    if (!updated) {
      throw new TemplateNotFoundError();
    }
    return updated;
  }
}

export class SaveTemplateVersionUseCase {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: { ownerId: string; templateId: string; note?: string }) {
    const template = await this.repo.findById(input.templateId);
    if (!template || template.ownerId !== input.ownerId) {
      throw new TemplateNotFoundError();
    }
    const snapshot = await this.captureSnapshot(template.id, template.settingsJson, template.themeId);
    const version = template.currentVersion;
    await this.repo.saveVersion({
      id: this.idGenerator.nextId(),
      templateId: template.id,
      version,
      note: input.note ?? null,
      snapshotJson: JSON.stringify(snapshot),
      createdByUserId: input.ownerId,
      createdAt: this.clock.nowEpochMs(),
    });
    return { version };
  }

  private async captureSnapshot(
    templateId: string,
    settingsJson: string,
    themeId: string | null
  ): Promise<TemplateSnapshot> {
    const [scenes, tracks, handouts, charactersList] = await Promise.all([
      this.repo.listScenes(templateId),
      this.repo.listTracks(templateId),
      this.repo.listHandouts(templateId),
      this.repo.listCharacters(templateId),
    ]);
    return {
      scenes: scenes.map((s) => ({ name: s.name, sortOrder: s.sortOrder, bgAssetId: s.bgAssetId })),
      tracks: tracks.map((t) => ({
        name: t.name,
        audioAssetId: t.audioAssetId,
        type: t.type,
        duration: t.duration,
      })),
      handouts: handouts.map((h) => ({ title: h.title, content: h.content, imageAssetId: h.imageAssetId })),
      settingsJson,
      themeId,
      characters: charactersList.map((c) => ({
        name: c.name,
        kind: c.kind,
        ruleId: c.ruleId,
        sheetJson: c.sheetJson,
        sheetVersion: c.sheetVersion,
      })),
    };
  }
}

export class SoftDeleteTemplateUseCase {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly clock: Clock
  ) {}
  async execute(input: { ownerId: string; templateId: string }) {
    const template = await this.repo.findById(input.templateId);
    if (!template || template.ownerId !== input.ownerId) {
      throw new TemplateNotFoundError();
    }
    await this.repo.softDelete(template.id, this.clock.nowEpochMs());
    return { success: true };
  }
}

export class InstantiateTemplateUseCase {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly catalog: CatalogRepository,
    private readonly characters: CharactersRepository,
    private readonly sessions: SessionsRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    ownerId: string;
    templateId: string;
    version?: number;
    name?: string;
    description?: string;
    quickStart: boolean;
    sessionName?: string;
  }) {
    const template = await this.repo.findById(input.templateId);
    if (!template || template.ownerId !== input.ownerId) {
      throw new TemplateNotFoundError();
    }

    const now = this.clock.nowEpochMs();
    const moduleId = this.idGenerator.nextId();

    const source = input.version
      ? await this.loadVersionSnapshot(template.id, input.version)
      : await this.loadCurrentSnapshot(template.id, template.settingsJson, template.themeId);

    await this.catalog.saveModule({
      id: moduleId,
      ownerId: input.ownerId,
      name: input.name ?? template.name,
      description: input.description ?? template.description,
      ruleId: template.ruleId,
      themeId: source.themeId,
      sourceTemplateId: template.id,
      sourceTemplateVersion: input.version ?? template.currentVersion,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const scene of source.scenes) {
      await this.catalog.saveScene({
        id: this.idGenerator.nextId(),
        moduleId,
        name: scene.name,
        sortOrder: scene.sortOrder,
        bgAssetId: scene.bgAssetId,
        deletedAt: null,
        createdAt: now,
      });
    }
    for (const track of source.tracks) {
      await this.catalog.saveTrack({
        id: this.idGenerator.nextId(),
        moduleId,
        name: track.name,
        audioAssetId: track.audioAssetId,
        type: track.type as "bgm" | "se",
        duration: track.duration,
        audioSize: null,
        audioUploadedAt: null,
        deletedAt: null,
        createdAt: now,
      });
    }
    for (const handout of source.handouts) {
      await this.catalog.saveHandout({
        id: this.idGenerator.nextId(),
        moduleId,
        title: handout.title,
        content: handout.content,
        imageAssetId: handout.imageAssetId,
        deletedAt: null,
        createdAt: now,
      });
    }

    for (const entry of source.characters) {
      const copyId = this.idGenerator.nextId();
      await this.characters.saveCharacter({
        id: copyId,
        ownerId: input.ownerId,
        ownerKind: "gm",
        name: entry.name,
        background: "",
        kind: entry.kind,
        ruleId: entry.ruleId,
        sheetJson: entry.sheetJson,
        sheetVersion: entry.sheetVersion,
        profileVersion: 1,
        version: 1,
        originType: "template",
        originRefId: `${template.id}:v${input.version ?? template.currentVersion}`,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await this.characters.appendVersion({
        id: this.idGenerator.nextId(),
        characterId: copyId,
        version: 1,
        sheetVersion: entry.sheetVersion,
        name: entry.name,
        background: "",
        sheetJson: entry.sheetJson,
        actorUserId: input.ownerId,
        reason: "template_copy",
        createdAt: now,
      });
      await this.characters.linkCharacterToModule({
        id: this.idGenerator.nextId(),
        moduleId,
        characterId: copyId,
        createdAt: now,
      });
    }

    if (!input.quickStart) {
      return { moduleId, sessionId: null };
    }

    const sessionId = this.idGenerator.nextId();
    await this.sessions.createSession(
      {
        id: sessionId,
        ownerId: input.ownerId,
        name: input.sessionName ?? null,
        moduleId,
        ruleId: template.ruleId,
        status: "waiting",
        phase: "free_discussion",
        currentSceneId: null,
        lastEventId: 0,
        sharePcSheets: 1,
        obSeePcState: 1,
        portraitLayout: "auto",
        portraitScale: "md",
        growthConfirmedAt: null,
        deletedAt: null,
        createdAt: now,
      },
      [],
      {
        id: this.idGenerator.nextId(),
        eventId: 0,
        stateJson: JSON.stringify({
          phase: "free_discussion",
          currentSceneId: null,
          characters: [],
          checkRequests: [],
          handoutGrants: [],
        }),
        createdAt: now,
      }
    );

    return { moduleId, sessionId };
  }

  private async loadCurrentSnapshot(
    templateId: string,
    settingsJson: string,
    themeId: string | null
  ): Promise<TemplateSnapshot> {
    const [scenes, tracks, handouts, charactersList] = await Promise.all([
      this.repo.listScenes(templateId),
      this.repo.listTracks(templateId),
      this.repo.listHandouts(templateId),
      this.repo.listCharacters(templateId),
    ]);
    return {
      scenes: scenes.map((s) => ({ name: s.name, sortOrder: s.sortOrder, bgAssetId: s.bgAssetId })),
      tracks: tracks.map((t) => ({
        name: t.name,
        audioAssetId: t.audioAssetId,
        type: t.type,
        duration: t.duration,
      })),
      handouts: handouts.map((h) => ({ title: h.title, content: h.content, imageAssetId: h.imageAssetId })),
      settingsJson,
      themeId,
      characters: charactersList.map((c) => ({
        name: c.name,
        kind: c.kind,
        ruleId: c.ruleId,
        sheetJson: c.sheetJson,
        sheetVersion: c.sheetVersion,
      })),
    };
  }

  private async loadVersionSnapshot(templateId: string, version: number): Promise<TemplateSnapshot> {
    const record = await this.repo.findVersion(templateId, version);
    if (!record) {
      throw new TemplateVersionNotFoundError();
    }
    return JSON.parse(record.snapshotJson) as TemplateSnapshot;
  }
}
