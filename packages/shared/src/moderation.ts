import { z } from "zod";

// ---------- commands ----------

export const KickPlayerCommand = z.object({
  playerId: z.string().min(1),
});
export type KickPlayerCommand = z.infer<typeof KickPlayerCommand>;

export const BanFingerprintCommand = z.object({
  playerId: z.string().min(1),
  reason: z.string().max(500).default(""),
  /** 封禁时长（秒）；不传表示永久 */
  durationSeconds: z.number().int().min(60).optional(),
});
export type BanFingerprintCommand = z.infer<typeof BanFingerprintCommand>;

export const UnbanFingerprintCommand = z.object({
  fingerprintHash: z.string().min(1),
});
export type UnbanFingerprintCommand = z.infer<typeof UnbanFingerprintCommand>;

// ---------- events & DTO ----------

export const OnlinePlayerDto = z.object({
  playerId: z.string(),
  role: z.enum(["pc", "ob"]),
  characterId: z.string().nullable(),
  connectionCount: z.number().int().min(1),
});
export type OnlinePlayerDto = z.infer<typeof OnlinePlayerDto>;

/** GM 专用 DirectControlMessage: presence:updated（在线列表全量，无 eventId） */
export const PresenceUpdatedMessage = z.object({
  online: z.array(OnlinePlayerDto),
});
export type PresenceUpdatedMessage = z.infer<typeof PresenceUpdatedMessage>;
