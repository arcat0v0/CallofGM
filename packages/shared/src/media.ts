import { z } from "zod";

export const MediaPurpose = z.enum(["general", "portrait", "scene", "audio", "handout"]);
export type MediaPurpose = z.infer<typeof MediaPurpose>;

export const UploadMediaQuery = z.object({
  purpose: MediaPurpose.default("general"),
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuery>;

export const MediaAssetDto = z.object({
  id: z.string(),
  purpose: MediaPurpose,
  storageKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  sha256: z.string(),
  metadataJson: z.string(),
  createdAt: z.number().int(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDto>;