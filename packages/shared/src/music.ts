import { z } from "zod";

export const MusicProvider = z.enum(["netease", "qq"]);
export type MusicProvider = z.infer<typeof MusicProvider>;

export const TrackSource = z.enum(["upload", "netease", "qq"]);
export type TrackSource = z.infer<typeof TrackSource>;

export const MusicAvailability = z.enum([
	"unknown",
	"available",
	"unavailable",
]);
export type MusicAvailability = z.infer<typeof MusicAvailability>;

export const MusicTrackDto = z.object({
	provider: MusicProvider,
	externalId: z.string().min(1).max(64),
	name: z.string().min(1),
	artists: z.array(z.string().min(1)),
	album: z.string().nullable(),
	durationMs: z.number().int().min(0),
	sourceUrl: z.string().url(),
	availability: MusicAvailability,
});
export type MusicTrackDto = z.infer<typeof MusicTrackDto>;

export const MusicSearchQuery = z.object({
	provider: MusicProvider,
	query: z.string().trim().min(1).max(100),
	limit: z.number().int().min(1).max(20).default(10),
});
export type MusicSearchQuery = z.infer<typeof MusicSearchQuery>;

export const MusicSearchResponse = z.object({
	items: z.array(MusicTrackDto),
});
export type MusicSearchResponse = z.infer<typeof MusicSearchResponse>;

export const ResolveMusicTrackRequest = z.object({
	provider: MusicProvider,
	reference: z.string().trim().min(1).max(2048),
});
export type ResolveMusicTrackRequest = z.infer<typeof ResolveMusicTrackRequest>;
