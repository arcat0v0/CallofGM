import { Elysia, t } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleCharactersRepository } from "../infrastructure/drizzle-characters-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import { type RuleId } from "@cogm/shared";
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
} from "../application/use-cases";

interface CreateCharacterBody {
  name: string;
  kind: string;
  ruleId: RuleId;
  sheetData: unknown;
}

interface UpdateCharacterBody {
  name?: string;
  kind?: string;
  sheetData?: unknown;
}

interface ImportConfirmBody {
  importToken: string;
  kind: string;
  ruleId: RuleId;
  moduleId?: string;
}

interface AddPortraitBody {
  expressionKey: string;
  portraitAssetId: string;
  isDefault: boolean;
}

export function createCharactersRoutes(container: Container) {
  const repo = new DrizzleCharactersRepository(container.db);
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const tokenSigner = container.playerTokenSigner;
  const authPlugin = createAuthPlugin(identityRepo, tokenSigner);

  const createCharacter = new CreateCharacterUseCase(repo, container.ruleRegistry, container.idGenerator, container.clock);
  const updateCharacter = new UpdateCharacterUseCase(repo, container.ruleRegistry);
  const deleteCharacter = new DeleteCharacterUseCase(repo);
  const getCharacter = new GetCharacterUseCase(repo);
  const listCharacters = new ListCharactersUseCase(repo);
  const addPortrait = new AddPortraitUseCase(repo, container.idGenerator, container.clock);
  const deletePortrait = new DeletePortraitUseCase(repo);
  const importPreview = new ImportPreviewUseCase(repo, container.ruleRegistry, container.idGenerator, container.clock);
  const importConfirm = new ImportConfirmUseCase(repo, container.idGenerator, container.clock);

  return new Elysia({ prefix: "/api/v1/gm/characters" })
    .use(authPlugin)
    .onBeforeHandle(({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
    })
    .post("/", async ({ body }) => {
      const data = body as CreateCharacterBody;
      if (!data.name || !data.kind || !data.ruleId || data.sheetData === undefined) {
        throw new AppError("VALIDATION_FAILED", "Missing required fields", 400);
      }
      return await createCharacter.execute({
        name: data.name,
        kind: data.kind,
        ruleId: data.ruleId,
        sheetData: data.sheetData,
      });
    })
    .get("/", async () => {
      return await listCharacters.execute();
    })
    .get("/:id", async ({ params: { id } }) => {
      return await getCharacter.execute(id);
    })
    .patch("/:id", async ({ params: { id }, body }) => {
      const data = body as UpdateCharacterBody;
      return await updateCharacter.execute(id, {
        name: data.name,
        kind: data.kind,
        sheetData: data.sheetData,
      });
    })
    .delete("/:id", async ({ params: { id } }) => {
      await deleteCharacter.execute(id);
      return { success: true };
    })
    .post(
      "/import/preview",
      async ({ body }) => {
        const file = body.file as Blob;
        const ruleId = body.ruleId;
        const arrayBuffer = await file.arrayBuffer();
        return await importPreview.execute({ fileBuffer: arrayBuffer, ruleId: ruleId as RuleId });
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
      async ({ body }) => {
        const data = body as ImportConfirmBody;
        if (!data.importToken || !data.kind || !data.ruleId) {
          throw new AppError("VALIDATION_FAILED", "Missing required fields", 400);
        }
        return await importConfirm.execute({
          importToken: data.importToken,
          kind: data.kind,
          ruleId: data.ruleId,
          moduleId: data.moduleId,
        });
      }
    )
    .post(
      "/:id/portraits",
      async ({ params: { id: characterId }, body }) => {
        const data = body as AddPortraitBody;
        if (!data.expressionKey || !data.portraitAssetId) {
          throw new AppError("VALIDATION_FAILED", "Missing required fields", 400);
        }
        return await addPortrait.execute({
          characterId,
          expressionKey: data.expressionKey,
          portraitAssetId: data.portraitAssetId,
          isDefault: data.isDefault,
        });
      }
    )
    .delete(
      "/portraits/:id",
      async ({ params: { id } }) => {
        await deletePortrait.execute(id);
        return { success: true };
      }
    );
}
