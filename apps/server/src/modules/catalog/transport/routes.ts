import { Elysia } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleCatalogRepository } from "../infrastructure/drizzle-catalog-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import {
  CreateModuleRequest,
  UpdateModuleRequest,
  CreateSceneRequest,
  UpdateSceneRequest,
  CreateTrackRequest,
  UpdateTrackRequest,
  CreateHandoutRequest,
  UpdateHandoutRequest,
  CursorPageQuery,
  CursorPageResponse,
  ModuleDto,
  SceneDto,
  TrackDto,
  CatalogHandoutDto
} from "@cogm/shared";
import {
  CreateModuleUseCase,
  UpdateModuleUseCase,
  DeleteModuleUseCase,
  GetModuleUseCase,
  ListModulesUseCase,
  CreateSceneUseCase,
  UpdateSceneUseCase,
  DeleteSceneUseCase,
  ListScenesUseCase,
  CreateTrackUseCase,
  UpdateTrackUseCase,
  DeleteTrackUseCase,
  ListTracksUseCase,
  CreateHandoutUseCase,
  UpdateHandoutUseCase,
  DeleteHandoutUseCase,
  ListHandoutsUseCase
} from "../application/use-cases";

function parsePageQuery(query: unknown) {
  const parsed = CursorPageQuery.safeParse(query ?? {});
  if (!parsed.success) {
    throw validationFailed(parsed.error);
  }
  return parsed.data;
}

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw validationFailed(parsed.error);
  }
  return parsed.data;
}

export function createCatalogRoutes(container: Container) {
  const repo = new DrizzleCatalogRepository(container.db);
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const authPlugin = createAuthPlugin(identityRepo);

  const createModule = new CreateModuleUseCase(repo, container.idGenerator, container.clock);
  const updateModule = new UpdateModuleUseCase(repo);
  const deleteModule = new DeleteModuleUseCase(repo);
  const getModule = new GetModuleUseCase(repo);
  const listModules = new ListModulesUseCase(repo);

  const createScene = new CreateSceneUseCase(repo, container.idGenerator, container.clock);
  const updateScene = new UpdateSceneUseCase(repo);
  const deleteScene = new DeleteSceneUseCase(repo);
  const listScenes = new ListScenesUseCase(repo);

  const createTrack = new CreateTrackUseCase(repo, container.idGenerator, container.clock);
  const updateTrack = new UpdateTrackUseCase(repo);
  const deleteTrack = new DeleteTrackUseCase(repo);
  const listTracks = new ListTracksUseCase(repo);

  const createHandout = new CreateHandoutUseCase(repo, container.idGenerator, container.clock);
  const updateHandout = new UpdateHandoutUseCase(repo);
  const deleteHandout = new DeleteHandoutUseCase(repo);
  const listHandouts = new ListHandoutsUseCase(repo);

  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia({ prefix: "/api/v1/gm/modules" })
    .use(authPlugin)
    .onBeforeHandle(({ actor, request }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertTrustedOrigin(request, allowedOrigins);
      }
    })
    .post("/", async ({ body }) => {
      return ModuleDto.parse(await createModule.execute(parseBody(CreateModuleRequest, body)));
    })
    .get("/", async ({ query }) => {
      return CursorPageResponse(ModuleDto).parse(await listModules.execute(parsePageQuery(query)));
    })
    .get("/:id", async ({ params }) => {
      return ModuleDto.parse(await getModule.execute(params.id));
    })
    .patch("/:id", async ({ params, body }) => {
      return ModuleDto.parse(await updateModule.execute(params.id, parseBody(UpdateModuleRequest, body)));
    })
    .delete("/:id", async ({ params }) => {
      await deleteModule.execute(params.id);
      return { success: true };
    })
    .post("/:id/scenes", async ({ params, body }) => {
      const parsed = parseBody(CreateSceneRequest, body);
      return SceneDto.parse(await createScene.execute({
        moduleId: params.id,
        ...parsed
      }));
    })
    .get("/:id/scenes", async ({ params, query }) => {
      return CursorPageResponse(SceneDto).parse(await listScenes.execute(params.id, parsePageQuery(query)));
    })
    .patch("/scenes/:id", async ({ params, body }) => {
      return SceneDto.parse(await updateScene.execute(params.id, parseBody(UpdateSceneRequest, body)));
    })
    .delete("/scenes/:id", async ({ params }) => {
      await deleteScene.execute(params.id);
      return { success: true };
    })
    .post("/:id/tracks", async ({ params, body }) => {
      const parsed = parseBody(CreateTrackRequest, body);
      return TrackDto.parse(await createTrack.execute({
        moduleId: params.id,
        ...parsed
      }));
    })
    .get("/:id/tracks", async ({ params, query }) => {
      return CursorPageResponse(TrackDto).parse(await listTracks.execute(params.id, parsePageQuery(query)));
    })
    .patch("/tracks/:id", async ({ params, body }) => {
      return TrackDto.parse(await updateTrack.execute(params.id, parseBody(UpdateTrackRequest, body)));
    })
    .delete("/tracks/:id", async ({ params }) => {
      await deleteTrack.execute(params.id);
      return { success: true };
    })
    .post("/:id/handouts", async ({ params, body }) => {
      const parsed = parseBody(CreateHandoutRequest, body);
      return CatalogHandoutDto.parse(await createHandout.execute({
        moduleId: params.id,
        ...parsed
      }));
    })
    .get("/:id/handouts", async ({ params, query }) => {
      return CursorPageResponse(CatalogHandoutDto).parse(await listHandouts.execute(params.id, parsePageQuery(query)));
    })
    .patch("/handouts/:id", async ({ params, body }) => {
      return CatalogHandoutDto.parse(await updateHandout.execute(params.id, parseBody(UpdateHandoutRequest, body)));
    })
    .delete("/handouts/:id", async ({ params }) => {
      await deleteHandout.execute(params.id);
      return { success: true };
    });
}
