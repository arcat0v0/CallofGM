import { z } from "zod";

export const GmLoginRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type GmLoginRequest = z.infer<typeof GmLoginRequest>;

export const PlayerIdentityResponse = z.object({
  playerId: z.string(),
  token: z.string().optional(),
});
export type PlayerIdentityResponse = z.infer<typeof PlayerIdentityResponse>;

export const PlayerMeResponse = z.object({
  playerId: z.string(),
});
export type PlayerMeResponse = z.infer<typeof PlayerMeResponse>;

export const GmMeResponse = z.object({
  type: z.literal("gm"),
});
export type GmMeResponse = z.infer<typeof GmMeResponse>;

export const BanPlayerRequest = z
  .object({
    playerId: z.string().min(1).optional(),
    fingerprintHash: z.string().min(1).optional(),
    reason: z.string().max(500).default(""),
    durationSeconds: z.number().int().min(60).optional(),
  })
  .refine((input) => Boolean(input.playerId || input.fingerprintHash), {
    message: "playerId or fingerprintHash is required",
    path: ["playerId"],
  });
export type BanPlayerRequest = z.infer<typeof BanPlayerRequest>;

export const UnbanFingerprintRequest = z.object({
  fingerprintHash: z.string().min(1),
});
export type UnbanFingerprintRequest = z.infer<typeof UnbanFingerprintRequest>;

export const BlacklistEntryDto = z.object({
  id: z.string(),
  fingerprintHash: z.string(),
  playerId: z.string().nullable(),
  displayName: z.string().nullable(),
  reason: z.string(),
  expiresAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type BlacklistEntryDto = z.infer<typeof BlacklistEntryDto>;
