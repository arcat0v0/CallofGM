import { Elysia } from "elysia";
import { type Container } from "@/bootstrap/container";
import { DrizzleSessionsRepository } from "../infrastructure/drizzle-sessions-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError, ForbiddenError } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import {
  CreateSessionRequest,
  ClaimSeatRequest,
  UpdateSessionStatusRequest,
  UpdateSessionPhaseRequest,
} from "@cogm/shared";
import {
  CreateSessionUseCase,
  ClaimSeatUseCase,
  ReleaseSeatUseCase,
  UpdateSessionStatusUseCase,
  UpdateSessionPhaseUseCase,
  GetSessionSnapshotUseCase,
  ListSessionsUseCase,
} from "../application/use-cases";

export function createSessionsRoutes(container: Container) {
  const repo = new DrizzleSessionsRepository(container.db);
  const identityRepo = new DrizzleIdentityRepository(container.db);
  const tokenSigner = container.playerTokenSigner;
  const authPlugin = createAuthPlugin(identityRepo, tokenSigner);

  const createSession = new CreateSessionUseCase(
    repo,
    container.ruleRegistry,
    container.idGenerator,
    container.clock
  );
  const claimSeat = new ClaimSeatUseCase(repo, container.idGenerator, container.clock);
  const updateSessionStatus = new UpdateSessionStatusUseCase(repo);
  const updateSessionPhase = new UpdateSessionPhaseUseCase(repo);
  const getSessionSnapshot = new GetSessionSnapshotUseCase(repo);
  const listSessions = new ListSessionsUseCase(repo);
  const releaseSeat = new ReleaseSeatUseCase(repo, container.clock);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/gm/sessions", async ({ actor, body }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = CreateSessionRequest.safeParse(body);
      if (!result.success) {
        throw new AppError("VALIDATION_FAILED", result.error.message, 400);
      }
      return await createSession.execute(result.data);
    })
    .get("/api/v1/gm/sessions", async ({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return await listSessions.execute();
    })
    .get("/api/v1/gm/sessions/:id", async ({ actor, params: { id } }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return await getSessionSnapshot.execute(id);
    })
    .post("/api/v1/gm/sessions/:id/status", async ({ actor, params: { id }, body }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = UpdateSessionStatusRequest.safeParse(body);
      if (!result.success) {
        throw new AppError("VALIDATION_FAILED", result.error.message, 400);
      }
      const updated = await updateSessionStatus.execute({
        sessionId: id,
        status: result.data.status,
      });
      await container.sessionEventBus.emit(id, [
        {
          type: "session:status-changed",
          payload: { status: updated.status },
          visibility: { type: "public" },
        },
      ]);
      return updated;
    })
    .post("/api/v1/gm/sessions/:id/phase", async ({ actor, params: { id }, body }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = UpdateSessionPhaseRequest.safeParse(body);
      if (!result.success) {
        throw new AppError("VALIDATION_FAILED", result.error.message, 400);
      }
      const updated = await updateSessionPhase.execute({
        sessionId: id,
        phase: result.data.phase,
      });
      await container.sessionEventBus.emit(id, [
        {
          type: "session:phase-changed",
          payload: { phase: updated.phase },
          visibility: { type: "public" },
        },
      ]);
      return updated;
    })
    .get("/api/v1/public/sessions/:id/join-info", async ({ params: { id } }) => {
      const snapshot = await getSessionSnapshot.execute(id);
      const characters = snapshot.characters.map((char) => ({
        id: char.id,
        name: char.name,
        kind: char.kind,
        claimed: char.claim !== null,
        claimedBy: char.claim ? char.claim.playerId : null,
      }));
      return {
        session: snapshot.session,
        characters,
      };
    })
    .post("/api/v1/sessions/:id/claim", async ({ actor, params: { id }, body }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type !== "player") {
        throw new ForbiddenError("Only players can claim seats");
      }
      const result = ClaimSeatRequest.safeParse(body);
      if (!result.success) {
        throw new AppError("VALIDATION_FAILED", result.error.message, 400);
      }
      const claim = await claimSeat.execute({
        sessionId: id,
        playerId: actor.playerId,
        role: result.data.role,
        characterId: result.data.characterId,
      });
      await container.presenceService.broadcast(id);
      return claim;
    })
    .post("/api/v1/sessions/:id/release", async ({ actor, params: { id } }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type !== "player") {
        throw new ForbiddenError("Only players can release seats");
      }
      const result = await releaseSeat.execute({ sessionId: id, playerId: actor.playerId });
      await container.presenceService.broadcast(id);
      return result;
    });
}
