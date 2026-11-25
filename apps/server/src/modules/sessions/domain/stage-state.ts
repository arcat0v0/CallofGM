import {
	STAGE_MAX_PRESETS,
	StageComposition,
	type StageComposition as StageCompositionType,
	StagePresetDto,
	type StagePresetDto as StagePresetDtoType,
} from "@cogm/shared";
import { z } from "zod";
import { AppError } from "@/platform/errors/app-error";

const StagePresetsSchema = z.array(StagePresetDto).max(STAGE_MAX_PRESETS);

export class StagePresetLimitReachedError extends AppError {
	constructor(
		message = `At most ${STAGE_MAX_PRESETS} stage presets are allowed`,
	) {
		super("STAGE_PRESET_LIMIT_REACHED", message, 400);
	}
}

export class StagePresetNotFoundError extends AppError {
	constructor(message = "Stage preset not found") {
		super("STAGE_PRESET_NOT_FOUND", message, 404);
	}
}

export function parseStageCompositionJson(
	raw: string | null | undefined,
	activeCharacterIds?: ReadonlySet<string>,
): StageCompositionType | null {
	if (!raw) {
		return null;
	}
	try {
		const parsed = StageComposition.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			return null;
		}
		if (!activeCharacterIds) {
			return parsed.data;
		}
		return {
			...parsed.data,
			items: parsed.data.items.filter((item) =>
				activeCharacterIds.has(item.characterId),
			),
		};
	} catch {
		return null;
	}
}

export function pruneCharacterFromStageCompositionJson(
	raw: string | null | undefined,
	removedCharacterId: string,
): string | null | undefined {
	if (!raw) {
		return undefined;
	}
	const parsed = parseStageCompositionJson(raw);
	if (!parsed) {
		return undefined;
	}
	const filtered = parsed.items.filter(
		(item) => item.characterId !== removedCharacterId,
	);
	if (filtered.length === parsed.items.length) {
		return undefined;
	}
	return JSON.stringify({
		...parsed,
		items: filtered,
	});
}

export function parseStagePresetsJson(
	raw: string | null | undefined,
): StagePresetDtoType[] {
	if (!raw) {
		return [];
	}
	try {
		const parsed = StagePresetsSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

export function upsertStagePreset(
	current: StagePresetDtoType[],
	input: {
		id?: string;
		name: string;
		composition: StageCompositionType;
	},
	now: number,
	nextId: () => string,
): StagePresetDtoType[] {
	const name = input.name.trim();
	if (input.id) {
		const index = current.findIndex((preset) => preset.id === input.id);
		if (index < 0) {
			throw new StagePresetNotFoundError();
		}
		return current.map((preset) =>
			preset.id === input.id
				? {
						...preset,
						name,
						composition: input.composition,
						updatedAt: now,
					}
				: preset,
		);
	}
	if (current.length >= STAGE_MAX_PRESETS) {
		throw new StagePresetLimitReachedError();
	}
	const created: StagePresetDtoType = {
		id: nextId(),
		name,
		composition: input.composition,
		updatedAt: now,
	};
	return [...current, created];
}

export function removeStagePreset(
	current: StagePresetDtoType[],
	presetId: string,
): StagePresetDtoType[] {
	const next = current.filter((preset) => preset.id !== presetId);
	if (next.length === current.length) {
		throw new StagePresetNotFoundError();
	}
	return next;
}
