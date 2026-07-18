import { z } from "zod";

// ---------- commands ----------

export const SwitchSceneCommand = z.object({
  sceneId: z.string().min(1),
});
export type SwitchSceneCommand = z.infer<typeof SwitchSceneCommand>;

export const SetExpressionCommand = z.object({
  characterId: z.string().min(1),
  expressionKey: z.string().min(1).max(64),
});
export type SetExpressionCommand = z.infer<typeof SetExpressionCommand>;

export const UpdateBgmCommand = z.object({
  action: z.enum(["play", "pause", "seek", "volume", "loop"]),
  trackId: z.string().min(1).optional(),
  seekOffsetMs: z.number().int().min(0).optional(),
  volume: z.number().int().min(0).max(100).optional(),
  loop: z.boolean().optional(),
  /** 客户端应用本次音量/播放状态变化的淡入淡出时长。 */
  transitionMs: z.number().int().min(0).max(60_000).optional(),
  expectedVersion: z.number().int().min(0),
});
export type UpdateBgmCommand = z.infer<typeof UpdateBgmCommand>;

export const PlaySeCommand = z.object({
  trackId: z.string().min(1),
  volume: z.number().int().min(0).max(100).optional(),
});
export type PlaySeCommand = z.infer<typeof PlaySeCommand>;

// ---------- events & DTO ----------

/** Event payload: scene:changed */
export const SceneChangedEvent = z.object({
  sceneId: z.string(),
  name: z.string(),
  bgAssetId: z.string().nullable(),
});
export type SceneChangedEvent = z.infer<typeof SceneChangedEvent>;

/** Event payload: expression:changed */
export const ExpressionChangedEvent = z.object({
  characterId: z.string(),
  expressionKey: z.string(),
});
export type ExpressionChangedEvent = z.infer<typeof ExpressionChangedEvent>;

export const BgmState = z.object({
  trackId: z.string().nullable(),
  playing: z.boolean(),
  volume: z.number().int().min(0).max(100),
  loop: z.boolean(),
  seekOffsetMs: z.number().int().min(0),
  startedAtMs: z.number().int(),
  version: z.number().int().min(0),
});
export type BgmState = z.infer<typeof BgmState>;

/** Event payload: audio:bgm（权威 BGM 状态变更） */
export const BgmUpdatedEvent = z.object({
  bgm: BgmState,
  transitionMs: z.number().int().min(0).max(60_000).optional(),
});
export type BgmUpdatedEvent = z.infer<typeof BgmUpdatedEvent>;

/** Event payload: audio:se（fire-and-forget，不进快照、不补播） */
export const SePlayedEvent = z.object({
  trackId: z.string(),
  volume: z.number().int().min(0).max(100),
});
export type SePlayedEvent = z.infer<typeof SePlayedEvent>;
