import { z } from "zod";

export const GmLoginRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type GmLoginRequest = z.infer<typeof GmLoginRequest>;

export const PlayerIdentityResponse = z.object({
  playerId: z.string(),
  token: z.string(),
});
export type PlayerIdentityResponse = z.infer<typeof PlayerIdentityResponse>;
