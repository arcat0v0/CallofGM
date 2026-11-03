import { Elysia } from "elysia";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createSessionsRoutes } from "@/modules/sessions/transport/routes";
import { createCharactersRoutes } from "@/modules/characters/transport/routes";
import { createMediaRoutes } from "@/modules/media";
import { createCatalogRoutes } from "@/modules/catalog/transport/routes";
import { createThemeRoutes } from "@/modules/themes";
import { createAdminRoutes, createTrashRoutes } from "@/modules/admin";
import { createRulesRoutes } from "@/modules/rules";
import { createTemplatesRoutes } from "@/modules/templates";
import { createUiSettingsRoutes } from "@/modules/ui-settings";
import { routes as realtimeRoutes } from "@/modules/realtime";
import type { CommandHandler } from "@/modules/realtime";
import { buildCommandHandlers } from "@/bootstrap/handlers";
import type { RandomSource } from "@/platform/ports";
import { AppError } from "@/platform/errors/app-error";
import { modules, characters, characterPortraits, moduleCharacters, users } from "@/platform/db/schema";
import { CreateUserUseCase, DrizzleIdentityRepository } from "@/modules/identity";
import { SystemClock, UuidGenerator } from "@/platform/ports";
import type { DbClient } from "@/platform/db/client";
import { CreateSessionUseCase, ClaimSeatUseCase } from "@/modules/sessions/application/use-cases";
import { DrizzleSessionsRepository } from "@/modules/sessions/infrastructure/drizzle-sessions-repository";

export interface TestWebSocket extends WebSocket {
  messages: any[];
  closeInfo: { code: number; reason: string } | null;
  closed: Promise<{ code: number; reason: string }>;
  waitForMessages(count: number): Promise<any[]>;
  waitFor(predicate: (msg: any) => boolean, timeoutMs?: number): Promise<any>;
}

export function connectWs(url: string, token: string, fingerprint?: string): Promise<TestWebSocket> {
  const { promise, resolve, reject } = Promise.withResolvers<TestWebSocket>();
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fingerprint ? { "x-fingerprint": fingerprint } : {}),
    },
  }) as TestWebSocket;

  ws.messages = [];
  ws.closeInfo = null;
  const closeSignal = Promise.withResolvers<{ code: number; reason: string }>();
  ws.closed = closeSignal.promise;
  ws.addEventListener("close", (event) => {
    const info = { code: (event as CloseEvent).code, reason: (event as CloseEvent).reason };
    ws.closeInfo = info;
    closeSignal.resolve(info);
  });
  const resolvers = new Set<{ count: number; resolve: (msgs: any[]) => void }>();
  const predicates = new Set<{ predicate: (msg: any) => boolean; resolve: (msg: any) => void }>();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data as string);
    ws.messages.push(data);
    for (const r of resolvers) {
      if (ws.messages.length >= r.count) {
        resolvers.delete(r);
        r.resolve(ws.messages);
      }
    }
    for (const p of predicates) {
      if (p.predicate(data)) {
        predicates.delete(p);
        p.resolve(data);
      }
    }
  };

  ws.waitForMessages = (count: number) => {
    const { promise: p, resolve: res } = Promise.withResolvers<any[]>();
    if (ws.messages.length >= count) {
      res(ws.messages);
    } else {
      resolvers.add({ count, resolve: res });
    }
    return p;
  };

  ws.waitFor = (predicate, timeoutMs = 3000) => {
    const existing = ws.messages.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }
    const { promise: p, resolve: res, reject: rej } = Promise.withResolvers<any>();
    const timer = setTimeout(() => {
      predicates.delete(entry);
      rej(new Error("waitFor timed out"));
    }, timeoutMs);
    const entry = {
      predicate,
      resolve: (msg: any) => {
        clearTimeout(timer);
        res(msg);
      },
    };
    predicates.add(entry);
    return p;
  };

  if (ws.readyState === WebSocket.OPEN) {
    resolve(ws);
  } else if (ws.readyState === WebSocket.CLOSED) {
    reject(new Error("WebSocket is already closed"));
  } else {
    ws.onopen = () => resolve(ws);
    ws.onerror = (err) => reject(err);
  }
  return promise;
}

export function closeWs(ws: WebSocket): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  if (ws.readyState === WebSocket.CLOSED) {
    resolve();
  } else {
    ws.onclose = () => resolve();
    ws.close();
  }
  return promise;
}

/**
 * 停止测试服务器（带期限）。
 * 已知 Bun 行为：服务端主动关闭过 WebSocket 连接后，`server.stop()` 可能永不 resolve。
 * 测试 teardown 用期限竞速兜底，进程退出时回收。
 */
export async function stopServer(server: { stop(closeActive?: boolean): Promise<unknown> | unknown }): Promise<void> {
  await Promise.race([
    Promise.resolve(server.stop(true)),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

export interface TestServer {
  readonly server: { readonly port: number };
  stop(closeActive?: boolean): Promise<unknown> | unknown;
}

/** Elysia 会把数值 0 当成未配置端口；先由 Bun 分配临时端口再启动测试应用。 */
export function listenTestApp(app: { listen(port: number): any }): TestServer {
  const reservation = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data() {}, open() {}, close() {}, error() {} },
  });
  const port = reservation.port;
  reservation.stop(true);
  return app.listen(port);
}

export function sendCommand(ws: WebSocket, type: string, payload: unknown, commandId?: string): void {
  ws.send(
    JSON.stringify({
      protocolVersion: 1,
      commandId: commandId ?? crypto.randomUUID(),
      type,
      payload,
    })
  );
}

export interface TestContext {
  container: Container;
  app: any;
  gmToken: string;
  gmUserId: string;
  adminToken: string;
  sessionId: string;
  moduleId: string;
  playerTokens: Map<string, string>;
  playerIds: Map<string, string>;
  plTokens: Map<string, string>;
  plIds: Map<string, string>;
  themesDir: string;
}

export interface TestSetupOptions {
  gmPassword?: string;
  extraHandlers?: CommandHandler[];
  randomSource?: RandomSource;
  characters?: Array<{
    id: string;
    name: string;
    kind: "pc" | "npc";
    sheet?: unknown;
    portraits?: string[];
  }>;
  claims?: Array<{ player: string; role: "pc" | "ob"; characterId?: string }>;
  players?: string[];
  /** 需要创建 PL 账号的玩家名；每个名字会得到一个账号与其 token */
  plAccounts?: string[];
  themesDir?: string;
}

/** 脚本化随机源：按队列吐出值，队列空后循环最后一个值（适合长流程测试） */
export class ScriptedRandomSource implements RandomSource {
  private queue: number[];
  constructor(values: number[]) {
    this.queue = [...values];
  }
  push(...values: number[]): void {
    this.queue.push(...values);
  }
  random(): number {
    return 0.5;
  }
  randomInt(min: number, max: number): number {
    if (this.queue.length === 0) {
      return min;
    }
    return this.queue.shift()!;
  }
}

/**
 * 测试夹具里大量直接 insert 需要 owner_id。真正归属在 setup 内部已知，
 * 但直接 insert 的用例拿不到它，这里用一个进程级回退值，与 setup 创建 GM 时一致。
 */
export function gmUserIdRef(): string {
  return (globalThis as { __cogmTestGmUserId?: string }).__cogmTestGmUserId ?? "test-gm-user";
}

export function setGmUserIdRef(userId: string): void {
  (globalThis as { __cogmTestGmUserId?: string }).__cogmTestGmUserId = userId;
}

export interface SeededAccounts {
  gmUserId: string;
  adminUserId: string;
}

export async function seedAccounts(db: DbClient, password: string): Promise<SeededAccounts> {
  const repo = new DrizzleIdentityRepository(db);
  const clock = new SystemClock();
  const createUser = new CreateUserUseCase(new UuidGenerator(), clock, repo);

  const existingAdmin = await repo.findUserByUsernameNormalized("admin");
  const admin =
    existingAdmin ??
    (await createUser.execute({ username: "admin", password, role: "admin" }));

  const existingGm = await repo.findUserByUsernameNormalized("gm");
  const gm = existingGm ?? (await createUser.execute({ username: "gm", password, role: "gm" }));

  return { gmUserId: gm.id, adminUserId: admin.id };
}

/** 搭建带真实数据库与 WS 的测试应用（随机端口，无需手工 listen） */
export async function setupTestApp(options: TestSetupOptions = {}): Promise<TestContext> {
  const gmPassword = options.gmPassword ?? "test-gm-password";
  process.env.DATABASE_URL = ":memory:";
  const themesDir = options.themesDir ?? (await mkdtemp(join(tmpdir(), "cogm-themes-")));
  process.env.THEMES_DIR = themesDir;

  const container = new Container([], { randomSource: options.randomSource });
  await container.startupService.startup();
  const seeded = await seedAccounts(container.db, gmPassword);
  setGmUserIdRef(seeded.gmUserId);
  container.sessionCommandExecutor.registerHandlers([
    ...buildCommandHandlers(container),
    ...(options.extraHandlers ?? []),
  ]);

  const app = new Elysia()
    .onError(({ error, code, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { code: error.code, message: error.message, metadata: error.metadata };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return { code: "VALIDATION_FAILED", message: error.message };
      }
      set.status = 500;
      return { code: "INTERNAL_SERVER_ERROR", message: (error as Error).message };
    })
    .use(createIdentityRoutes(container))
    .use(createSessionsRoutes(container))
    .use(createCharactersRoutes(container))
    .use(createMediaRoutes(container))
    .use(createCatalogRoutes(container))
    .use(createThemeRoutes(container))
    .use(createUiSettingsRoutes(container))
    .use(createAdminRoutes(container))
    .use(createTrashRoutes(container))
    .use(createRulesRoutes(container))
    .use(createTemplatesRoutes(container))
    .use(realtimeRoutes(container));

  const login = async (username: string) => {
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: gmPassword }),
      })
    );
    return ((await res.json()) as { sessionToken: string }).sessionToken;
  };

  const gmToken = await login("gm");
  const adminToken = await login("admin");

  const now = Date.now();
  await container.db.insert(modules).values({
    id: "module-test",
    ownerId: seeded.gmUserId,
    name: "Test Module",
    description: "",
    ruleId: "coc7e",
    themeId: null,
    sourceTemplateId: null,
    sourceTemplateVersion: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const defaultSheet = {
    attributes: { str: 50, con: 60, siz: 70, dex: 50, app: 50, int: 60, pow: 60, edu: 50, luck: 50 },
    skills: { 侦查: 60, 图书馆: 50, 聆听: 40 },
  };

  for (const char of options.characters ?? []) {
    await container.db.insert(characters).values({
      id: char.id,
      ownerId: seeded.gmUserId,
      ownerKind: "gm",
      name: char.name,
      background: "",
      kind: char.kind,
      ruleId: "coc7e",
      sheetJson: JSON.stringify(char.sheet ?? defaultSheet),
      sheetVersion: 1,
      profileVersion: 1,
      version: 1,
      originType: null,
      originRefId: null,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if ((char.portraits ?? []).length > 0) {
      const { mediaAssets } = await import("@/platform/db/schema");
      await container.db.insert(mediaAssets).values({
        id: "asset-placeholder",
        ownerId: seeded.gmUserId,
        purpose: "portrait",
        storageKey: "test-placeholder",
        filename: "placeholder.png",
        mimeType: "image/png",
        size: 1,
        sha256: "placeholder",
        metadataJson: "{}",
        deletedAt: null,
        createdAt: Date.now(),
      }).onConflictDoNothing();
    }
    for (const expressionKey of char.portraits ?? []) {
      await container.db.insert(characterPortraits).values({
        id: `portrait-${char.id}-${expressionKey}`,
        characterId: char.id,
        expressionKey,
        label: null,
        portraitAssetId: "asset-placeholder",
        isDefault: expressionKey === "default" ? 1 : 0,
        sortOrder: 0,
        deletedAt: null,
        createdAt: Date.now(),
      });
    }
    await container.db.insert(moduleCharacters).values({
      id: `link-${char.id}`,
      moduleId: "module-test",
      characterId: char.id,
      deletedAt: null,
      createdAt: Date.now(),
    });
  }

  const playerTokens = new Map<string, string>();
  const playerIds = new Map<string, string>();
  for (const player of options.players ?? []) {
    const res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: `fp-${player}` }),
      })
    );
    const body = (await res.json()) as { playerId: string; token: string };
    playerIds.set(player, body.playerId);
    playerTokens.set(player, body.token);
  }

  const plTokens = new Map<string, string>();
  const plIds = new Map<string, string>();
  const sessionsRepo = new DrizzleSessionsRepository(container.db);
  const createSession = new CreateSessionUseCase(
    sessionsRepo,
    container.ruleRegistry,
    container.idGenerator,
    container.clock
  );
  const sessionRes = await createSession.execute({
    ownerId: seeded.gmUserId,
    moduleId: "module-test",
    characterIds: (options.characters ?? []).map((c) => c.id),
  });
  const sessionId = sessionRes.session.id;

  for (const name of options.plAccounts ?? []) {
    const repo = new DrizzleIdentityRepository(container.db);
    const clock = new SystemClock();
    await new CreateUserUseCase(new UuidGenerator(), clock, repo).execute({
      username: name,
      password: gmPassword,
      role: "pl",
    });
    const token = await login(name);
    plTokens.set(name, token);
    const record = await repo.findUserByUsernameNormalized(name.toLowerCase());
    if (record) {
      plIds.set(name, record.id);
    }
  }

  const claimSeat = new ClaimSeatUseCase(sessionsRepo, container.idGenerator, container.clock);
  for (const claim of options.claims ?? []) {
    let userId = plIds.get(claim.player);
    // PC 席位必须由 PL 账号持有：未显式声明 plAccounts 的用例自动补一个账号。
    if (!userId && claim.role === "pc") {
      const accountName = `pl-${claim.player}`.slice(0, 32);
      const repo = new DrizzleIdentityRepository(container.db);
      const existingAccount = await repo.findUserByUsernameNormalized(accountName.toLowerCase());
      if (!existingAccount) {
        await new CreateUserUseCase(new UuidGenerator(), new SystemClock(), repo).execute({
          username: accountName,
          password: gmPassword,
          role: "pl",
        });
      }
      const record = await repo.findUserByUsernameNormalized(accountName.toLowerCase());
      if (record) {
        userId = record.id;
        plIds.set(claim.player, record.id);
        plTokens.set(claim.player, await login(accountName));
      }
    }
    if (userId) {
      await claimSeat.execute({
        sessionId,
        holder: { holderKind: "user", userId, playerId: null },
        role: claim.role,
        characterId: claim.characterId,
      });
    } else {
      await claimSeat.execute({
        sessionId,
        holder: { holderKind: "anonymous", userId: null, playerId: playerIds.get(claim.player)! },
        role: claim.role,
        characterId: claim.characterId,
      });
    }
  }

  // PC 席位改由 PL 账号持有；把席位令牌并回 playerTokens，
  // 使既有用例继续用 ctx.playerTokens.get(name) 取得"能进这个团的令牌"。
  for (const [name, token] of plTokens) {
    playerTokens.set(name, token);
  }

  return {
    container,
    app,
    gmToken,
    gmUserId: seeded.gmUserId,
    adminToken,
    sessionId,
    moduleId: "module-test",
    playerTokens,
    playerIds,
    plTokens,
    plIds,
    themesDir,
  };
}

/** 将团推进到 active 并切换到指定阶段 */
export async function setSessionPhase(
  ctx: TestContext,
  phase: "free_discussion" | "performance_time" | "forced_cg" | "free_performance"
): Promise<void> {
  const transitions: Record<string, string> = {
    waiting: "preparing",
    preparing: "active",
  };
  const { sessions } = await import("@/platform/db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await ctx.container.db.select().from(sessions).where(eq(sessions.id, ctx.sessionId));
  const current = rows[0]?.status;
  if (current !== "active") {
    const next = transitions[current ?? ""];
    if (next) {
      await ctx.app.handle(
        new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
          body: JSON.stringify({ status: next }),
        })
      );
      await setSessionPhase(ctx, phase);
      return;
    }
  }
  await ctx.app.handle(
    new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
      body: JSON.stringify({ phase }),
    })
  );
}
