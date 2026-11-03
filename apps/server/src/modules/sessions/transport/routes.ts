import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import { type Container } from "@/bootstrap/container";
import { DrizzleSessionsRepository } from "../infrastructure/drizzle-sessions-repository";
import { DrizzleCharactersRepository } from "@/modules/characters";
import {
  DrizzleIdentityRepository,
  createAuthPlugin,
  requireActor,
  requireGm,
  requireSeatHolder,
  holderOfActor,
  AuthRequiredError,
  ForbiddenError,
} from "@/modules/identity";
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
  ConfirmGrowthRequest,
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
import { sessionClaims, characters as charactersTable } from "@/platform/db/schema";
import { ConfirmGrowthUseCase } from "@/modules/characters";
import { SessionStateInvalidError } from "../domain/errors";
import type { SeatHolderInput } from "../application/ports";
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
  const claimSeat = new ClaimSeatUseCase(repo, container.idGenerator, container.clock, ({ sessionId, holder }) => {
    const scope = sessionId;
    if (holder.holderKind === "user") {
      container.connectionRegistry.closeUserConnections(
        holder.userId!,
        scope,
        SessionCloseCode.claimReplaced,
        "claim replaced"
      );
    } else {
      container.connectionRegistry.closePlayerConnections(
        holder.playerId!,
        scope,
        SessionCloseCode.claimReplaced,
        "claim replaced"
      );
    }
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
  const confirmGrowth = new ConfirmGrowthUseCase(
    new DrizzleCharactersRepository(container.db),
    container.ruleRegistry,
    container.idGenerator,
    container.clock
  );

  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/gm/sessions", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = CreateSessionRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return CreateSessionResponse.parse(
        await createSession.execute({ ...result.data, ownerId: requireGm(actor).userId })
      );
    })
    .post("/api/v1/gm/sessions/:id/name", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = RenameSessionRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(
        await renameSession.execute({ ownerId: requireGm(actor).userId, sessionId: id, name: result.data.name })
      );
    })
    .get("/api/v1/gm/sessions", async ({ actor, query }) => {
      const gm = requireGm(actor);
      const parsed = CursorPageQuery.safeParse(query ?? {});
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      return CursorPageResponse(SessionDto).parse(
        await listSessions.execute({ ...parsed.data, ownerId: requireGm(actor).userId })
      );
    })
    .get("/api/v1/gm/sessions/:id", async ({ actor, params: { id } }) => {
      const gm = requireGm(actor);
      requireGm(actor);
      const snapshot = await getSessionSnapshot.execute(id);
      if (snapshot.session.ownerId !== requireGm(actor).userId) {
        throw new SessionNotFoundError();
      }
      return SessionDetailResponse.parse(snapshot);
    })
    .post("/api/v1/gm/sessions/:id/status", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = UpdateSessionStatusRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(await updateSessionStatus.execute({
        ownerId: requireGm(actor).userId,
        sessionId: id,
        status: result.data.status,
      }));
    })
    .post("/api/v1/gm/sessions/:id/phase", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = UpdateSessionPhaseRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      return SessionDto.parse(await updateSessionPhase.execute({
        ownerId: requireGm(actor).userId,
        sessionId: id,
        phase: result.data.phase,
      }));
    })
    .post("/api/v1/gm/sessions/:id/claims/assign", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = GmAssignClaimRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      const { claim, displacedHolderKeys } = await gmAssignClaim.execute({
        ownerId: requireGm(actor).userId,
        sessionId: id,
        holder: requireSeatHolder({ type: "user", userId: result.data.userId, role: "pl" } as never),
        characterId: result.data.characterId,
      });
      for (const holderKey of displacedHolderKeys) {
        if (holderKey.startsWith("user:")) {
          container.connectionRegistry.closeUserConnections(
            holderKey.slice(5),
            id,
            SessionCloseCode.seatReleased,
            "seat released"
          );
        } else if (holderKey.startsWith("player:")) {
          container.connectionRegistry.closePlayerConnections(
            holderKey.slice(7),
            id,
            SessionCloseCode.seatReleased,
            "seat released"
          );
        }
      }
      await container.presenceService.broadcast(id);
      container.connectionRegistry.sendToSession(id, { type: "session:refresh", payload: {} });
      return ClaimDto.parse(claim);
    })
    .post("/api/v1/gm/sessions/:id/claims/release", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const result = GmReleaseClaimRequest.safeParse(body);
      if (!result.success) {
        throw validationFailed(result.error);
      }
      const released = await releaseSeat.execute({
        sessionId: id,
        holder: { holderKind: "user", userId: result.data.userId, playerId: null },
      });
      container.connectionRegistry.closeUserConnections(
        result.data.userId,
        id,
        SessionCloseCode.seatReleased,
        "seat released"
      );
      await container.presenceService.broadcast(id);
      container.connectionRegistry.sendToSession(id, { type: "session:refresh", payload: {} });
      return released;
    })
    .post("/api/v1/gm/sessions/:id/growth/confirm", async ({ actor, params: { id }, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const gm = requireGm(actor);
      const parsed = ConfirmGrowthRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const session = await repo.findSessionById(id);
      if (!session || session.ownerId !== gm.userId) {
        throw new SessionNotFoundError();
      }
      if (session.status !== "ended") {
        throw new SessionStateInvalidError("Growth can only be confirmed after the session ends");
      }
      if (session.growthConfirmedAt !== null) {
        throw new SessionStateInvalidError("Growth has already been confirmed for this session");
      }
      const snapshots = await repo.findSessionCharactersWithClaims(id);
      const results: Array<{ characterId: string; applied: Array<{ skillKey: string; oldValue: number; newValue: number }> }> = [];
      for (const snapshot of snapshots) {
        if (snapshot.kind !== "pc") continue;
        const character = await container.db
          .select()
          .from(charactersTable)
          .where(eq(charactersTable.id, snapshot.characterId))
          .limit(1);
        const row = character[0];
        if (!row || row.deletedAt !== null) continue;
        const applied = await confirmGrowth.execute({
          ownerId: gm.userId,
          characterId: snapshot.characterId,
          sessionId: id,
          gains: parsed.data.gains,
        });
        results.push({ characterId: snapshot.characterId, applied: applied.applied });
      }
      await repo.updateSession(id, { growthConfirmedAt: container.clock.nowEpochMs() });
      return { sessionId: id, characters: results };
    })
    .get("/api/v1/public/sessions/:id/join-info", async ({ params: { id } }) => {
      const snapshot = await getSessionSnapshot.execute(id);
      const moduleRecord = await repo.findModuleById(snapshot.session.moduleId);
      const approvedIds = new Set(await repo.findApprovedReviewCharacters(id));
      const characters = snapshot.characters
        .filter((character) => character.kind === "pc")
        .map((character) => ({
          id: character.characterId ?? character.id,
          name: character.name,
          kind: character.kind,
          claimed: character.claim !== null,
          claimable: approvedIds.size === 0 || approvedIds.has(character.characterId),
        }));
      return JoinInfoResponse.parse({
        session: {
          id: snapshot.session.id,
          name: snapshot.session.name,
          status: snapshot.session.status,
          phase: snapshot.session.phase,
          moduleId: snapshot.session.moduleId,
          moduleName: moduleRecord?.name ?? "",
          ruleId: snapshot.session.ruleId,
          themeId: await effectiveThemeId(container, moduleRecord?.themeId),
        },
        characters,
        requiresLogin: characters.some((character) => character.claimable && !character.claimed),
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
      const current = requireActor(actor);
      const isGm = current.type === "user" && current.role === "gm";
      const holder = current.type === "user" && current.role === "gm" ? null : holderOfActor(current);
      const claimedCharacterId = holder
        ? await resolveClaimedCharacterId(container, id, holder)
        : null;
      if (holder && claimedCharacterId === null && !(await hasObClaim(container, id, holder))) {
        throw new ForbiddenError("No active claim in this session");
      }
      return {
        items: await container.snapshotBuilder.listVisibleHandouts(id, isGm, claimedCharacterId, holder),
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
      if (actor.type === "user" && actor.role === "gm") {
        return MyClaimResponse.parse({ claim: null, sessionStatus: session.status, isGm: true });
      }
      const holder = requireSeatHolder(actor);
      const claim = await repo.findActiveClaimByHolder(id, holder);
      const approved = await repo.findApprovedReviewCharacters(id);
      const claimableIds = new Set(approved);
      const autoCandidate =
        !claim && holder.holderKind === "user"
          ? (await repo.findSessionCharactersWithClaims(id)).filter(
              (entry) => entry.kind === "pc" && entry.claim === null && (
                claimableIds.size === 0 || claimableIds.has(entry.characterId)
              )
            )
          : [];
      return MyClaimResponse.parse({
        claim: claim
          ? {
              id: claim.id,
              sessionId: claim.sessionId,
              holderKind: claim.holderKind,
              playerId: claim.playerId,
              userId: claim.userId,
              role: claim.role,
              characterId: claim.characterId,
              releasedAt: claim.releasedAt,
              createdAt: claim.createdAt,
            }
          : null,
        sessionStatus: session.status,
        isGm: false,
        canAutoClaimCharacterId: autoCandidate.length === 1 ? autoCandidate[0]!.characterId : null,
      });
    })
    .post("/api/v1/sessions/:id/claim", async ({ actor, params: { id }, body, request, server }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type === "user" && actor.role === "gm") {
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
        holder: requireSeatHolder(actor),
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
      const holder = requireSeatHolder(actor);
      const result = await releaseSeat.execute({ sessionId: id, holder });
      await container.presenceService.broadcast(id);
      return result;
    });
}

async function resolveClaimedCharacterId(
  container: Container,
  sessionId: string,
  holder: SeatHolderInput
): Promise<string | null> {
  const rows = await container.db
    .select({ characterId: sessionClaims.characterId })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        holder.holderKind === "user"
          ? eq(sessionClaims.userId, holder.userId!)
          : eq(sessionClaims.playerId, holder.playerId!),
        isNull(sessionClaims.releasedAt)
      )
    );
  return rows[0]?.characterId ?? null;
}

async function hasObClaim(
  container: Container,
  sessionId: string,
  holder: SeatHolderInput
): Promise<boolean> {
  const rows = await container.db
    .select({ id: sessionClaims.id })
    .from(sessionClaims)
    .where(
      and(
        eq(sessionClaims.sessionId, sessionId),
        holder.holderKind === "user"
          ? eq(sessionClaims.userId, holder.userId!)
          : eq(sessionClaims.playerId, holder.playerId!),
        isNull(sessionClaims.releasedAt),
        isNull(sessionClaims.characterId)
      )
    );
  return rows.length > 0;
}

export { AppError };
