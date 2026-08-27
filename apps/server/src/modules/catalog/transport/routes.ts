import { Elysia } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleCatalogRepository } from "../infrastructure/drizzle-catalog-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import {
  CreateModuleRequest,
  UpdateModuleRequest,
  CreateSceneRequest,
  UpdateSceneRequest,
  CreateTrackRequest,
  UpdateTrackRequest,
  CreateHandoutRequest,
  UpdateHandoutRequest,
  CursorPageQuery
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

  return new Elysia({ prefix: "/api/v1/gm/modules" })
    .use(authPlugin)
    .onBeforeHandle(({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
    })
    .post("/", async ({ body }) => {
      return createModule.execute(parseBody(CreateModuleRequest, body));
    })
    .get("/", async ({ query }) => {
      return listModules.execute(parsePageQuery(query));
    })
    .get("/:id", async ({ params }) => {
      return getModule.execute(params.id);
    })
    .patch("/:id", async ({ params, body }) => {
      return updateModule.execute(params.id, parseBody(UpdateModuleRequest, body));
    })
    .delete("/:id", async ({ params }) => {
      await deleteModule.execute(params.id);
      return { success: true };
    })
    .post("/:id/scenes", async ({ params, body }) => {
      const parsed = parseBody(CreateSceneRequest, body);
      return createScene.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/scenes", async ({ params, query }) => {
      return listScenes.execute(params.id, parsePageQuery(query));
    })
    .patch("/scenes/:id", async ({ params, body }) => {
      return updateScene.execute(params.id, parseBody(UpdateSceneRequest, body));
    })
    .delete("/scenes/:id", async ({ params }) => {
      await deleteScene.execute(params.id);
      return { success: true };
    })
    .post("/:id/tracks", async ({ params, body }) => {
      const parsed = parseBody(CreateTrackRequest, body);
      return createTrack.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/tracks", async ({ params, query }) => {
      return listTracks.execute(params.id, parsePageQuery(query));
    })
    .patch("/tracks/:id", async ({ params, body }) => {
      return updateTrack.execute(params.id, parseBody(UpdateTrackRequest, body));
    })
    .delete("/tracks/:id", async ({ params }) => {
      await deleteTrack.execute(params.id);
      return { success: true };
    })
    .post("/:id/handouts", async ({ params, body }) => {
      const parsed = parseBody(CreateHandoutRequest, body);
      return createHandout.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/handouts", async ({ params, query }) => {
      return listHandouts.execute(params.id, parsePageQuery(query));
    })
    .patch("/handouts/:id", async ({ params, body }) => {
      return updateHandout.execute(params.id, parseBody(UpdateHandoutRequest, body));
    })
    .delete("/handouts/:id", async ({ params }) => {
      await deleteHandout.execute(params.id);
      return { success: true };
    });
}
