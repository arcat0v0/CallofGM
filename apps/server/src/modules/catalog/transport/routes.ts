import { Elysia } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleCatalogRepository } from "../infrastructure/drizzle-catalog-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import {
  CreateModuleRequest,
  UpdateModuleRequest,
  CreateSceneRequest,
  UpdateSceneRequest,
  CreateTrackRequest,
  UpdateTrackRequest,
  CreateHandoutRequest,
  UpdateHandoutRequest
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

export function createCatalogRoutes(container: Container) {
  const repo = new DrizzleCatalogRepository(container.db);
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const tokenSigner = container.playerTokenSigner;
  const authPlugin = createAuthPlugin(identityRepo, tokenSigner);

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
      let parsed;
      try {
        parsed = CreateModuleRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return createModule.execute(parsed);
    })
    .get("/", async ({ query }) => {
      const limit = parseInt(query?.limit || "20", 10);
      const offset = query?.offset ? parseInt(query.offset, 10) : undefined;
      const cursor = query?.cursor || undefined;
      return listModules.execute({ limit, offset, cursor });
    })
    .get("/:id", async ({ params }) => {
      return getModule.execute(params.id);
    })
    .patch("/:id", async ({ params, body }) => {
      let parsed;
      try {
        parsed = UpdateModuleRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return updateModule.execute(params.id, parsed);
    })
    .delete("/:id", async ({ params }) => {
      await deleteModule.execute(params.id);
      return { success: true };
    })
    .post("/:id/scenes", async ({ params, body }) => {
      let parsed;
      try {
        parsed = CreateSceneRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return createScene.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/scenes", async ({ params }) => {
      return listScenes.execute(params.id);
    })
    .patch("/scenes/:id", async ({ params, body }) => {
      let parsed;
      try {
        parsed = UpdateSceneRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return updateScene.execute(params.id, parsed);
    })
    .delete("/scenes/:id", async ({ params }) => {
      await deleteScene.execute(params.id);
      return { success: true };
    })
    .post("/:id/tracks", async ({ params, body }) => {
      let parsed;
      try {
        parsed = CreateTrackRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return createTrack.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/tracks", async ({ params }) => {
      return listTracks.execute(params.id);
    })
    .patch("/tracks/:id", async ({ params, body }) => {
      let parsed;
      try {
        parsed = UpdateTrackRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return updateTrack.execute(params.id, parsed);
    })
    .delete("/tracks/:id", async ({ params }) => {
      await deleteTrack.execute(params.id);
      return { success: true };
    })
    .post("/:id/handouts", async ({ params, body }) => {
      let parsed;
      try {
        parsed = CreateHandoutRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return createHandout.execute({
        moduleId: params.id,
        ...parsed
      });
    })
    .get("/:id/handouts", async ({ params }) => {
      return listHandouts.execute(params.id);
    })
    .patch("/handouts/:id", async ({ params, body }) => {
      let parsed;
      try {
        parsed = UpdateHandoutRequest.parse(body);
      } catch (e: unknown) {
        throw new AppError(
          "VALIDATION_FAILED",
          e instanceof Error ? e.message : "Validation failed",
          400
        );
      }
      return updateHandout.execute(params.id, parsed);
    })
    .delete("/handouts/:id", async ({ params }) => {
      await deleteHandout.execute(params.id);
      return { success: true };
    });
}
