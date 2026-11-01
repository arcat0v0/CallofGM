import { and, eq } from "drizzle-orm";
import {
  SwitchSceneCommand,
  SetExpressionCommand,
  UpdateBgmCommand,
  PlaySeCommand,
  UpdateSessionSettingsCommand,
  type BgmState,
} from "@cogm/shared";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
} from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import { sessions, scenes, tracks, sessionAudioState, sessionCharacters, characterPortraits } from "@/platform/db/schema";
import { ExpressionNotFoundError } from "@/modules/chat";
import type { DbClient } from "@/platform/db/client";

class SceneNotFoundError extends AppError {
  constructor(message = "Scene not found in this module") {
    super("SCENE_NOT_FOUND", message, 404);
  }
}

class TrackNotFoundError extends AppError {
  constructor(message = "Track not found in this module") {
    super("TRACK_NOT_FOUND", message, 404);
  }
}

class AudioVersionConflictError extends AppError {
  constructor(message = "Stale audio state version") {
    super("AUDIO_VERSION_CONFLICT", message, 409);
  }
}

class CharacterNotInSessionError extends AppError {
  constructor(message = "Character is not participating in this session") {
    super("CHARACTER_NOT_IN_SESSION", message, 404);
  }
}

async function loadAudioState(tx: DbClient, sessionId: string): Promise<BgmState | null> {
  const rows = await tx
    .select({
      audio: sessionAudioState,
      duration: tracks.duration,
      name: tracks.name,
      audioAssetId: tracks.audioAssetId,
    })
    .from(sessionAudioState)
    .leftJoin(tracks, eq(sessionAudioState.trackId, tracks.id))
    .where(eq(sessionAudioState.sessionId, sessionId));
  const row = rows[0];
  if (!row) {
    return null;
  }
  const audio = row.audio;
  return {
    trackId: audio.trackId ?? null,
    playing: audio.playing === 1,
    volume: audio.volume,
    loop: audio.loop === 1,
    seekOffsetMs: audio.seekOffsetMs,
    startedAtMs: audio.startedAtMs,
    version: audio.version,
    durationMs: row.duration ?? 0,
    name: row.name ?? undefined,
    audioAssetId: row.audioAssetId ?? null,
  };
}

/** scene:switch — 切换当前场景（仅允许本模组场景） */
export class SwitchSceneHandler implements CommandHandler {
  readonly type = "scene:switch" as const;
  readonly allowedStatuses = ["preparing", "active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can switch scenes");
    }
    const parsed = SwitchSceneCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const sceneId = parsed.data.sceneId;

    const rows = await ctx.tx.select().from(scenes).where(eq(scenes.id, sceneId));
    const scene = rows[0];
    if (!scene || scene.moduleId !== ctx.session.moduleId) {
      throw new SceneNotFoundError();
    }

    await ctx.tx.update(sessions).set({ currentSceneId: sceneId }).where(eq(sessions.id, ctx.sessionId));

    return {
      events: [
        {
          type: "scene:changed",
          payload: { sceneId: scene.id, name: scene.name, bgAssetId: scene.bgAssetId ?? null },
          visibility: { type: "public" },
        },
      ],
      replyPayload: { sceneId },
    };
  }
}

/** expression:set — GM 切换任意团内人物的当前表情立绘 */
export class SetExpressionHandler implements CommandHandler {
  readonly type = "expression:set" as const;
  readonly allowedStatuses = ["preparing", "active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can set expressions directly");
    }
    const parsed = SetExpressionCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const { characterId, expressionKey } = parsed.data;

    const sessionCharRows = await ctx.tx
      .select({ id: sessionCharacters.id })
      .from(sessionCharacters)
      .where(
        and(
          eq(sessionCharacters.sessionId, ctx.sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      );
    if (sessionCharRows.length === 0) {
      throw new CharacterNotInSessionError();
    }

    const portraitRows = await ctx.tx
      .select({ id: characterPortraits.id })
      .from(characterPortraits)
      .where(
        and(
          eq(characterPortraits.characterId, characterId),
          eq(characterPortraits.expressionKey, expressionKey)
        )
      );
    if (portraitRows.length === 0) {
      throw new ExpressionNotFoundError();
    }

    await ctx.tx
      .update(sessionCharacters)
      .set({ currentExpressionKey: expressionKey })
      .where(
        and(
          eq(sessionCharacters.sessionId, ctx.sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      );

    return {
      events: [
        {
          type: "expression:changed",
          payload: { characterId, expressionKey },
          visibility: { type: "public" },
        },
      ],
      replyPayload: { characterId, expressionKey },
    };
  }
}

/**
 * audio:bgm — 权威 BGM 控制（播放/暂停/seek/音量/循环）。
 * 所有指令携带 expectedVersion 做乐观并发控制，陈旧指令不得覆盖新状态。
 */
export class UpdateBgmHandler implements CommandHandler {
  readonly type = "audio:bgm" as const;
  readonly allowedStatuses = ["preparing", "active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can control BGM");
    }
    const parsed = UpdateBgmCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const current = await loadAudioState(ctx.tx, ctx.sessionId);
    const currentVersion = current?.version ?? 0;
    if (input.expectedVersion !== currentVersion) {
      throw new AudioVersionConflictError();
    }

    const now = ctx.clock.nowEpochMs();
    const base: BgmState = current ?? {
      trackId: null,
      playing: false,
      volume: 100,
      loop: true,
      seekOffsetMs: 0,
      startedAtMs: now,
      version: 0,
    };

    /** 播放中的实时位置（服务器时钟推导；循环曲目对 duration 取模） */
    const currentPosition = (): number => {
      const duration = base.durationMs ?? 0;
      let position = base.seekOffsetMs;
      if (base.playing) {
        position = base.seekOffsetMs + Math.max(0, now - base.startedAtMs);
      }
      if (base.loop && duration > 0) {
        return position % duration;
      }
      return position;
    };

    const next: BgmState = { ...base };
    switch (input.action) {
      case "play": {
        if (!input.trackId) {
          throw new AppError("VALIDATION_FAILED", "trackId is required for play", 400);
        }
        const trackRows = await ctx.tx.select().from(tracks).where(eq(tracks.id, input.trackId));
        const track = trackRows[0];
        if (!track || track.moduleId !== ctx.session.moduleId || track.type !== "bgm") {
          throw new TrackNotFoundError("BGM track not found in this module");
        }
        // 切歌从 0 起播；同曲默认继续，显式 restart 或 seekOffset 时从头/指定位置起播
        const isSameTrack = base.trackId === input.trackId;
        next.trackId = input.trackId;
        next.playing = true;
        next.seekOffsetMs = input.restart
          ? (input.seekOffsetMs ?? 0)
          : (input.seekOffsetMs ?? (isSameTrack ? base.seekOffsetMs : 0));
        next.startedAtMs = now;
        next.durationMs = track.duration;
        next.name = track.name;
        next.audioAssetId = track.audioAssetId;
        break;
      }
      case "pause": {
        if (!base.playing) {
          break;
        }
        next.playing = false;
        // 暂停时固化进度
        next.seekOffsetMs = currentPosition();
        next.startedAtMs = now;
        break;
      }
      case "seek": {
        if (input.seekOffsetMs === undefined) {
          throw new AppError("VALIDATION_FAILED", "seekOffsetMs is required for seek", 400);
        }
        next.seekOffsetMs = input.seekOffsetMs;
        next.startedAtMs = now;
        break;
      }
      case "volume": {
        if (input.volume === undefined) {
          throw new AppError("VALIDATION_FAILED", "volume is required for volume", 400);
        }
        next.volume = input.volume;
        break;
      }
      case "loop": {
        if (input.loop === undefined) {
          throw new AppError("VALIDATION_FAILED", "loop is required for loop", 400);
        }
        next.loop = input.loop;
        break;
      }
    }
    next.version = currentVersion + 1;

    const existing = await ctx.tx
      .select({ id: sessionAudioState.id })
      .from(sessionAudioState)
      .where(eq(sessionAudioState.sessionId, ctx.sessionId));
    if (existing.length > 0) {
      await ctx.tx
        .update(sessionAudioState)
        .set({
          trackId: next.trackId,
          playing: next.playing ? 1 : 0,
          volume: next.volume,
          loop: next.loop ? 1 : 0,
          seekOffsetMs: next.seekOffsetMs,
          startedAtMs: next.startedAtMs,
          version: next.version,
        })
        .where(eq(sessionAudioState.sessionId, ctx.sessionId));
    } else {
      await ctx.tx.insert(sessionAudioState).values({
        id: ctx.idGenerator.nextId(),
        sessionId: ctx.sessionId,
        trackId: next.trackId,
        playing: next.playing ? 1 : 0,
        volume: next.volume,
        loop: next.loop ? 1 : 0,
        seekOffsetMs: next.seekOffsetMs,
        startedAtMs: next.startedAtMs,
        version: next.version,
        createdAt: now,
      });
    }

    return {
      events: [
        {
          type: "audio:bgm",
          payload: { bgm: next, transitionMs: input.transitionMs },
          visibility: { type: "public" },
        },
      ],
      replyPayload: { bgm: next, transitionMs: input.transitionMs },
    };
  }
}

export class PlaySeHandler implements CommandHandler {
  readonly type = "audio:se" as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can play sound effects");
    }
    const parsed = PlaySeCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const trackRows = await ctx.tx.select().from(tracks).where(eq(tracks.id, input.trackId));
    const track = trackRows[0];
    if (!track || track.moduleId !== ctx.session.moduleId || track.type !== "se") {
      throw new TrackNotFoundError("SE track not found in this module");
    }

    return {
      directToSession: [{
        type: "audio:se",
        payload: {
          trackId: track.id,
          volume: input.volume ?? 100,
          audioAssetId: track.audioAssetId,
          name: track.name,
        },
      }],
      replyPayload: { ok: true },
    };
  }
}

export class UpdateSessionSettingsHandler implements CommandHandler {
  readonly type = "session:settings" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can change session settings");
    }
    const parsed = UpdateSessionSettingsCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const settings = parsed.data;

    await ctx.tx
      .update(sessions)
      .set({
        sharePcSheets: settings.sharePcSheets ? 1 : 0,
        obSeePcState: settings.obSeePcState ? 1 : 0,
      })
      .where(eq(sessions.id, ctx.sessionId));

    return {
      events: [
        {
          type: "session:settings-changed",
          payload: settings,
          visibility: { type: "public" },
        },
      ],
      replyPayload: settings,
    };
  }
}

export function createStageCommandHandlers(): CommandHandler[] {
  return [
    new SwitchSceneHandler(),
    new SetExpressionHandler(),
    new UpdateBgmHandler(),
    new PlaySeHandler(),
    new UpdateSessionSettingsHandler(),
  ];
}

