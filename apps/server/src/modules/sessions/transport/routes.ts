import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import { type Container } from "@/bootstrap/container";
import { DrizzleSessionsRepository } from "../infrastructure/drizzle-sessions-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError, ForbiddenError } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { joinRateLimiter } from "@/platform/security/http-limits";
import { clientIp } from "@/platform/security/request-ip";
import {
  CreateSessionRequest,
  ClaimSeatRequest,
  UpdateSessionStatusRequest,
  UpdateSessionPhaseRequest,
  CursorPageQuery,
  CursorPageResponse,
  CreateSessionResponse,
  SessionDetailResponse,
  SessionDto,
  JoinInfoResponse,
  ClaimDto,
} from "@cogm/shared";
import { sessionClaims } from "@/platform/db/schema";
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
  const authPlugin = createAuthPlugin(identityRepo);

  const createSession = new CreateSessionUseCase(
    repo,
    container.ruleRegistry,
    container.idGenerator,
    container.clock
  );
  const claimSeat = new ClaimSeatUseCase(repo, container.idGenerator, container.clock);
  const updateSessionStatus = new UpdateSessionStatusUseCase(
    repo,
    container.transactionRunner,
    container.sessionEventBus,
    (sessionId) => {
      container.eventRingBuffer.evict(sessionId);
      container.sessionCommandExecutor.evictSession(sessionId);
      container.connectionRegistry.closeSessionConnections(sessionId, 1001, "session ended");
    }
  );
  const updateSessionPhase = new UpdateSessionPhaseUseCase(
    repo,
    container.transactionRunner,
    container.sessionEventBus
  );
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
        throw validationFailed(result.error);
      }
      return CreateSessionResponse.parse(await createSession.execute(result.data));
    })
    .get("/api/v1/gm/sessions", async ({ actor, query }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const parsed = CursorPageQuery.safeParse(query ?? {});
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      return CursorPageResponse(SessionDto).parse(await listSessions.execute(parsed.data));
    })
    .get("/api/v1/gm/sessions/:id", async ({ actor, params: { id } }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return SessionDetailResponse.parse(await getSessionSnapshot.execute(id));
    })
    .post("/api/v1/gm/sessions/:id/status", async ({ actor, params: { id }, body }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = UpdateSessionStatusRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(await updateSessionStatus.execute({
        sessionId: id,
        status: result.data.status,
      }));
    })
    .post("/api/v1/gm/sessions/:id/phase", async ({ actor, params: { id }, body }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = UpdateSessionPhaseRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(await updateSessionPhase.execute({
        sessionId: id,
        phase: result.data.phase,
      }));
    })
    .get("/api/v1/public/sessions/:id/join-info", async ({ params: { id } }) => {
      const snapshot = await getSessionSnapshot.execute(id);
      const moduleRecord = await repo.findModuleById(snapshot.session.moduleId);
      const characters = snapshot.characters
        .filter((character) => character.kind === "pc")
        .map((character) => ({
          id: character.characterId ?? character.id,
          name: character.name,
          kind: character.kind,
          claimed: character.claim !== null,
        }));
      return JoinInfoResponse.parse({
        session: {
          id: snapshot.session.id,
          status: snapshot.session.status,
          phase: snapshot.session.phase,
          moduleId: snapshot.session.moduleId,
          moduleName: moduleRecord?.name ?? "",
        },
        characters,
      });
    })
    .get("/api/v1/sessions/:id/handouts", async ({ actor, params: { id } }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      const claimedCharacterId =
        actor.type === "player" ? await resolveClaimedCharacterId(container, id, actor.playerId) : null;
      if (actor.type === "player") {
        const hasOb = claimedCharacterId === null && (await hasObClaim(container, id, actor.playerId));
        if (claimedCharacterId === null && !hasOb) {
          throw new ForbiddenError("No active claim in this session");
        }
      }
      return {
        items: await container.snapshotBuilder.listVisibleHandouts(
          id,
          actor.type === "gm",
          claimedCharacterId
        ),
      };
    })
    .post("/api/v1/sessions/:id/claim", async ({ actor, params: { id }, body, request, server }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type !== "player") {
        throw new ForbiddenError("Only players can claim seats");
      }
      joinRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));
      const result = ClaimSeatRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      const claim = await claimSeat.execute({
        sessionId: id,
        playerId: actor.playerId,
        role: result.data.role,
        characterId: result.data.characterId,
      });
      await container.presenceService.broadcast(id);
      return ClaimDto.parse(claim);
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

async function resolveClaimedCharacterId(
  container: Container,
  sessionId: string,
  playerId: string
): Promise<string | null> {
  const rows = await container.db
    .select({ characterId: sessionClaims.characterId })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt)
      )
    );
  return rows[0]?.characterId ?? null;
}

async function hasObClaim(container: Container, sessionId: string, playerId: string): Promise<boolean> {
  const rows = await container.db
    .select({ id: sessionClaims.id })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        eq(sessionClaims.playerId, playerId),
        isNull(sessionClaims.releasedAt),
        isNull(sessionClaims.characterId)
      )
    );
  return rows.length > 0;
}

export { AppError };
