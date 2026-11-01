import { Elysia, t } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleCharactersRepository } from "../infrastructure/drizzle-characters-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError, type ActorContext } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import {
  CursorPageQuery,
  CursorPageResponse,
  LinkModuleCharacterRequest,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  ImportConfirmRequest,
  AddPortraitRequest,
  RuleId,
  CharacterDto,
  CharacterDetailDto,
  CharacterPortraitDto,
  CharacterImportPreviewResponse,
  ModuleCharacterLinkDto,
} from "@cogm/shared";
import {
  CreateCharacterUseCase,
  UpdateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharacterUseCase,
  ListCharactersUseCase,
  AddPortraitUseCase,
  DeletePortraitUseCase,
  ImportPreviewUseCase,
  ImportConfirmUseCase,
  ListModuleCharactersUseCase,
  LinkModuleCharacterUseCase,
  UnlinkModuleCharacterUseCase,
} from "../application/use-cases";

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw validationFailed(parsed.error);
  }
  return parsed.data;
}
function parsePageQuery(query: unknown) {
  const parsed = CursorPageQuery.safeParse(query ?? {});
  if (!parsed.success) {
    throw validationFailed(parsed.error);
  }
  return parsed.data;
}

function requireGm(actor: { type: string } | null | undefined) {
  if (!actor || actor.type !== "gm") {
    throw new AuthRequiredError();
  }
}

function gmSessionIdOf(actor: ActorContext | null | undefined): string | null {
  if (!actor || actor.type !== "gm") {
    return null;
  }
  return actor.loginSessionId ?? null;
}

export function createCharactersRoutes(container: Container) {
  const repo = new DrizzleCharactersRepository(container.db);
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const authPlugin = createAuthPlugin(identityRepo);

  const createCharacter = new CreateCharacterUseCase(repo, container.ruleRegistry, container.idGenerator, container.clock);
  const updateCharacter = new UpdateCharacterUseCase(repo, container.ruleRegistry);
  const deleteCharacter = new DeleteCharacterUseCase(repo);
  const getCharacter = new GetCharacterUseCase(repo);
  const listCharacters = new ListCharactersUseCase(repo);
  const addPortrait = new AddPortraitUseCase(repo, container.idGenerator, container.clock);
  const deletePortrait = new DeletePortraitUseCase(repo);
  const importPreview = new ImportPreviewUseCase(repo, container.ruleRegistry, container.idGenerator, container.clock);
  const importConfirm = new ImportConfirmUseCase(repo, container.idGenerator, container.clock);
  const listModuleCharacters = new ListModuleCharactersUseCase(repo);
  const linkModuleCharacter = new LinkModuleCharacterUseCase(repo, container.idGenerator, container.clock);
  const unlinkModuleCharacter = new UnlinkModuleCharacterUseCase(repo);

  const allowedOrigins = corsOriginsFor(container.env);

  const characterRoutes = new Elysia({ prefix: "/api/v1/gm/characters" })
    .use(authPlugin)
    .onBeforeHandle(({ actor, request }) => {
      requireGm(actor);
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertTrustedOrigin(request, allowedOrigins);
      }
    })
    .post("/", async ({ body }) => {
      const data = parseBody(CreateCharacterRequest, body);
      return CharacterDto.parse(await createCharacter.execute({
        name: data.name,
        kind: data.kind,
        ruleId: data.ruleId,
        sheetData: data.sheetData,
      }));
    })
    .get("/", async ({ query }) => {
      return CursorPageResponse(CharacterDto).parse(await listCharacters.execute(parsePageQuery(query)));
    })
    .get("/:id", async ({ params: { id } }) => {
      return CharacterDetailDto.parse(await getCharacter.execute(id));
    })
    .patch("/:id", async ({ params: { id }, body }) => {
      const data = parseBody(UpdateCharacterRequest, body);
      return CharacterDto.parse(await updateCharacter.execute(id, {
        name: data.name,
        kind: data.kind,
        sheetData: data.sheetData,
      }));
    })
    .delete("/:id", async ({ params: { id } }) => {
      await deleteCharacter.execute(id);
      return { success: true };
    })
    .post(
      "/import/preview",
      async ({ body, actor }) => {
        const file = body.file as Blob;
        const parsedRuleId = RuleId.safeParse(body.ruleId);
        if (!parsedRuleId.success) {
          throw validationFailed(parsedRuleId.error);
        }
        const arrayBuffer = await file.arrayBuffer();
        return CharacterImportPreviewResponse.parse(await importPreview.execute({
          fileBuffer: arrayBuffer,
          ruleId: parsedRuleId.data,
          gmSessionId: gmSessionIdOf(actor),
        }));
      },
      {
        body: t.Object({
          file: t.File(),
          ruleId: t.String(),
        }),
      }
    )
    .post(
      "/import/confirm",
      async ({ body, actor }) => {
        const data = parseBody(ImportConfirmRequest, body);
        return CharacterDto.parse(await importConfirm.execute({
          importToken: data.importToken,
          kind: data.kind,
          ruleId: data.ruleId,
          moduleId: data.moduleId,
          characterId: data.characterId,
          gmSessionId: gmSessionIdOf(actor),
        }));
      }
    )
    .post(
      "/:id/portraits",
      async ({ params: { id: characterId }, body }) => {
        const data = parseBody(AddPortraitRequest, body);
        return CharacterPortraitDto.parse(await addPortrait.execute({
          characterId,
          expressionKey: data.expressionKey,
          portraitAssetId: data.portraitAssetId,
          isDefault: data.isDefault,
        }));
      }
    )
    .delete(
      "/portraits/:id",
      async ({ params: { id } }) => {
        await deletePortrait.execute(id);
        return { success: true };
      }
    );

  const moduleCharacterRoutes = new Elysia({ prefix: "/api/v1/gm/modules" })
    .use(authPlugin)
    .onBeforeHandle(({ actor, request }) => {
      requireGm(actor);
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertTrustedOrigin(request, allowedOrigins);
      }
    })
    .get("/:id/characters", async ({ params, query }) => {
      return CursorPageResponse(CharacterDto).parse(await listModuleCharacters.execute(params.id, parsePageQuery(query)));
    })
    .post("/:id/characters", async ({ params, body }) => {
      const parsed = LinkModuleCharacterRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      return ModuleCharacterLinkDto.parse(await linkModuleCharacter.execute({
        moduleId: params.id,
        characterId: parsed.data.characterId,
      }));
    })
    .delete("/:id/characters/:characterId", async ({ params }) => {
      await unlinkModuleCharacter.execute(params.id, params.characterId);
      return { success: true };
    });

  return new Elysia()
    .use(characterRoutes)
    .use(moduleCharacterRoutes);
}
