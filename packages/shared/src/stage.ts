import { z } from "zod";
import { TrackSource } from "./music";

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

export const PortraitLayout = z.enum([
	"auto",
	"center",
	"left",
	"right",
	"spread",
]);
export type PortraitLayout = z.infer<typeof PortraitLayout>;

export const PortraitScale = z.enum(["md", "lg"]);
export type PortraitScale = z.infer<typeof PortraitScale>;

export const STAGE_MAX_ITEMS = 12;
export const STAGE_MAX_PRESETS = 16;

export const StagePortraitItem = z.object({
	characterId: z.string().min(1),
	/** Horizontal center anchor as percentage of stage safe-area width (0..100). */
	x: z.number().min(0).max(100),
	/** Vertical offset from stage floor baseline as percentage of stage height (-30..50). */
	y: z.number().min(-30).max(50),
	/** Scale multiplier relative to standard base portrait height (0.4..1.8). */
	scale: z.number().min(0.4).max(1.8),
	/** Horizontal mirror flip. */
	flipX: z.boolean().default(false),
	/** Explicit stacking layer order (higher renders in front). */
	zIndex: z.number().int().min(0).max(100),
});
export type StagePortraitItem = z.infer<typeof StagePortraitItem>;

export const StageCompositionMode = z.enum(["auto", "custom"]);
export type StageCompositionMode = z.infer<typeof StageCompositionMode>;

export const StageComposition = z
	.object({
		mode: StageCompositionMode,
		emphasizeSpeaker: z.boolean().default(true),
		items: z.array(StagePortraitItem).max(STAGE_MAX_ITEMS),
	})
	.superRefine((val, ctx) => {
		const seen = new Set<string>();
		for (let index = 0; index < val.items.length; index += 1) {
			const item = val.items[index];
			if (!item) continue;
			const id = item.characterId;
			if (seen.has(id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["items", index, "characterId"],
					message: "Duplicate characterId in stage composition",
				});
			}
			seen.add(id);
		}
	});
export type StageComposition = z.infer<typeof StageComposition>;

export const StagePresetDto = z.object({
	id: z.string().min(1).max(64),
	name: z.string().trim().min(1).max(40),
	composition: StageComposition,
	updatedAt: z.number().int().nonnegative(),
});
export type StagePresetDto = z.infer<typeof StagePresetDto>;

export const SaveStagePresetRequest = z.object({
	id: z.string().min(1).max(64).optional(),
	name: z.string().trim().min(1).max(40),
	composition: StageComposition,
});
export type SaveStagePresetRequest = z.infer<typeof SaveStagePresetRequest>;

export const StagePresetsResponse = z.object({
	presets: z.array(StagePresetDto),
});
export type StagePresetsResponse = z.infer<typeof StagePresetsResponse>;

const StageExpressionChanges = z
	.array(SetExpressionCommand)
	.max(STAGE_MAX_ITEMS)
	.refine(
		(changes) =>
			new Set(changes.map(({ characterId }) => characterId)).size ===
			changes.length,
		{ message: "Duplicate characterId in stage expression changes" },
	);

export const UpdateStageLayoutCommand = z
	.object({
		layout: PortraitLayout.optional(),
		scale: PortraitScale.optional(),
		composition: StageComposition.optional(),
		expressions: StageExpressionChanges.optional(),
	})
	.refine(
		(val) =>
			val.composition !== undefined ||
			(val.layout !== undefined && val.scale !== undefined),
		{
			message: "Either composition or layout and scale must be provided",
		},
	);
export type UpdateStageLayoutCommand = z.infer<typeof UpdateStageLayoutCommand>;

export const BgmPlaybackMode = z.enum(["off", "single", "list", "shuffle"]);
export type BgmPlaybackMode = z.infer<typeof BgmPlaybackMode>;

export const UpdateBgmCommand = z.object({
	action: z.enum([
		"play",
		"pause",
		"seek",
		"volume",
		"mode",
		"ended",
		"next",
		"previous",
	]),
	trackId: z.string().min(1).optional(),
	seekOffsetMs: z.number().int().min(0).optional(),
	volume: z.number().int().min(0).max(100).optional(),
	mode: BgmPlaybackMode.optional(),
	restart: z.boolean().optional(),
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
	messageId: z.string().optional(),
});
export type ExpressionChangedEvent = z.infer<typeof ExpressionChangedEvent>;

/** Event payload: stage:layout-changed（全团同步的立绘布局） */
export const StageLayoutChangedEvent = z.object({
	layout: PortraitLayout,
	scale: PortraitScale,
	composition: StageComposition.nullable().optional(),
	expressions: StageExpressionChanges.optional(),
});
export type StageLayoutChangedEvent = z.infer<typeof StageLayoutChangedEvent>;

export const BgmState = z.object({
	trackId: z.string().nullable(),
	playing: z.boolean(),
	volume: z.number().int().min(0).max(100),
	mode: BgmPlaybackMode,
	audioMimeType: z.string().optional(),
	seekOffsetMs: z.number().int().min(0),
	startedAtMs: z.number().int(),
	version: z.number().int().min(0),
	/** 曲目时长，供循环取模；未知时为 0 */
	durationMs: z.number().int().min(0).optional(),
	name: z.string().optional(),
	source: TrackSource.optional(),
	playbackUrl: z
		.string()
		.regex(/^\/api\/v1\//)
		.optional(),
	audioAssetId: z.string().nullable().optional(),
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
	audioMimeType: z.string().optional(),
	audioAssetId: z.string().nullable().optional(),
	source: TrackSource.optional(),
	playbackUrl: z
		.string()
		.regex(/^\/api\/v1\//)
		.optional(),
	name: z.string().optional(),
});
export type SePlayedEvent = z.infer<typeof SePlayedEvent>;
