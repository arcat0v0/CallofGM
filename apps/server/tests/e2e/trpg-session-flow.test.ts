import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { buildCommandHandlers } from "@/bootstrap/handlers";
import { createIdentityRoutes } from "@/modules/identity";
import { createAdminRoutes } from "@/modules/admin";
import { createRulesRoutes } from "@/modules/rules";
import { createTemplatesRoutes } from "@/modules/templates";
import { createMediaRoutes } from "@/modules/media";
import { createCatalogRoutes } from "@/modules/catalog";
import { createCharactersRoutes } from "@/modules/characters";
import { createSessionsRoutes } from "@/modules/sessions";
import { createRealtimeRoutes } from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import {
  CharacterDto,
  CreateSessionResponse,
  JoinInfoResponse,
  ClaimDto,
  SessionDto,
  MediaAssetDto,
  CharacterPortraitDto,
  type DirectControlMessage,
  type SessionEvent,
  type SessionSnapshot,
  type SceneDto,
  type CatalogHandoutDto,
  type ModuleDto,
} from "@cogm/shared";
import { listenTestApp, connectWs, closeWs, sendCommand, seedAccounts, type TestWebSocket } from "../helpers/setup";

describe("End-to-End TRPG Session Flow (GM Hosting & Player TRPG)", () => {
  let container: Container;
  let server: ReturnType<typeof listenTestApp>;
  let baseUrl: string;
  let wsUrl: string;

  const gmPassword = "trpg-test-gm-password";
  let gmToken = "";
  let adminToken = "";
  let p1Token = "";
  let p2Token = "";
  let obToken = "";

  let p1Id = "";
  let p2Id = "";
  let obId = "";

  let char1Id = "";
  let char2Id = "";
  let npcId = "";
  let moduleId = "";
  let scene1Id = "";
  let scene2Id = "";
  let track1Id = "";
  let handout1Id = "";
  let portraitAssetId = "";
  let bgAssetId = "";
  let audioAssetId = "";
  let sessionId = "";

  let gmWs: TestWebSocket;
  let p1Ws: TestWebSocket;
  let p2Ws: TestWebSocket;
  let obWs: TestWebSocket;

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";

    container = new Container();
    await container.startupService.startup();
    await seedAccounts(container.db, gmPassword);
    container.sessionCommandExecutor.registerHandlers(buildCommandHandlers(container));

    const app = new Elysia()
      .onError(({ error, code, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return { code: error.code, message: error.message };
        }
        if (code === "VALIDATION") {
          set.status = 400;
          return { code: "VALIDATION_FAILED", message: (error as Error).message };
        }
        set.status = 500;
        return { code: "INTERNAL_SERVER_ERROR", message: (error as Error).message };
      })
      .use(createIdentityRoutes(container))
      .use(createMediaRoutes(container))
      .use(createCatalogRoutes(container))
      .use(createCharactersRoutes(container))
      .use(createSessionsRoutes(container))
      .use(createRealtimeRoutes(container))
      .use(createAdminRoutes(container))
      .use(createRulesRoutes(container))
      .use(createTemplatesRoutes(container));

    server = listenTestApp(app);
    baseUrl = `http://127.0.0.1:${server.server.port}`;
    wsUrl = `ws://127.0.0.1:${server.server.port}`;
  });

  afterAll(async () => {
    if (gmWs) await closeWs(gmWs);
    if (p1Ws) await closeWs(p1Ws);
    if (p2Ws) await closeWs(p2Ws);
    if (obWs) await closeWs(obWs);
    if (server) {
      await Promise.race([
        Promise.resolve(server.stop(true)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    }
  });

  test("Phase 1: GM logs in and manages module assets (Characters, Portraits, Scenes, Tracks, Handouts, Sessions)", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gm", password: gmPassword }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = (await loginRes.json()) as { sessionToken: string };
    gmToken = loginData.sessionToken;
    expect(gmToken.length).toBeGreaterThan(0);

    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: gmPassword }),
    });
    expect(adminLogin.status).toBe(200);
    adminToken = ((await adminLogin.json()) as { sessionToken: string }).sessionToken;

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const portraitFormData = new FormData();
    portraitFormData.append("file", new Blob([pngBytes], { type: "image/png" }), "portrait.png");
    portraitFormData.append("purpose", "portrait");

    const uploadPortraitRes = await fetch(`${baseUrl}/api/v1/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gmToken}` },
      body: portraitFormData,
    });
    expect(uploadPortraitRes.status).toBe(200);
    const portraitMedia = MediaAssetDto.parse(await uploadPortraitRes.json());
    portraitAssetId = portraitMedia.id;

    const bgFormData = new FormData();
    bgFormData.append("file", new Blob([pngBytes], { type: "image/png" }), "scene.png");
    bgFormData.append("purpose", "scene");

    const uploadBgRes = await fetch(`${baseUrl}/api/v1/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gmToken}` },
      body: bgFormData,
    });
    expect(uploadBgRes.status).toBe(200);
    const bgMedia = MediaAssetDto.parse(await uploadBgRes.json());
    bgAssetId = bgMedia.id;

    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const audioFormData = new FormData();
    audioFormData.append("file", new Blob([mp3Bytes], { type: "audio/mpeg" }), "rain.mp3");
    audioFormData.append("purpose", "audio");

    const uploadAudioRes = await fetch(`${baseUrl}/api/v1/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gmToken}` },
      body: audioFormData,
    });
    expect(uploadAudioRes.status).toBe(200);
    const audioMedia = MediaAssetDto.parse(await uploadAudioRes.json());
    audioAssetId = audioMedia.id;

    const c1Res = await fetch(`${baseUrl}/api/v1/gm/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gmToken}`,
      },
      body: JSON.stringify({
        name: "爱德华·卡特",
        kind: "pc",
        ruleId: "coc7e",
        sheetData: {
          schemaVersion: 1,
          attributes: { str: 60, con: 55, siz: 65, dex: 70, app: 50, int: 75, pow: 60, edu: 70, luck: 55 },
          skills: { 侦查: 65, 聆听: 50, 心理学: 60, 闪避: 35, 潜行: 50 },
        },
      }),
    });
    expect(c1Res.status).toBe(200);
    const c1Data = CharacterDto.parse(await c1Res.json());
    char1Id = c1Data.id;

    const addPortraitRes = await fetch(`${baseUrl}/api/v1/gm/characters/${char1Id}/portraits`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({
        expressionKey: "shocked",
        portraitAssetId,
        isDefault: true,
      }),
    });
    expect(addPortraitRes.status).toBe(200);
    CharacterPortraitDto.parse(await addPortraitRes.json());

    const c2Res = await fetch(`${baseUrl}/api/v1/gm/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gmToken}`,
      },
      body: JSON.stringify({
        name: "哈罗德·芬奇",
        kind: "pc",
        ruleId: "coc7e",
        sheetData: {
          schemaVersion: 1,
          attributes: { str: 40, con: 50, siz: 55, dex: 60, app: 60, int: 85, pow: 70, edu: 80, luck: 60 },
          skills: { 图书馆使用: 75, 侦查: 50, 急救: 60, 闪避: 30, 聆听: 50 },
        },
      }),
    });
    expect(c2Res.status).toBe(200);
    const c2Data = CharacterDto.parse(await c2Res.json());
    char2Id = c2Data.id;

    const npcRes = await fetch(`${baseUrl}/api/v1/gm/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gmToken}`,
      },
      body: JSON.stringify({
        name: "神秘守门人",
        kind: "npc",
        ruleId: "coc7e",
        sheetData: {
          schemaVersion: 1,
          attributes: { str: 70, con: 70, siz: 70, dex: 50, app: 40, int: 50, pow: 50, edu: 40, luck: 50 },
          skills: { 格斗: 60, 恐吓: 50 },
        },
      }),
    });
    expect(npcRes.status).toBe(200);
    const npcData = CharacterDto.parse(await npcRes.json());
    npcId = npcData.id;

    const modRes = await fetch(`${baseUrl}/api/v1/gm/modules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gmToken}`,
      },
      body: JSON.stringify({
        name: "幽灵公馆的呼唤",
        description: "调查荒废百年的古老庄园",
        ruleId: "coc7e",
      }),
    });
    expect(modRes.status).toBe(200);
    const modData = (await modRes.json()) as ModuleDto;
    moduleId = modData.id;

    const link1 = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ characterId: char1Id }),
    });
    expect(link1.status).toBe(200);

    const link2 = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ characterId: char2Id }),
    });
    expect(link2.status).toBe(200);

    const link3 = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ characterId: npcId }),
    });
    expect(link3.status).toBe(200);

    const s1Res = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ name: "公馆大门", sortOrder: 0, bgAssetId }),
    });
    expect(s1Res.status).toBe(200);
    const s1Data = (await s1Res.json()) as SceneDto;
    scene1Id = s1Data.id;

    const s2Res = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ name: "地下仪式室", sortOrder: 1, bgAssetId }),
    });
    expect(s2Res.status).toBe(200);
    const s2Data = (await s2Res.json()) as SceneDto;
    scene2Id = s2Data.id;

    const t1Res = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({
        name: "暴雨狂风",
        audioAssetId,
        type: "bgm",
        duration: 120,
      }),
    });
    expect(t1Res.status).toBe(200);
    track1Id = ((await t1Res.json()) as { id: string }).id;

    const h1Res = await fetch(`${baseUrl}/api/v1/gm/modules/${moduleId}/handouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({
        title: "泛黄的日记残页",
        content: "切勿在血月之夜念出那个名字...",
      }),
    });
    expect(h1Res.status).toBe(200);
    const h1Data = (await h1Res.json()) as CatalogHandoutDto;
    handout1Id = h1Data.id;

    const sessRes = await fetch(`${baseUrl}/api/v1/gm/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({
        moduleId,
        characterIds: [char1Id, char2Id, npcId],
      }),
    });
    expect(sessRes.status).toBe(200);
    const sessionCreated = CreateSessionResponse.parse(await sessRes.json());
    sessionId = sessionCreated.session.id;
    expect(sessionId).toBeDefined();
  });

  test("Phase 2: Players acquire identity, join session, and claim seats", async () => {
    // PC 席位必须由 PL 账号持有：这里建立两个玩家账号并登录。
    const plTokenOf = async (username: string) => {
      const created = await fetch(`${baseUrl}/api/v1/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ username, password: "player-password-1", role: "pl" }),
      });
      expect([200, 409]).toContain(created.status);
      const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "player-password-1" }),
      });
      expect(login.status).toBe(200);
      const body = (await login.json()) as { sessionToken: string; userId: string };
      return { token: body.sessionToken, userId: body.userId };
    };

    const alice = await plTokenOf("e2e-alice");
    p1Token = alice.token;
    p1Id = alice.userId;

    const bob = await plTokenOf("e2e-bob");
    p2Token = bob.token;
    p2Id = bob.userId;

    const obIdentRes = await fetch(`${baseUrl}/api/v1/player/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: "fp-player-charlie" }),
    });
    expect(obIdentRes.status).toBe(200);
    const obIdent = (await obIdentRes.json()) as { playerId: string; token: string };
    obId = obIdent.playerId;
    obToken = obIdent.token;

    const joinInfoRes = await fetch(`${baseUrl}/api/v1/public/sessions/${sessionId}/join-info`);
    expect(joinInfoRes.status).toBe(200);
    const joinInfo = JoinInfoResponse.parse(await joinInfoRes.json());
    expect(joinInfo.characters.length).toBeGreaterThanOrEqual(2);

    const claim1Res = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({ role: "pc", characterId: char1Id }),
    });
    expect(claim1Res.status).toBe(200);
    const claim1 = ClaimDto.parse(await claim1Res.json());
    expect(claim1.characterId).toBe(char1Id);

    const claim2Res = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p2Token}` },
      body: JSON.stringify({ role: "pc", characterId: char2Id }),
    });
    expect(claim2Res.status).toBe(200);
    const claim2 = ClaimDto.parse(await claim2Res.json());
    expect(claim2.characterId).toBe(char2Id);

    const claimObRes = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${obToken}` },
      body: JSON.stringify({ role: "ob" }),
    });
    expect(claimObRes.status).toBe(200);
    const claimOb = ClaimDto.parse(await claimObRes.json());
    expect(claimOb.role).toBe("ob");
  });

  test("Phase 3: WebSocket connection and Initial Snapshot verification", async () => {
    gmWs = await connectWs(`${wsUrl}/api/v1/sessions/${sessionId}/ws`, gmToken);
    p1Ws = await connectWs(`${wsUrl}/api/v1/sessions/${sessionId}/ws`, p1Token, "fp-player-alice");
    p2Ws = await connectWs(`${wsUrl}/api/v1/sessions/${sessionId}/ws`, p2Token, "fp-player-bob");
    obWs = await connectWs(`${wsUrl}/api/v1/sessions/${sessionId}/ws`, obToken, "fp-player-charlie");

    await p1Ws.waitFor((m) => m.type === "snapshot");
    await p2Ws.waitFor((m) => m.type === "snapshot");
    await obWs.waitFor((m) => m.type === "snapshot");
    const gmSnapMsg = (await gmWs.waitFor((m) => m.type === "snapshot")) as SessionSnapshot;

    expect(gmSnapMsg.type).toBe("snapshot");
    const snap = gmSnapMsg.payload as {
      session: { id: string; status: string; phase: string };
      characters: Array<{ characterId: string; name: string; state: { hp: number; san: number } | null }>;
    };
    expect(snap.session.id).toBe(sessionId);
    expect(snap.session.status).toBe("waiting");
    expect(snap.characters.some((c) => c.characterId === char1Id && c.state?.san === 60)).toBe(true);
    expect(snap.characters.some((c) => c.characterId === char2Id && c.state?.san === 70)).toBe(true);
  });

  test("Phase 4: Session lifecycle transition to active and free_discussion chat", async () => {
    const prepRes = await fetch(`${baseUrl}/api/v1/gm/sessions/${sessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(prepRes.status).toBe(200);

    const activeRes = await fetch(`${baseUrl}/api/v1/gm/sessions/${sessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ status: "active" }),
    });
    expect(activeRes.status).toBe(200);
    const updatedStatus = SessionDto.parse(await activeRes.json());
    expect(updatedStatus.status).toBe("active");

    await p1Ws.waitFor((m) => m.type === "session:status-changed" && m.payload?.status === "active");

    sendCommand(gmWs, "chat:send", {
      channel: "roleplay",
      content: "夜幕降临，暴雨如注。你们终于抵达了幽灵公馆的大门前。",
    });

    const gmMsgOnP1 = (await p1Ws.waitFor(
      (m) => m.type === "chat:message" && typeof m.payload?.message?.content === "string" && m.payload.message.content.includes("夜幕降临")
    )) as SessionEvent;
    const gmChat = gmMsgOnP1.payload as { message: { senderType: string; content: string } };
    expect(gmChat.message.senderType).toBe("gm");

    sendCommand(p1Ws, "chat:send", {
      channel: "roleplay",
      content: "这扇大铁门紧锁着，我们最好找找侧面的窗户。",
    });

    const p1MsgOnP2 = (await p2Ws.waitFor(
      (m) => m.type === "chat:message" && typeof m.payload?.message?.content === "string" && m.payload.message.content.includes("这扇大铁门紧锁着")
    )) as SessionEvent;
    const p1Chat = p1MsgOnP2.payload as { message: { characterName: string; content: string } };
    expect(p1Chat.message.characterName).toBe("爱德华·卡特");
  });

  test("Phase 5: Performance time queueing, moderation and message release", async () => {
    const updatePhaseRes = await fetch(`${baseUrl}/api/v1/gm/sessions/${sessionId}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ phase: "performance_time" }),
    });
    expect(updatePhaseRes.status).toBe(200);
    const updatedPhase = SessionDto.parse(await updatePhaseRes.json());
    expect(updatedPhase.phase).toBe("performance_time");

    await p1Ws.waitFor((m) => m.type === "session:phase-changed" && m.payload?.phase === "performance_time");

    sendCommand(p1Ws, "chat:send", {
      channel: "roleplay",
      content: "我试着用铁丝拨弄一下锁芯。",
    });

    const queueMsg = (await gmWs.waitFor(
      (m) => m.type === "chat:queue" && Array.isArray(m.payload?.messages) && m.payload.messages.length > 0
    )) as DirectControlMessage;
    const queueData = queueMsg.payload as { messages: Array<{ id: string; content: string }> };
    const queuedMessage = queueData.messages[0];
    expect(queuedMessage?.content).toBe("我试着用铁丝拨弄一下锁芯。");

    sendCommand(gmWs, "chat:release", {
      messageId: queuedMessage!.id,
    });

    const releasedMsg = (await p2Ws.waitFor(
      (m) => m.type === "chat:message" && m.payload?.message?.content === "我试着用铁丝拨弄一下锁芯。"
    )) as SessionEvent;
    const relData = releasedMsg.payload as { message: { characterName: string; content: string } };
    expect(relData.message.characterName).toBe("爱德华·卡特");
  });

  test("Phase 6: Free performance phase, Player Dice rolling, and CoC 7e Skill Checks", async () => {
    const updatePhaseRes = await fetch(`${baseUrl}/api/v1/gm/sessions/${sessionId}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ phase: "free_performance" }),
    });
    expect(updatePhaseRes.status).toBe(200);

    await p1Ws.waitFor((m) => m.type === "session:phase-changed" && m.payload?.phase === "free_performance");

    sendCommand(p1Ws, "dice:roll", {
      expression: "2d6+3",
      comment: "体力消耗检定",
    });

    const diceEvent = (await p2Ws.waitFor((m) => m.type === "dice:rolled")) as SessionEvent;
    const diceData = diceEvent.payload as { characterId: string | null; result: { total: number } };
    expect(diceData.characterId).toBe(char1Id);
    expect(diceData.result.total).toBeGreaterThanOrEqual(5);
    expect(diceData.result.total).toBeLessThanOrEqual(15);

    sendCommand(p1Ws, "check:perform", {
      characterId: char1Id,
      skillKey: "侦查",
      difficulty: "regular",
    });

    const checkEvent = (await p2Ws.waitFor((m) => m.type === "check:resolved")) as SessionEvent;
    const checkData = checkEvent.payload as { characterId: string; skillKey: string; result: { targetValue: number; outcome: string } };
    expect(checkData.characterId).toBe(char1Id);
    expect(checkData.skillKey).toBe("侦查");
    expect(checkData.result.targetValue).toBe(65);
    expect(["critical", "extreme_success", "hard_success", "regular_success", "failure", "fumble"]).toContain(
      checkData.result.outcome
    );

    sendCommand(gmWs, "check:request", {
      characterId: char2Id,
      skillKey: "聆听",
      difficulty: "regular",
    });

    const reqEvent = (await p2Ws.waitFor((m) => m.type === "check:requested")) as SessionEvent;
    const reqData = reqEvent.payload as { request: { id: string; characterId: string } };
    const checkRequestId = reqData.request.id;
    expect(reqData.request.characterId).toBe(char2Id);

    sendCommand(p2Ws, "check:respond", {
      requestId: checkRequestId,
    });

    const resolvedReqEvent = (await p1Ws.waitFor((m) => m.type === "check:resolved" && m.payload?.characterId === char2Id)) as SessionEvent;
    const resData = resolvedReqEvent.payload as { skillKey: string; result: { targetValue: number } };
    expect(resData.skillKey).toBe("聆听");
    expect(resData.result.targetValue).toBe(50);

  });

  test("Phase 7: SAN Check and Sanity State Loss", async () => {
    sendCommand(gmWs, "check:san", {
      characterId: char1Id,
      sanLossExpression: "1/1d6",
    });

    const sanResolved = (await p1Ws.waitFor((m) => m.type === "check:resolved" && m.payload?.skillKey === "san")) as SessionEvent;
    const sanData = sanResolved.payload as { characterId: string; result: { sanBefore: number; loss: number } };
    expect(sanData.characterId).toBe(char1Id);
    expect(sanData.result.sanBefore).toBe(60);
    expect(sanData.result.loss).toBeGreaterThanOrEqual(1);

    const stateChanged = (await p1Ws.waitFor(
      (m) => m.type === "state:changed" && m.payload?.characterId === char1Id && m.payload?.state?.san === 60 - sanData.result.loss
    )) as SessionEvent;
    const stateData = stateChanged.payload as { state: { san: number } };
    expect(stateData.state.san).toBe(60 - sanData.result.loss);
  });

  test("Phase 8: Character dynamic state editing (HP damage, Status, and Tags)", async () => {
    sendCommand(gmWs, "state:edit", {
      characterId: char1Id,
      hpDelta: -3,
      addStatuses: ["major_wound"],
      addTags: ["轻微擦伤"],
    });

    const stateEvent = (await p1Ws.waitFor(
      (m) => m.type === "state:changed" && m.payload?.characterId === char1Id && Array.isArray(m.payload?.state?.statuses) && m.payload.state.statuses.includes("major_wound")
    )) as SessionEvent;
    const statePayload = stateEvent.payload as { characterId: string; state: { statuses: string[]; tags: string[]; hp: number } };
    expect(statePayload.characterId).toBe(char1Id);
    expect(statePayload.state.statuses).toContain("major_wound");
    expect(statePayload.state.tags).toContain("轻微擦伤");
  });

  test("Phase 9: Scene switching, Stage expressions, Audio BGM, and Handout grant", async () => {
    sendCommand(gmWs, "scene:switch", {
      sceneId: scene2Id,
    });

    const sceneSwitched = (await p1Ws.waitFor((m) => m.type === "scene:changed")) as SessionEvent;
    const scenePayload = sceneSwitched.payload as { sceneId: string };
    expect(scenePayload.sceneId).toBe(scene2Id);

    sendCommand(gmWs, "expression:set", {
      characterId: char1Id,
      expressionKey: "shocked",
    });

    const exprEvent = (await p2Ws.waitFor(
      (m) => m.type === "expression:changed" && m.payload?.characterId === char1Id
    )) as SessionEvent;
    const exprPayload = exprEvent.payload as { expressionKey: string };
    expect(exprPayload.expressionKey).toBe("shocked");

    sendCommand(gmWs, "audio:bgm", {
      action: "play",
      trackId: track1Id,
      expectedVersion: 0,
    });

    const audioEvent = (await p1Ws.waitFor((m) => m.type === "audio:bgm")) as SessionEvent;
    const audioPayload = audioEvent.payload as { bgm: { trackId: string; playing: boolean } };
    expect(audioPayload.bgm.trackId).toBe(track1Id);
    expect(audioPayload.bgm.playing).toBe(true);

    sendCommand(gmWs, "handout:grant", {
      handoutId: handout1Id,
    });

    const handoutGranted = (await p1Ws.waitFor((m) => m.type === "handout:granted")) as SessionEvent;
    const handoutPayload = handoutGranted.payload as { grant: { grantId: string; handout: { id: string; title: string } } };
    expect(handoutPayload.grant.handout.id).toBe(handout1Id);
    expect(handoutPayload.grant.handout.title).toBe("泛黄的日记残页");
  });

  test("Phase 10: Player moderation and Session completion", async () => {
    sendCommand(gmWs, "player:kick", {
      holderKind: "anonymous",
      holderId: obId,
      reason: "违反观战规则",
    });

    expect((await obWs.closed).code).toBe(4000);

    const endRes = await fetch(`${baseUrl}/api/v1/gm/sessions/${sessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ status: "ended" }),
    });
    expect(endRes.status).toBe(200);
    const endStatus = SessionDto.parse(await endRes.json());
    expect(endStatus.status).toBe("ended");

    const statusEnded = (await p1Ws.waitFor(
      (m) => m.type === "session:status-changed" && m.payload?.status === "ended"
    )) as SessionEvent;
    const statusPayload = statusEnded.payload as { status: string };
    expect(statusPayload.status).toBe("ended");
  });
});
