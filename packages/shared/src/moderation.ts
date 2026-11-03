import { z } from "zod";

// ---------- commands ----------

export const SeatHolderKindDto = z.enum(["user", "anonymous"]);
export type SeatHolderKindDto = z.infer<typeof SeatHolderKindDto>;

export const KickPlayerCommand = z.object({
  holderKind: SeatHolderKindDto,
  holderId: z.string().min(1),
  reason: z.string().max(500).optional(),
});
export type KickPlayerCommand = z.infer<typeof KickPlayerCommand>;

export const UnkickPlayerCommand = z.object({
  holderKind: SeatHolderKindDto,
  holderId: z.string().min(1),
});
export type UnkickPlayerCommand = z.infer<typeof UnkickPlayerCommand>;

export const BanFingerprintCommand = z
  .object({
    playerId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    fingerprintHash: z.string().min(1).optional(),
    reason: z.string().max(500).default(""),
    /** 封禁时长（秒）；不传表示永久 */
    durationSeconds: z.number().int().min(60).optional(),
  })
  .refine((input) => Boolean(input.playerId || input.fingerprintHash), {
    message: "playerId or fingerprintHash is required",
    path: ["playerId"],
  });
export type BanFingerprintCommand = z.infer<typeof BanFingerprintCommand>;

export const UnbanFingerprintCommand = z.object({
  fingerprintHash: z.string().min(1),
});
export type UnbanFingerprintCommand = z.infer<typeof UnbanFingerprintCommand>;

// ---------- events & DTO ----------

export const OnlinePlayerDto = z.object({
  holderKind: SeatHolderKindDto,
  holderId: z.string(),
  displayName: z.string().nullable(),
  role: z.enum(["pc", "ob"]),
  characterId: z.string().nullable(),
  connectionCount: z.number().int().min(1),
});
export type OnlinePlayerDto = z.infer<typeof OnlinePlayerDto>;

export const KickedPlayerDto = z.object({
  holderKind: SeatHolderKindDto,
  holderId: z.string(),
  displayName: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.number().int(),
});
export type KickedPlayerDto = z.infer<typeof KickedPlayerDto>;

/** GM 专用 DirectControlMessage: presence:updated（在线列表与禁入名单全量，无 eventId） */
export const PresenceUpdatedMessage = z.object({
  online: z.array(OnlinePlayerDto),
  kickedPlayers: z.array(KickedPlayerDto),
});
export type PresenceUpdatedMessage = z.infer<typeof PresenceUpdatedMessage>;

export const SessionKickedMessage = z.object({
  code: z.literal("SESSION_KICKED"),
  reason: z.string().nullable(),
  createdAt: z.number().int(),
});
export type SessionKickedMessage = z.infer<typeof SessionKickedMessage>;
