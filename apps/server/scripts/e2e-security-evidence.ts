import { z } from "zod";
import { SessionSnapshotPayload, CreateSessionResponse, ModuleDto, CharacterDto, PlayerIdentityResponse } from "@cogm/shared";

const PORT = Number(process.env.PORT ?? 15632);
const RUN = process.env.E2E_RUN ?? "default";
const BASE = `http://localhost:${PORT}`;
const WS_BASE = `ws://localhost:${PORT}`;
const GM_PASSWORD = process.env.GM_PASSWORD!;

const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} :: ${detail}`);
}

function cookieOf(response: Response): string {
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

const ServerMessageEnvelope = z.object({ type: z.string(), payload: z.unknown() });

type Message = { type: string; payload: unknown };

type Collecting = {
  messages: Message[];
  waitFor: (predicate: (m: Message, index: number) => boolean, timeoutMs?: number) => Promise<Message>;
  send: (type: string, payload: unknown) => void;
  closed: Promise<void>;
};

function collector(sessionId: string, cookie: string): Collecting {
  const messages: Array<{ type: string; payload: unknown }> = [];
  const ws = new WebSocket(`${WS_BASE}/api/v1/sessions/${sessionId}/ws`, { headers: { Cookie: cookie } });
  const closed = Promise.withResolvers<void>();
  ws.onmessage = (event) => {
    const parsed = ServerMessageEnvelope.safeParse(JSON.parse(event.data as string));
    if (parsed.success) {
      messages.push(parsed.data);
    }
  };
  ws.onclose = () => closed.resolve();
  ws.onerror = () => closed.resolve();
  const waitFor = (predicate: (m: Message, index: number) => boolean, timeoutMs = 8000) => {
    const { promise, resolve, reject } = Promise.withResolvers<Message>();
    const immediateIndex = messages.findIndex(predicate);
    if (immediateIndex >= 0) {
      return Promise.resolve(messages[immediateIndex]!);
    }
    const timer = setInterval(() => {
      const index = messages.findIndex(predicate);
      if (index >= 0) {
        clearInterval(timer);
        resolve(messages[index]!);
      }
    }, 15);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`waitFor timeout (saw ${messages.map((m) => m.type).join(",")})`));
    }, timeoutMs);
    return promise;
  };
  const send = (type: string, payload: unknown) => {
    ws.send(JSON.stringify({ protocolVersion: 1, commandId: crypto.randomUUID(), type, payload }));
  };
  return { messages, waitFor, send, closed: closed.promise };
}

const CheckRequested = z.object({ request: z.object({ id: z.string() }) });

async function gmFetch(path: string, auth: string, method: string, body?: unknown, origin = BASE) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, Authorization: auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  const login = await fetch(`${BASE}/api/v1/gm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "gm", password: GM_PASSWORD }),
  });
  const gmCookie = cookieOf(login);
  const gmAuth = `Bearer ${z.object({ sessionToken: z.string() }).parse(await login.json()).sessionToken}`;
  record("gm login", login.status === 200, `status=${login.status}`);

  const evil = await gmFetch("/api/v1/gm/modules", gmAuth, "POST", { name: "cross-origin probe", description: "", ruleId: "coc7e" }, "http://evil.example");
  record("(b) cross-origin GM write rejected", evil.status === 403, `status=${evil.status}`);

  const moduleRes = await gmFetch("/api/v1/gm/modules", gmAuth, "POST", { name: "e2e security module", description: "", ruleId: "coc7e" });
  const moduleId = ModuleDto.parse(await moduleRes.json()).id;
  record("(b) same-origin GM write accepted", moduleRes.status === 200, `status=${moduleRes.status}`);

  const sheet = {
    attributes: { str: 50, con: 60, siz: 70, dex: 50, app: 50, int: 60, pow: 60, edu: 50, luck: 50 },
    skills: { 侦查: 60, 聆听: 40 },
  };
  const charRes = await gmFetch("/api/v1/gm/characters", gmAuth, "POST", {
    name: "E2E 调查员",
    kind: "pc",
    ruleId: "coc7e",
    sheetData: sheet,
  });
  const characterId = CharacterDto.parse(await charRes.json()).id;
  record("character created", charRes.status === 200, `status=${charRes.status}`);
  const linkRes = await gmFetch(`/api/v1/gm/modules/${moduleId}/characters`, gmAuth, "POST", { characterId });
  record("character linked to module", linkRes.status === 200, `status=${linkRes.status}`);


  const sessionRes = await gmFetch("/api/v1/gm/sessions", gmAuth, "POST", { moduleId, characterIds: [characterId] });
  const sessionId = CreateSessionResponse.parse(await sessionRes.json()).session.id;
  record("session created", sessionRes.status === 200, `status=${sessionRes.status}`);

  await gmFetch(`/api/v1/gm/sessions/${sessionId}/status`, gmAuth, "POST", { status: "preparing" });
  await gmFetch(`/api/v1/gm/sessions/${sessionId}/status`, gmAuth, "POST", { status: "active" });
  const phaseRes = await gmFetch(`/api/v1/gm/sessions/${sessionId}/phase`, gmAuth, "POST", { phase: "free_performance" });
  record("session active in free_performance", phaseRes.status === 200, `status=${phaseRes.status}`);

  const playerIdentity = await fetch(`${BASE}/api/v1/player/identity`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Fingerprint": `e2e-player-fp-${RUN}` },
    body: JSON.stringify({ fingerprint: `e2e-player-fp-${RUN}` }),
  });
  const playerCookie = cookieOf(playerIdentity);
  record("(c) player identity issued", playerIdentity.status === 200, `status=${playerIdentity.status}`);

  const claim = await fetch(`${BASE}/api/v1/sessions/${sessionId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: playerCookie },
    body: JSON.stringify({ role: "pc", characterId }),
  });
  record("(f37) claim via httpOnly cookie only", claim.status === 200, `status=${claim.status}`);

  const gmWs = collector(sessionId, gmCookie);
  const pcWs = collector(sessionId, playerCookie);
  await gmWs.waitFor((m) => m.type === "snapshot");
  await pcWs.waitFor((m) => m.type === "snapshot");

  const CheckResolved = z.object({ result: z.object({ outcome: z.string() }) });
  const growthOutcomes: Record<string, true> = {
    critical: true,
    extreme_success: true,
    hard_success: true,
    regular_success: true,
  };

  async function hiddenCheck(resolvedBefore: number): Promise<{ grown: boolean; hiddenStateEvents: number }> {
    const stateBefore = gmWs.messages.filter((m) => m.type === "state:changed").length;
    gmWs.send("check:perform", { characterId, skillKey: "侦查", hidden: true });
    const resolved = CheckResolved.parse(
      (await gmWs.waitFor((m, index) => index >= resolvedBefore && m.type === "check:resolved", 8000)).payload
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      grown: growthOutcomes[resolved.result.outcome] === true,
      hiddenStateEvents: gmWs.messages.filter((m) => m.type === "state:changed").length - stateBefore,
    };
  }

  let grown = false;
  let hiddenStateEvents = 0;
  for (let attempt = 0; attempt < 12 && !grown; attempt++) {
    const resolvedBefore = gmWs.messages.filter((m) => m.type === "check:resolved").length;
    const result = await hiddenCheck(resolvedBefore);
    grown = result.grown;
    hiddenStateEvents += result.hiddenStateEvents;
  }
  record("(a) hidden successful check produced a private growth mark", grown && hiddenStateEvents > 0, `grown=${grown} gmStateEvents=${hiddenStateEvents}`);

  record(
    "(a) hidden check result not sent to player",
    !pcWs.messages.some((m) => m.type === "check:resolved"),
    `count=${pcWs.messages.filter((m) => m.type === "check:resolved").length}`
  );
  record(
    "(a) hidden growth-mark state:changed not sent to player",
    !pcWs.messages.some((m) => m.type === "state:changed"),
    `count=${pcWs.messages.filter((m) => m.type === "state:changed").length}`
  );

  const playerSnapshotWs = collector(sessionId, playerCookie);
  const playerSnapshot = SessionSnapshotPayload.parse(
    (await playerSnapshotWs.waitFor((m) => m.type === "snapshot")).payload
  );
  const playerChar = playerSnapshot.characters.find((c) => c.characterId === characterId);
  record(
    "(a) player snapshot excludes hidden growth marks",
    playerChar !== undefined && !String(JSON.stringify(playerChar.state)).includes("侦查"),
    `state=${JSON.stringify(playerChar?.state)}`
  );

  const gmSnapshotWs = collector(sessionId, gmCookie);
  const gmSnapshot = SessionSnapshotPayload.parse(
    (await gmSnapshotWs.waitFor((m) => m.type === "snapshot")).payload
  );
  const gmChar = gmSnapshot.characters.find((c) => c.characterId === characterId);
  record(
    "(a) GM snapshot retains hidden growth marks",
    String(JSON.stringify(gmChar?.state)).includes("侦查"),
    `state=${JSON.stringify(gmChar?.state)}`
  );

  for (const socket of [gmWs, pcWs, playerSnapshotWs, gmSnapshotWs]) {
    socket.messages.length = 0;
  }

  const bannedFp = `e2e-banned-fingerprint-${RUN}`;
  const bannedIdentity = await fetch(`${BASE}/api/v1/player/identity`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Fingerprint": bannedFp },
    body: JSON.stringify({ fingerprint: bannedFp }),
  });
  const bannedPlayerId = PlayerIdentityResponse.parse(await bannedIdentity.json()).playerId;
  const ban = await gmFetch("/api/v1/gm/blacklist", gmAuth, "POST", { playerId: bannedPlayerId, reason: "e2e ban" });
  record("(c) GM bans a fingerprint", ban.status === 200, `status=${ban.status}`);

  const gmMeWithBan = await fetch(`${BASE}/api/v1/gm/auth/me`, { headers: { Cookie: gmCookie, "X-Fingerprint": bannedFp } });
  record("(c) banned-fingerprint GM request allowed on /gm", gmMeWithBan.status === 200, `status=${gmMeWithBan.status}`);

  const gmModulesWithBan = await fetch(`${BASE}/api/v1/gm/modules`, { headers: { Cookie: gmCookie, "X-Fingerprint": bannedFp } });
  record("(c) banned-fingerprint GM read allowed", gmModulesWithBan.status === 200, `status=${gmModulesWithBan.status}`);

  const playerStillBanned = await fetch(`${BASE}/api/v1/player/identity`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Fingerprint": bannedFp },
    body: JSON.stringify({ fingerprint: bannedFp }),
  });
  record("(c) player path still enforces the ban", playerStillBanned.status === 403, `status=${playerStillBanned.status}`);

  let limited = 0;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${BASE}/api/v1/gm/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gm", password: "wrong-password" }),
    });
    if (res.status === 429) {
      limited += 1;
    }
  }
  record("(d) login rate limit still triggers", limited > 0, `received ${limited} x 429`);

  for (const socket of [gmWs, pcWs, playerSnapshotWs, gmSnapshotWs]) {
    socket.messages.length = 0;
  }

  const failures = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
