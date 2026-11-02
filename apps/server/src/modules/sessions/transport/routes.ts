import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import { type Container } from "@/bootstrap/container";
import { DrizzleSessionsRepository } from "../infrastructure/drizzle-sessions-repository";
import { DrizzleIdentityRepository, createAuthPlugin, AuthRequiredError, ForbiddenError } from "@/modules/identity";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { clientIp } from "@/platform/security/request-ip";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import {
  CreateSessionRequest,
  ClaimSeatRequest,
  UpdateSessionStatusRequest,
  UpdateSessionPhaseRequest,
  RenameSessionRequest,
  CursorPageQuery,
  CursorPageResponse,
  CreateSessionResponse,
  SessionDetailResponse,
  SessionDto,
  JoinInfoResponse,
  ClaimDto,
  MyClaimResponse,
  SessionCloseCode,
  GmAssignClaimRequest,
  GmReleaseClaimRequest,
} from "@cogm/shared";
import { sessionClaims } from "@/platform/db/schema";
import { SessionNotFoundError } from "../domain/errors";
import {
  CreateSessionUseCase,
  ClaimSeatUseCase,
  GmAssignClaimUseCase,
  ReleaseSeatUseCase,
  UpdateSessionStatusUseCase,
  UpdateSessionPhaseUseCase,
  GetSessionSnapshotUseCase,
  ListSessionsUseCase,
  RenameSessionUseCase,
} from "../application/use-cases";

async function effectiveThemeId(container: Container, themeId: string | null | undefined): Promise<string | null> {
  if (!themeId) {
    return null;
  }
  await container.themeRegistry.ready();
  return container.themeRegistry.has(themeId) ? themeId : null;
}

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
  const claimSeat = new ClaimSeatUseCase(repo, container.idGenerator, container.clock, ({ sessionId, playerId }) => {
    container.connectionRegistry.closePlayerConnections(
      playerId,
      sessionId,
      SessionCloseCode.claimReplaced,
      "claim replaced"
    );
  });
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
  const renameSession = new RenameSessionUseCase(repo);
  const releaseSeat = new ReleaseSeatUseCase(repo, container.clock);
  const gmAssignClaim = new GmAssignClaimUseCase(repo, container.idGenerator, container.clock);

  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/gm/sessions", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = CreateSessionRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return CreateSessionResponse.parse(await createSession.execute(result.data));
    })
    .post("/api/v1/gm/sessions/:id/name", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = RenameSessionRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(await renameSession.execute({ sessionId: id, name: result.data.name }));
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
    .post("/api/v1/gm/sessions/:id/status", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
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
    .post("/api/v1/gm/sessions/:id/phase", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
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
    .post("/api/v1/gm/sessions/:id/claims/assign", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = GmAssignClaimRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      const { claim, displacedPlayerIds } = await gmAssignClaim.execute({
        sessionId: id,
        playerId: result.data.playerId,
        characterId: result.data.characterId,
      });
      for (const playerId of displacedPlayerIds) {
        container.connectionRegistry.closePlayerConnections(
          playerId,
          id,
          SessionCloseCode.seatReleased,
          "seat released"
        );
      }
      await container.presenceService.broadcast(id);
      container.connectionRegistry.sendToSession(id, { type: "session:refresh", payload: {} });
      return ClaimDto.parse(claim);
    })
    .post("/api/v1/gm/sessions/:id/claims/release", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const result = GmReleaseClaimRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      const released = await releaseSeat.execute({ sessionId: id, playerId: result.data.playerId });
      container.connectionRegistry.closePlayerConnections(
        result.data.playerId,
        id,
        SessionCloseCode.seatReleased,
        "seat released"
      );
      await container.presenceService.broadcast(id);
      container.connectionRegistry.sendToSession(id, { type: "session:refresh", payload: {} });
      return released;
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
          name: snapshot.session.name,
          status: snapshot.session.status,
          phase: snapshot.session.phase,
          moduleId: snapshot.session.moduleId,
          moduleName: moduleRecord?.name ?? "",
          themeId: await effectiveThemeId(container, moduleRecord?.themeId),
        },
        characters,
      });
    })
    .get("/api/v1/public/sessions/:id/theme", async ({ params: { id } }) => {
      const session = await repo.findSessionById(id);
      if (!session) {
        throw new SessionNotFoundError();
      }
      const moduleRecord = await repo.findModuleById(session.moduleId);
      return { themeId: await effectiveThemeId(container, moduleRecord?.themeId) };
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
          claimedCharacterId,
          actor.type === "player" ? actor.playerId : null
        ),
      };
    })
    .get("/api/v1/sessions/:id/my-claim", async ({ actor, params: { id } }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      const session = await repo.findSessionById(id);
      if (!session) {
        throw new SessionNotFoundError();
      }
      if (actor.type === "gm") {
        return MyClaimResponse.parse({ claim: null, sessionStatus: session.status, isGm: true });
      }
      const claim = await repo.findActiveClaimByPlayer(id, actor.playerId);
      return MyClaimResponse.parse({
        claim: claim
          ? {
              id: claim.id,
              sessionId: claim.sessionId,
              playerId: claim.playerId,
              role: claim.role,
              characterId: claim.characterId,
              releasedAt: claim.releasedAt,
              createdAt: claim.createdAt,
            }
          : null,
        sessionStatus: session.status,
        isGm: false,
      });
    })
    .post("/api/v1/sessions/:id/claim", async ({ actor, params: { id }, body, request, server }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type === "gm") {
        throw new AppError(
          "GM_SESSION_ACTIVE",
          "This browser is signed in as the GM. Log out of the GM console or use a private window to join as a player.",
          403
        );
      }
      container.httpLimits.joinRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));
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
