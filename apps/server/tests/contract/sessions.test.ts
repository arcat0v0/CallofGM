import { expect, test, describe, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createCharactersRoutes } from "@/modules/characters/transport/routes";
import { createSessionsRoutes } from "@/modules/sessions/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import { seedGmPassword } from "../helpers/setup";
import { modules, characters, sessions, moduleCharacters } from "@/platform/db/schema";

describe("Sessions contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "sessions-test-password";
  let gmToken = "";
  let player1Token = "";
  let player2Token = "";
  let player1Id = "";
  let player2Id = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    container = new Container();
    await container.startupService.startup();
    await seedGmPassword(container.db, gmPassword);

    app = new Elysia()
      .onError(({ error, code, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return {
            code: error.code,
            message: error.message,
            metadata: error.metadata,
          };
        }
        if (code === "VALIDATION") {
          set.status = 400;
          return {
            code: "VALIDATION_FAILED",
            message: error.message,
          };
        }
        set.status = 500;
        return {
          code: "INTERNAL_SERVER_ERROR",
          message: (error as Error).message,
        };
      })
      .use(createIdentityRoutes(container))
      .use(createCharactersRoutes(container))
      .use(createSessionsRoutes(container));

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    const loginBody = (await loginRes.json()) as { sessionToken: string };
    gmToken = loginBody.sessionToken;

    await container.db.insert(modules).values({
      id: "module-1",
      name: "Test Module",
      description: "Test Description",
      ruleId: "coc7e",
      createdAt: Date.now(),
    });

    await container.db.insert(characters).values({
      id: "char-1",
      name: "Character 1",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: JSON.stringify({
        attributes: {
          str: 50,
          con: 50,
          siz: 60,
          dex: 50,
          app: 50,
          int: 50,
          pow: 70,
          edu: 50,
          luck: 50,
        },
        skills: {},
      }),
      createdAt: Date.now(),
    });

    await container.db.insert(characters).values({
      id: "char-2",
      name: "Character 2",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: JSON.stringify({
        attributes: {
          str: 50,
          con: 40,
          siz: 50,
          dex: 50,
          app: 50,
          int: 50,
          pow: 60,
          edu: 50,
          luck: 50,
        },
        skills: {},
      }),
      createdAt: Date.now(),
    });

    await container.db.insert(characters).values({
      id: "char-3",
      name: "Character 3",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: JSON.stringify({
        attributes: {
          str: 50,
          con: 50,
          siz: 50,
          dex: 50,
          app: 50,
          int: 50,
          pow: 50,
          edu: 50,
          luck: 50,
        },
        skills: {},
      }),
      createdAt: Date.now(),
    });

    await container.db.insert(moduleCharacters).values([
      { id: "mc-1", moduleId: "module-1", characterId: "char-1", createdAt: Date.now() },
      { id: "mc-2", moduleId: "module-1", characterId: "char-2", createdAt: Date.now() },
    ]);

    const p1Res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "p1-fingerprint" }),
      })
    );
    const p1Body = (await p1Res.json()) as { playerId: string; token: string };
    player1Id = p1Body.playerId;
    player1Token = p1Body.token;

    const p2Res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "p2-fingerprint" }),
      })
    );
    const p2Body = (await p2Res.json()) as { playerId: string; token: string };
    player2Id = p2Body.playerId;
    player2Token = p2Body.token;
  });

  test("Session lifecycle: Create, List, Snapshot, Claim, Transitions, Double Claim Protection", async () => {
    const createRes = await app.handle(
      new Request("http://localhost/api/v1/gm/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({
          moduleId: "module-1",
          characterIds: ["char-1", "char-2"],
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as any;
    const sessionId = createBody.session.id;
    expect(sessionId).toBeDefined();
    expect(createBody.session.status).toBe("waiting");
    expect(createBody.session.phase).toBe("free_discussion");
    expect(createBody.characters.length).toBe(2);

    const listRes = await app.handle(
      new Request("http://localhost/api/v1/gm/sessions", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${gmToken}`,
        },
      })
    );
    expect(listRes.status).toBe(200);
    const listPage = (await listRes.json()) as { items?: Array<{ id: string }> };
    const listBody = Array.isArray(listPage) ? listPage : (listPage.items ?? []);
    expect(listBody.some((s) => s.id === sessionId)).toBe(true);

    const snapshotRes = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${gmToken}`,
        },
      })
    );
    expect(snapshotRes.status).toBe(200);
    const snapshotBody = (await snapshotRes.json()) as any;
    expect(snapshotBody.session.id).toBe(sessionId);
    expect(snapshotBody.characters.length).toBe(2);

    const char1State = snapshotBody.characters.find((c: any) => c.id === "char-1");
    expect(char1State).toBeDefined();
    expect(char1State.state.sessionId).toBe(sessionId);
    expect(char1State.state.characterId).toBe("char-1");
    expect(char1State.state.hp).toBe(11);
    expect(char1State.state.mp).toBe(14);
    expect(char1State.state.san).toBe(70);

    const p1ClaimRes = await app.handle(
      new Request(`http://localhost/api/v1/sessions/${sessionId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player1Token}`,
        },
        body: JSON.stringify({
          role: "pc",
          characterId: "char-1",
        }),
      })
    );
    expect(p1ClaimRes.status).toBe(200);
    const p1ClaimBody = (await p1ClaimRes.json()) as any;
    expect(p1ClaimBody.playerId).toBe(player1Id);
    expect(p1ClaimBody.role).toBe("pc");
    expect(p1ClaimBody.characterId).toBe("char-1");

    const p2ClaimRes = await app.handle(
      new Request(`http://localhost/api/v1/sessions/${sessionId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player2Token}`,
        },
        body: JSON.stringify({
          role: "pc",
          characterId: "char-1",
        }),
      })
    );
    expect(p2ClaimRes.status).toBe(400);
    const p2ClaimErr = (await p2ClaimRes.json()) as any;
    expect(p2ClaimErr.code).toBe("SEAT_ALREADY_CLAIMED");

    const publicJoinRes = await app.handle(
      new Request(`http://localhost/api/v1/public/sessions/${sessionId}/join-info`, {
        method: "GET",
      })
    );
    expect(publicJoinRes.status).toBe(200);
    const publicJoinBody = (await publicJoinRes.json()) as any;
    expect(publicJoinBody.session.id).toBe(sessionId);
    const char1Join = publicJoinBody.characters.find((c: any) => c.id === "char-1");
    expect(char1Join.claimed).toBe(true);
    expect(char1Join.claimedBy).toBeUndefined();
    const char2Join = publicJoinBody.characters.find((c: any) => c.id === "char-2");
    expect(char2Join.claimed).toBe(false);

    const transitionRes1 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ status: "ended" }),
      })
    );
    expect(transitionRes1.status).toBe(400);
    const transitionRes1Err = (await transitionRes1.json()) as any;
    expect(transitionRes1Err.code).toBe("SESSION_STATE_INVALID");

    const transitionRes2 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ status: "preparing" }),
      })
    );
    expect(transitionRes2.status).toBe(200);

    const phaseRes1 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/phase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ phase: "performance_time" }),
      })
    );
    expect(phaseRes1.status).toBe(400);
    const phaseRes1Err = (await phaseRes1.json()) as any;
    expect(phaseRes1Err.code).toBe("SESSION_STATE_INVALID");

    const transitionRes3 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ status: "active" }),
      })
    );
    expect(transitionRes3.status).toBe(200);

    const phaseRes2 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/phase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ phase: "performance_time" }),
      })
    );
    expect(phaseRes2.status).toBe(200);

    const transitionRes4 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ status: "ended" }),
      })
    );
    expect(transitionRes4.status).toBe(200);

    const phaseRes3 = await app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${sessionId}/phase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({ phase: "forced_cg" }),
      })
    );
    expect(phaseRes3.status).toBe(400);
    const phaseRes3Err = (await phaseRes3.json()) as any;
    expect(phaseRes3Err.code).toBe("SESSION_STATE_INVALID");

    const p1ClaimRes2 = await app.handle(
      new Request(`http://localhost/api/v1/sessions/${sessionId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player1Token}`,
        },
        body: JSON.stringify({
          role: "ob",
        }),
      })
    );
    expect(p1ClaimRes2.status).toBe(400);
    const p1ClaimRes2Err = (await p1ClaimRes2.json()) as any;
    expect(p1ClaimRes2Err.code).toBe("SESSION_STATE_INVALID");
  });

  test("Create session rejects characters not linked to the module", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/v1/gm/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
        },
        body: JSON.stringify({
          moduleId: "module-1",
          characterIds: ["char-3"],
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CHARACTER_NOT_IN_MODULE");
  });
});
