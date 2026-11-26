import {
	type BgmState,
	PlaySeCommand,
	PortraitLayout,
	PortraitScale,
	SetExpressionCommand,
	SwitchSceneCommand,
	UpdateBgmCommand,
	UpdateNpcStateVisibilityCommand,
	UpdateSessionSettingsCommand,
	UpdateStageLayoutCommand,
} from "@cogm/shared";
import { ExpressionNotFoundError } from "@/modules/chat";
import { ForbiddenError } from "@/modules/identity";
import type {
	CommandHandler,
	CommandHandlerContext,
	CommandHandlerResult,
} from "@/modules/realtime";
import { CharacterNotNpcError } from "@/modules/sessions/domain/errors";
import { AppError } from "@/platform/errors/app-error";
import type { RuleRegistry } from "@/rules/registry";
import { BgmPlayback } from "../domain/bgm-playback";
import type { StageCommandRepositoryFactory } from "./stage-command-repository";

class SceneNotFoundError extends AppError {
	constructor(message = "Scene not found in this module") {
		super("SCENE_NOT_FOUND", message, 404);
	}
}

class TrackNotFoundError extends AppError {
	constructor(message = "Track not found in this module") {
		super("TRACK_NOT_FOUND", message, 404);
	}
}

class AudioVersionConflictError extends AppError {
	constructor(message = "Stale audio state version") {
		super("AUDIO_VERSION_CONFLICT", message, 409);
	}
}

class CharacterNotInSessionError extends AppError {
	constructor(message = "Character is not participating in this session") {
		super("CHARACTER_NOT_IN_SESSION", message, 404);
	}
}

/** scene:switch — 切换当前场景（仅允许本模组场景） */
export class SwitchSceneHandler implements CommandHandler {
	readonly type = "scene:switch" as const;
	readonly allowedStatuses = ["preparing", "active"] as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can switch scenes");
		}
		const parsed = SwitchSceneCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const sceneId = parsed.data.sceneId;

		const repo = this.repoFactory(ctx.tx);
		const scene = await repo.findScene(sceneId);
		if (!scene || scene.moduleId !== ctx.session.moduleId) {
			throw new SceneNotFoundError();
		}

		await repo.updateCurrentScene(ctx.sessionId, sceneId);

		return {
			events: [
				{
					type: "scene:changed",
					payload: {
						sceneId: scene.id,
						name: scene.name,
						bgAssetId: scene.bgAssetId ?? null,
					},
					visibility: { type: "public" },
				},
			],
			replyPayload: { sceneId },
		};
	}
}

/** expression:set — GM 切换任意团内人物的当前表情立绘 */
export class SetExpressionHandler implements CommandHandler {
	readonly type = "expression:set" as const;
	readonly allowedStatuses = ["preparing", "active"] as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can set expressions directly");
		}
		const parsed = SetExpressionCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const { characterId, expressionKey } = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		if (!(await repo.hasSessionCharacter(ctx.sessionId, characterId))) {
			throw new CharacterNotInSessionError();
		}

		if (!(await repo.hasActiveExpression(characterId, expressionKey))) {
			throw new ExpressionNotFoundError();
		}

		await repo.updateExpression(ctx.sessionId, characterId, expressionKey);

		return {
			events: [
				{
					type: "expression:changed",
					payload: { characterId, expressionKey },
					visibility: { type: "public" },
				},
			],
			replyPayload: { characterId, expressionKey },
		};
	}
}

/** stage:layout — GM 调整全团同步的立绘布局、大小与自由摆台编排 */
export class UpdateStageLayoutHandler implements CommandHandler {
	readonly type = "stage:layout" as const;
	readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can change the stage layout");
		}
		const parsed = UpdateStageLayoutCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}

		const repo = this.repoFactory(ctx.tx);
		const composition = parsed.data.composition ?? null;
		const expressions = parsed.data.expressions ?? [];
		if (composition && composition.items.length > 0) {
			const activeIds = new Set(
				await repo.listActiveSessionCharacterIds(ctx.sessionId),
			);
			for (const item of composition.items) {
				if (!activeIds.has(item.characterId)) {
					throw new CharacterNotInSessionError();
				}
			}
		}
		const stagedIds = new Set(
			composition?.items.map((item) => item.characterId),
		);
		for (const { characterId, expressionKey } of expressions) {
			if (!stagedIds.has(characterId)) {
				throw new AppError(
					"VALIDATION_FAILED",
					"Expression changes require a staged character",
					400,
				);
			}
			if (!(await repo.hasActiveExpression(characterId, expressionKey))) {
				throw new ExpressionNotFoundError();
			}
		}

		const currentLayout = PortraitLayout.safeParse(ctx.session.portraitLayout);
		const currentScale = PortraitScale.safeParse(ctx.session.portraitScale);
		const layout =
			parsed.data.layout ??
			(currentLayout.success ? currentLayout.data : "auto");
		const scale =
			parsed.data.scale ?? (currentScale.success ? currentScale.data : "md");
		const stageCompositionJson = composition
			? JSON.stringify(composition)
			: null;

		await repo.updateStageLayout(ctx.sessionId, {
			layout,
			scale,
			stageCompositionJson,
		});
		for (const { characterId, expressionKey } of expressions) {
			await repo.updateExpression(ctx.sessionId, characterId, expressionKey);
		}

		const eventPayload = {
			layout,
			scale,
			composition,
			...(expressions.length > 0 ? { expressions } : {}),
		};

		return {
			events: [
				{
					type: "stage:layout-changed",
					payload: eventPayload,
					visibility: { type: "public" },
				},
				...expressions.map((expression) => ({
					type: "expression:changed",
					payload: expression,
					visibility: { type: "public" as const },
				})),
			],
			replyPayload: eventPayload,
		};
	}
}

/**
 * audio:bgm — 权威 BGM 控制（播放/暂停/seek/音量/循环）。
 * 所有指令携带 expectedVersion 做乐观并发控制，陈旧指令不得覆盖新状态。
 */
export class UpdateBgmHandler implements CommandHandler {
	readonly type = "audio:bgm" as const;
	readonly allowedStatuses = ["preparing", "active"] as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can control BGM");
		}
		const parsed = UpdateBgmCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		const current = await repo.loadAudioState(ctx.sessionId);
		const currentVersion = current?.version ?? 0;
		if (input.expectedVersion !== currentVersion) {
			throw new AudioVersionConflictError();
		}

		const now = ctx.clock.nowEpochMs();
		const base: BgmState = current ?? {
			trackId: null,
			playing: false,
			volume: 100,
			mode: "single",
			seekOffsetMs: 0,
			startedAtMs: now,
			version: 0,
		};

		const playback = new BgmPlayback(base, now);
		switch (input.action) {
			case "play": {
				if (!input.trackId) {
					throw new AppError(
						"VALIDATION_FAILED",
						"trackId is required for play",
						400,
					);
				}
				const track = await repo.findTrack(input.trackId);
				if (
					!track ||
					track.moduleId !== ctx.session.moduleId ||
					track.type !== "bgm" ||
					(track.deletedAt !== null && track.id !== playback.trackId)
				) {
					throw new TrackNotFoundError("BGM track not found in this module");
				}
				playback.play(track, input.restart, input.seekOffsetMs);
				break;
			}
			case "pause": {
				if (!playback.playing) {
					break;
				}
				playback.pause();
				break;
			}
			case "seek": {
				if (input.seekOffsetMs === undefined) {
					throw new AppError(
						"VALIDATION_FAILED",
						"seekOffsetMs is required for seek",
						400,
					);
				}
				playback.seek(input.seekOffsetMs);
				break;
			}
			case "volume": {
				if (input.volume === undefined) {
					throw new AppError(
						"VALIDATION_FAILED",
						"volume is required for volume",
						400,
					);
				}
				playback.setVolume(input.volume);
				break;
			}
			case "mode": {
				if (input.mode === undefined) {
					throw new AppError(
						"VALIDATION_FAILED",
						"mode is required for mode",
						400,
					);
				}
				playback.changeMode(input.mode);
				break;
			}
			case "ended":
			case "next":
			case "previous": {
				if (input.action === "ended") {
					if (!playback.isDue())
						throw new AppError(
							"VALIDATION_FAILED",
							"Track has not reached its end",
							400,
						);
					if (playback.mode === "off") {
						playback.finish();
						break;
					}
				}
				const candidates = await repo.listActiveBgmTracks(ctx.session.moduleId);
				playback.step(
					candidates,
					input.action === "previous" ? -1 : 1,
					ctx.randomSource,
				);
				break;
			}
		}
		playback.advanceVersion();
		const next = playback.toSnapshot();
		if (next.source === "upload" && next.audioAssetId) {
			next.audioMimeType = await repo.findAudioMimeType(next.audioAssetId);
		}

		await repo.saveAudioState(ctx.sessionId, next, now, () =>
			ctx.idGenerator.nextId(),
		);

		return {
			events: [
				{
					type: "audio:bgm",
					payload: { bgm: next, transitionMs: input.transitionMs },
					visibility: { type: "public" },
				},
			],
			replyPayload: { bgm: next, transitionMs: input.transitionMs },
		};
	}
}

export class PlaySeHandler implements CommandHandler {
	readonly type = "audio:se" as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can play sound effects");
		}
		const parsed = PlaySeCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		const track = await repo.findTrack(input.trackId);
		if (
			!track ||
			track.moduleId !== ctx.session.moduleId ||
			track.type !== "se"
		) {
			throw new TrackNotFoundError("SE track not found in this module");
		}
		const audioMimeType = track.audioAssetId
			? await repo.findAudioMimeType(track.audioAssetId)
			: undefined;

		return {
			directToSession: [
				{
					type: "audio:se",
					payload: {
						trackId: track.id,
						volume: input.volume ?? 100,
						audioAssetId: track.audioAssetId,
						audioMimeType,
						source: track.source as BgmState["source"],
						playbackUrl:
							track.source === "upload"
								? `/api/v1/media/${track.audioAssetId}`
								: `/api/v1/music/tracks/${track.id}/stream`,
						name: track.name,
					},
				},
			],
			replyPayload: { ok: true },
		};
	}
}

export class UpdateSessionSettingsHandler implements CommandHandler {
	readonly type = "session:settings" as const;
	readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

	constructor(private readonly repoFactory: StageCommandRepositoryFactory) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can change session settings");
		}
		const parsed = UpdateSessionSettingsCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const settings = parsed.data;

		await this.repoFactory(ctx.tx).updateSessionSettings(
			ctx.sessionId,
			settings,
		);

		return {
			events: [
				{
					type: "session:settings-changed",
					payload: settings,
					visibility: { type: "public" },
				},
			],
			replyPayload: settings,
		};
	}
}

export class UpdateNpcStateVisibilityHandler implements CommandHandler {
	readonly type = "npc:state-visibility" as const;
	readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: StageCommandRepositoryFactory,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can change NPC state visibility");
		}
		const parsed = UpdateNpcStateVisibilityCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		const sessionCharacter = await repo.findActiveSessionCharacter(
			ctx.sessionId,
			input.characterId,
		);
		if (!sessionCharacter) {
			throw new CharacterNotInSessionError();
		}
		if (sessionCharacter.kind !== "npc") {
			throw new CharacterNotNpcError();
		}

		const rule = this.ruleRegistry.get(ctx.session.ruleId);
		const stateParsed = rule.sessionStateSchema.safeParse(
			JSON.parse(sessionCharacter.stateJson),
		);
		if (!stateParsed.success) {
			throw new AppError("VALIDATION_FAILED", stateParsed.error.message, 400);
		}
		const fields = [...new Set(input.fields)];
		const publicState = rule.projectPublicSessionState(
			stateParsed.data,
			fields,
		);

		await repo.updateNpcStateVisibility(
			ctx.sessionId,
			input.characterId,
			fields,
		);

		return {
			events: [
				{
					type: "npc:state-visibility-changed",
					payload: {
						characterId: input.characterId,
						kind: "npc",
						state: rule.viewSessionState(stateParsed.data, { hidden: true }),
						publicState,
						publicStateFields: fields,
					},
					visibility: { type: "gmOnly" },
				},
				{
					type: "state:public-changed",
					payload: {
						characterId: input.characterId,
						kind: "npc",
						state: publicState,
					},
					visibility: { type: "playerOnly" },
				},
			],
			replyPayload: {
				characterId: input.characterId,
				publicStateFields: fields,
				publicState,
			},
		};
	}
}

export function createStageCommandHandlers(
	ruleRegistry: RuleRegistry,
	repoFactory: StageCommandRepositoryFactory,
): CommandHandler[] {
	return [
		new SwitchSceneHandler(repoFactory),
		new SetExpressionHandler(repoFactory),
		new UpdateStageLayoutHandler(repoFactory),
		new UpdateBgmHandler(repoFactory),
		new PlaySeHandler(repoFactory),
		new UpdateSessionSettingsHandler(repoFactory),
		new UpdateNpcStateVisibilityHandler(ruleRegistry, repoFactory),
	];
}
