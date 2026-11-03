import { Elysia } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleTemplatesRepository } from "../infrastructure/drizzle-templates-repository";
import { DrizzleCatalogRepository } from "@/modules/catalog";
import { DrizzleCharactersRepository } from "@/modules/characters";
import { DrizzleSessionsRepository } from "@/modules/sessions";
import { DrizzleIdentityRepository, createAuthPlugin, requireGm } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import {
  CursorPageQuery,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  SaveTemplateVersionRequest,
  InstantiateTemplateRequest,
  TemplateDto,
  TemplateDetailDto,
  TemplateVersionDto,
  InstantiateTemplateResponse,
} from "@cogm/shared";
import {
  CreateTemplateUseCase,
  ListTemplatesUseCase,
  GetTemplateUseCase,
  UpdateTemplateUseCase,
  SaveTemplateVersionUseCase,
  SoftDeleteTemplateUseCase,
  InstantiateTemplateUseCase,
} from "../application/use-cases";

function toDto(
  template: {
    id: string;
    name: string;
    description: string;
    ruleId: string;
    themeId: string | null;
    currentVersion: number;
    sourceModuleId: string | null;
    sourceTemplateId: string | null;
    createdAt: number;
    updatedAt: number;
  },
  counts: { sceneCount: number; trackCount: number; handoutCount: number; characterCount: number }
) {
  return TemplateDto.parse({ ...template, ...counts });
}

export function createTemplatesRoutes(container: Container) {
  const repo = new DrizzleTemplatesRepository(container.db);
  const catalog = new DrizzleCatalogRepository(container.db);
  const characters = new DrizzleCharactersRepository(container.db);
  const sessions = new DrizzleSessionsRepository(container.db);
  const authPlugin = createAuthPlugin(new DrizzleIdentityRepository(container.db));
  const allowedOrigins = corsOriginsFor(container.env);

  const createTemplate = new CreateTemplateUseCase(
    repo,
    catalog,
    characters,
    container.idGenerator,
    container.clock
  );
  const listTemplates = new ListTemplatesUseCase(repo);
  const getTemplate = new GetTemplateUseCase(repo);
  const updateTemplate = new UpdateTemplateUseCase(repo, container.clock);
  const saveVersion = new SaveTemplateVersionUseCase(repo, container.idGenerator, container.clock);
  const softDelete = new SoftDeleteTemplateUseCase(repo, container.clock);
  const instantiate = new InstantiateTemplateUseCase(
    repo,
    catalog,
    characters,
    sessions,
    container.ruleRegistry,
    container.idGenerator,
    container.clock
  );

  return new Elysia({ prefix: "/api/v1/gm/templates" })
    .use(authPlugin)
    .onBeforeHandle(({ actor, request }) => {
      requireGm(actor);
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertTrustedOrigin(request, allowedOrigins);
      }
    })
    .post("/", async ({ actor, body }) => {
      const gm = requireGm(actor);
      const parsed = CreateTemplateRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const created = await createTemplate.execute({ ...parsed.data, ownerId: gm.userId });
      return toDto(created, await repo.counts(created.id));
    })
    .get("/", async ({ actor, query }) => {
      const gm = requireGm(actor);
      const parsed = CursorPageQuery.safeParse(query ?? {});
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const page = await listTemplates.execute({ ownerId: gm.userId, ...parsed.data });
      return {
        items: page.items.map((item) => toDto(item, item.counts)),
        nextCursor: page.nextCursor,
      };
    })
    .get("/:id", async ({ actor, params }) => {
      const gm = requireGm(actor);
      const result = await getTemplate.execute({ ownerId: gm.userId, templateId: params.id });
      const counts = await repo.counts(result.template.id);
      return TemplateDetailDto.parse({
        ...result.template,
        settings: JSON.parse(result.template.settingsJson),
        ...counts,
        scenes: result.scenes,
        tracks: result.tracks,
        handouts: result.handouts,
        characters: result.characters.map((character) => ({
          id: character.characterId,
          characterId: character.characterId,
          name: character.name,
          kind: character.kind,
          ruleId: character.ruleId,
          sheetJson: character.sheetJson,
          sheetVersion: character.sheetVersion,
        })),
      });
    })
    .patch("/:id", async ({ actor, params, body }) => {
      const gm = requireGm(actor);
      const parsed = UpdateTemplateRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const updated = await updateTemplate.execute({
        ownerId: gm.userId,
        templateId: params.id,
        name: parsed.data.name,
        description: parsed.data.description,
        themeId: parsed.data.themeId,
        settings: parsed.data.settings,
      });
      return toDto(updated, await repo.counts(updated.id));
    })
    .delete("/:id", async ({ actor, params }) => {
      const gm = requireGm(actor);
      return softDelete.execute({ ownerId: gm.userId, templateId: params.id });
    })
    .get("/:id/versions", async ({ actor, params }) => {
      const gm = requireGm(actor);
      const result = await getTemplate.execute({ ownerId: gm.userId, templateId: params.id });
      return result.versions
        .filter((version) => version.snapshotJson.length >= 0)
        .map((version) =>
          TemplateVersionDto.parse({
            id: version.id,
            templateId: version.templateId,
            version: version.version,
            note: version.note,
            createdAt: version.createdAt,
          })
        );
    })
    .post("/:id/versions", async ({ actor, params, body }) => {
      const gm = requireGm(actor);
      const parsed = SaveTemplateVersionRequest.safeParse(body ?? {});
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      return saveVersion.execute({
        ownerId: gm.userId,
        templateId: params.id,
        note: parsed.data.note,
      });
    })
    .post("/:id/instantiate", async ({ actor, params, body }) => {
      const gm = requireGm(actor);
      const parsed = InstantiateTemplateRequest.safeParse(body ?? {});
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      return InstantiateTemplateResponse.parse(
        await instantiate.execute({
          ownerId: gm.userId,
          templateId: params.id,
          version: parsed.data.version,
          name: parsed.data.name,
          description: parsed.data.description,
          quickStart: parsed.data.quickStart,
          sessionName: parsed.data.sessionName,
        })
      );
    });
}
