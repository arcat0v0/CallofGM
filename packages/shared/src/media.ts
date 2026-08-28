import { z } from "zod";

export const MediaAssetDto = z.object({
  id: z.string(),
  purpose: z.string(),
  storageKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  sha256: z.string(),
  metadataJson: z.string(),
  createdAt: z.number().int(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDto>;
