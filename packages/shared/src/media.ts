import { z } from "zod";

export const MAX_MEDIA_UPLOAD_MB = 100;
export const MAX_MEDIA_UPLOAD_BYTES = MAX_MEDIA_UPLOAD_MB * 1024 * 1024;

export const MediaPurpose = z.enum([
	"general",
	"portrait",
	"scene",
	"audio",
	"handout",
]);
export type MediaPurpose = z.infer<typeof MediaPurpose>;

export const UploadMediaQuery = z.object({
	purpose: MediaPurpose.default("general"),
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuery>;

export const MediaStorageProvider = z.enum(["local", "s3"]);
export type MediaStorageProvider = z.infer<typeof MediaStorageProvider>;

export const MediaAssetDto = z.object({
	id: z.string(),
	purpose: MediaPurpose,
	storageProvider: MediaStorageProvider.default("local"),
	storageKey: z.string(),
	filename: z.string(),
	mimeType: z.string(),
	size: z.number().int(),
	sha256: z.string(),
	metadataJson: z.string(),
	createdAt: z.number().int(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDto>;

export const PresignMediaUploadRequest = z.object({
	filename: z.string().trim().min(1).max(255),
	size: z.number().int().positive(),
	contentType: z.string().trim().min(1).max(200).default("application/octet-stream"),
	purpose: MediaPurpose.default("general"),
});
export type PresignMediaUploadRequest = z.infer<
	typeof PresignMediaUploadRequest
>;

export const PresignMediaUploadResponse = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("local"),
		maxUploadBytes: z.number().int().positive(),
	}),
	z.object({
		mode: z.literal("direct"),
		maxUploadBytes: z.number().int().positive(),
		uploadToken: z.string().min(1),
		uploadUrl: z.string().url(),
		method: z.literal("PUT"),
		headers: z.record(z.string(), z.string()),
		expiresAt: z.number().int(),
	}),
]);
export type PresignMediaUploadResponse = z.infer<
	typeof PresignMediaUploadResponse
>;

export const CompleteMediaUploadRequest = z.object({
	uploadToken: z.string().min(1).max(128),
	sha256: z
		.string()
		.regex(/^[0-9a-f]{64}$/i)
		.optional(),
});
export type CompleteMediaUploadRequest = z.infer<
	typeof CompleteMediaUploadRequest
>;
