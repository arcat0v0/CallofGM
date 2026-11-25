import {
	type PortraitLayout,
	type PortraitScale,
	type SnapshotCharacter,
	STAGE_MAX_ITEMS,
	type StageComposition,
	type StagePortraitItem,
} from "@cogm/shared";

const SLOTS: Record<PortraitLayout, Record<number, number[]>> = {
	auto: {
		1: [50],
		2: [28, 72],
		3: [24, 50, 76],
		4: [16, 38, 62, 84],
	},
	center: {
		1: [50],
		2: [36, 64],
		3: [30, 50, 70],
		4: [28, 44, 56, 72],
	},
	left: {
		1: [30],
		2: [28, 47],
		3: [24, 42, 60],
		4: [18, 34, 50, 66],
	},
	right: {
		1: [70],
		2: [53, 72],
		3: [40, 58, 76],
		4: [34, 50, 66, 82],
	},
	spread: {
		1: [50],
		2: [26, 74],
		3: [20, 50, 80],
		4: [14, 38, 62, 86],
	},
};

const WIDTHS: Record<PortraitLayout, Record<number, number>> = {
	auto: { 1: 48, 2: 36, 3: 30, 4: 23 },
	center: { 1: 48, 2: 28, 3: 27, 4: 21 },
	left: { 1: 44, 2: 26, 3: 23, 4: 19 },
	right: { 1: 44, 2: 26, 3: 23, 4: 19 },
	spread: { 1: 48, 2: 36, 3: 28, 4: 22 },
};

export const LEGACY_SCALE_FACTOR: Record<PortraitScale, number> = {
	md: 1,
	lg: 1.22,
};

export const STAGE_X_MIN = 0;
export const STAGE_X_MAX = 100;
export const STAGE_Y_MIN = -30;
export const STAGE_Y_MAX = 50;
export const STAGE_SCALE_MIN = 0.4;
export const STAGE_SCALE_MAX = 1.8;

export type StageQuickPresetId =
	| "auto"
	| "center"
	| "left"
	| "right"
	| "spread"
	| "duel"
	| "trio"
	| "clear";

export interface ResolvedPortraitPlacement {
	character: SnapshotCharacter;
	x: number;
	y: number;
	scale: number;
	flipX: boolean;
	zIndex: number;
}

export interface SnapGuide {
	axis: "x" | "y";
	value: number;
	kind: "center" | "third" | "baseline" | "peer";
}

export function clampStageX(value: number): number {
	return round1(Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, value)));
}

export function clampStageY(value: number): number {
	return round1(Math.max(STAGE_Y_MIN, Math.min(STAGE_Y_MAX, value)));
}

export function clampStageScale(value: number): number {
	return round2(Math.max(STAGE_SCALE_MIN, Math.min(STAGE_SCALE_MAX, value)));
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function portraitSlots(count: number, layout: PortraitLayout): number[] {
	if (count <= 0) {
		return [];
	}
	const fixed = SLOTS[layout][count];
	if (fixed) {
		return fixed;
	}
	return Array.from({ length: count }, (_, index) =>
		round1(10 + (80 * index) / (count - 1)),
	);
}

export function portraitSlotWidths(
	count: number,
	layout: PortraitLayout,
): number {
	if (count <= 0) {
		return 0;
	}
	return WIDTHS[layout][count] ?? Math.max(12, 86 / count);
}

export function defaultAutoCharacters(
	characters: SnapshotCharacter[],
): SnapshotCharacter[] {
	return characters
		.filter(
			(character) => character.kind === "pc" || character.currentExpressionKey,
		)
		.slice(0, 4);
}

export function buildAutoStageItems(
	characters: SnapshotCharacter[],
	layout: PortraitLayout,
	scale: PortraitScale,
): StagePortraitItem[] {
	const visible = defaultAutoCharacters(characters);
	const slots = portraitSlots(visible.length, layout);
	const scaleFactor = LEGACY_SCALE_FACTOR[scale];
	return visible.map((character, index) => ({
		characterId: character.characterId,
		x: slots[index] ?? 50,
		y: 0,
		scale: scaleFactor,
		flipX: false,
		zIndex: 10 + index,
	}));
}

export function resolveStagePlacements(
	characters: SnapshotCharacter[],
	composition: StageComposition | null | undefined,
	legacyLayout: PortraitLayout,
	legacyScale: PortraitScale,
	options?: { clampForCompact?: boolean },
): ResolvedPortraitPlacement[] {
	const byId = new Map(
		characters.map((character) => [character.characterId, character]),
	);
	const items =
		composition && composition.mode === "custom"
			? composition.items
			: buildAutoStageItems(characters, legacyLayout, legacyScale);

	const clampCompact = options?.clampForCompact ?? false;
	const resolved: ResolvedPortraitPlacement[] = [];
	for (const item of items) {
		const character = byId.get(item.characterId);
		if (!character) {
			continue;
		}
		const x = clampCompact
			? Math.max(12, Math.min(88, item.x))
			: clampStageX(item.x);
		const y = clampCompact
			? Math.max(-15, Math.min(25, item.y))
			: clampStageY(item.y);
		const scale = clampCompact
			? Math.max(0.5, Math.min(1.25, item.scale))
			: clampStageScale(item.scale);
		resolved.push({
			character,
			x,
			y,
			scale,
			flipX: Boolean(item.flipX),
			zIndex: item.zIndex,
		});
	}
	return resolved;
}

export function materializeComposition(
	characters: SnapshotCharacter[],
	composition: StageComposition | null | undefined,
	legacyLayout: PortraitLayout,
	legacyScale: PortraitScale,
): StageComposition {
	const activeIds = new Set(
		characters.map((character) => character.characterId),
	);
	if (composition && composition.mode === "custom") {
		return {
			mode: "custom",
			emphasizeSpeaker: composition.emphasizeSpeaker,
			items: composition.items
				.filter((item) => activeIds.has(item.characterId))
				.map((item) => ({
					characterId: item.characterId,
					x: clampStageX(item.x),
					y: clampStageY(item.y),
					scale: clampStageScale(item.scale),
					flipX: Boolean(item.flipX),
					zIndex: Math.max(0, Math.min(100, Math.round(item.zIndex))),
				})),
		};
	}
	return {
		mode: "custom",
		emphasizeSpeaker: composition?.emphasizeSpeaker ?? true,
		items: buildAutoStageItems(characters, legacyLayout, legacyScale),
	};
}

export function normalizeZIndices(
	items: StagePortraitItem[],
): StagePortraitItem[] {
	const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
	const rank = new Map<string, number>();
	sorted.forEach((item, index) => {
		rank.set(item.characterId, 10 + index * 2);
	});
	return items.map((item) => ({
		...item,
		zIndex: rank.get(item.characterId) ?? item.zIndex,
	}));
}

export function addCharacterToComposition(
	composition: StageComposition,
	characterId: string,
): StageComposition {
	if (
		composition.items.some((item) => item.characterId === characterId) ||
		composition.items.length >= STAGE_MAX_ITEMS
	) {
		return composition;
	}
	const usedX = composition.items.map((item) => item.x);
	const candidates = [50, 28, 72, 20, 80, 38, 62, 14, 86];
	let chosenX = 50;
	let bestDistance = -1;
	for (const candidate of candidates) {
		const minDist =
			usedX.length === 0
				? 100
				: Math.min(...usedX.map((existing) => Math.abs(existing - candidate)));
		if (minDist > bestDistance) {
			bestDistance = minDist;
			chosenX = candidate;
		}
	}
	const maxZ = composition.items.reduce(
		(acc, item) => Math.max(acc, item.zIndex),
		8,
	);
	return {
		...composition,
		mode: "custom",
		items: normalizeZIndices([
			...composition.items,
			{
				characterId,
				x: chosenX,
				y: 0,
				scale: 1,
				flipX: false,
				zIndex: Math.min(100, maxZ + 2),
			},
		]),
	};
}

export function removeCharacterFromComposition(
	composition: StageComposition,
	characterId: string,
): StageComposition {
	return {
		...composition,
		mode: "custom",
		items: normalizeZIndices(
			composition.items.filter((item) => item.characterId !== characterId),
		),
	};
}

export function reorderLayerInComposition(
	composition: StageComposition,
	characterId: string,
	action: "front" | "forward" | "backward" | "back",
): StageComposition {
	const sorted = [...composition.items].sort((a, b) => a.zIndex - b.zIndex);
	const index = sorted.findIndex((item) => item.characterId === characterId);
	if (index < 0) {
		return composition;
	}
	const [target] = sorted.splice(index, 1);
	if (!target) {
		return composition;
	}
	if (action === "front") {
		sorted.push(target);
	} else if (action === "back") {
		sorted.unshift(target);
	} else if (action === "forward") {
		sorted.splice(Math.min(sorted.length, index + 1), 0, target);
	} else {
		sorted.splice(Math.max(0, index - 1), 0, target);
	}
	const zById = new Map<string, number>();
	sorted.forEach((item, idx) => {
		zById.set(item.characterId, 10 + idx * 2);
	});
	return {
		...composition,
		mode: "custom",
		items: composition.items.map((item) => ({
			...item,
			zIndex: zById.get(item.characterId) ?? item.zIndex,
		})),
	};
}

export function applyQuickPreset(
	presetId: StageQuickPresetId,
	current: StageComposition,
	allCharacters: SnapshotCharacter[],
): StageComposition {
	if (presetId === "clear") {
		return {
			mode: "custom",
			emphasizeSpeaker: current.emphasizeSpeaker,
			items: [],
		};
	}

	const baseIds =
		current.items.length > 0
			? [...current.items]
					.sort((a, b) => a.x - b.x)
					.map((item) => item.characterId)
			: defaultAutoCharacters(allCharacters).map(
					(character) => character.characterId,
				);

	if (baseIds.length === 0) {
		return {
			mode: "custom",
			emphasizeSpeaker: current.emphasizeSpeaker,
			items: [],
		};
	}

	const existingById = new Map(
		current.items.map((item) => [item.characterId, item]),
	);

	if (presetId === "duel") {
		const count = baseIds.length;
		const leftCount = Math.ceil(count / 2);
		const rightCount = count - leftCount;
		const items: StagePortraitItem[] = baseIds.map((characterId, index) => {
			if (count === 1) {
				return {
					characterId,
					x: 50,
					y: 0,
					scale: 1,
					flipX: false,
					zIndex: 10,
				};
			}
			const isLeft = index < leftCount;
			if (isLeft) {
				const step = leftCount === 1 ? 0 : 18 / (leftCount - 1);
				const x = leftCount === 1 ? 24 : round1(14 + index * step);
				return {
					characterId,
					x,
					y: 0,
					scale: 1,
					flipX: false,
					zIndex: 10 + index * 2,
				};
			}
			const rightIndex = index - leftCount;
			const step = rightCount === 1 ? 0 : 18 / (rightCount - 1);
			const x = rightCount === 1 ? 76 : round1(68 + rightIndex * step);
			return {
				characterId,
				x,
				y: 0,
				scale: 1,
				flipX: true,
				zIndex: 10 + index * 2,
			};
		});
		return {
			mode: "custom",
			emphasizeSpeaker: current.emphasizeSpeaker,
			items,
		};
	}

	if (presetId === "trio") {
		const count = baseIds.length;
		const slots = portraitSlots(count, "spread");
		const mid = Math.floor(count / 2);
		const items: StagePortraitItem[] = baseIds.map((characterId, index) => {
			const isFocus = index === mid;
			return {
				characterId,
				x: slots[index] ?? 50,
				y: 0,
				scale: isFocus ? 1.08 : 0.92,
				flipX: existingById.get(characterId)?.flipX ?? false,
				zIndex: isFocus ? 20 + count * 2 : 10 + index * 2,
			};
		});
		return {
			mode: "custom",
			emphasizeSpeaker: current.emphasizeSpeaker,
			items: normalizeZIndices(items),
		};
	}

	const slots = portraitSlots(baseIds.length, presetId);
	const items: StagePortraitItem[] = baseIds.map((characterId, index) => ({
		characterId,
		x: slots[index] ?? 50,
		y: 0,
		scale: 1,
		flipX: existingById.get(characterId)?.flipX ?? false,
		zIndex: 10 + index * 2,
	}));
	return {
		mode: "custom",
		emphasizeSpeaker: current.emphasizeSpeaker,
		items,
	};
}

export function computeSnapGuides(
	movingId: string,
	rawX: number,
	rawY: number,
	items: StagePortraitItem[],
	threshold = 1.8,
): { x: number; y: number; guides: SnapGuide[] } {
	let x = clampStageX(rawX);
	let y = clampStageY(rawY);
	const guides: SnapGuide[] = [];

	const xTargets: Array<{ value: number; kind: SnapGuide["kind"] }> = [
		{ value: 50, kind: "center" },
		{ value: 33.3, kind: "third" },
		{ value: 66.7, kind: "third" },
	];
	const yTargets: Array<{ value: number; kind: SnapGuide["kind"] }> = [
		{ value: 0, kind: "baseline" },
	];

	for (const peer of items) {
		if (peer.characterId === movingId) continue;
		xTargets.push({ value: peer.x, kind: "peer" });
		const mirrorX = round1(100 - peer.x);
		if (Math.abs(mirrorX - 50) > 1) {
			xTargets.push({ value: mirrorX, kind: "peer" });
		}
		yTargets.push({ value: peer.y, kind: "peer" });
	}

	let bestX: { value: number; kind: SnapGuide["kind"]; dist: number } | null =
		null;
	for (const target of xTargets) {
		const dist = Math.abs(x - target.value);
		if (dist <= threshold && (!bestX || dist < bestX.dist)) {
			bestX = { ...target, dist };
		}
	}
	if (bestX) {
		x = clampStageX(bestX.value);
		guides.push({ axis: "x", value: x, kind: bestX.kind });
	}

	let bestY: { value: number; kind: SnapGuide["kind"]; dist: number } | null =
		null;
	for (const target of yTargets) {
		const dist = Math.abs(y - target.value);
		if (dist <= threshold && (!bestY || dist < bestY.dist)) {
			bestY = { ...target, dist };
		}
	}
	if (bestY) {
		y = clampStageY(bestY.value);
		guides.push({ axis: "y", value: y, kind: bestY.kind });
	}

	return { x, y, guides };
}

export function stageCompositionsEqual(
	a: StageComposition | null | undefined,
	b: StageComposition | null | undefined,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	if (
		a.mode !== b.mode ||
		a.emphasizeSpeaker !== b.emphasizeSpeaker ||
		a.items.length !== b.items.length
	) {
		return false;
	}
	const sortedA = [...a.items].sort((l, r) =>
		l.characterId.localeCompare(r.characterId),
	);
	const sortedB = [...b.items].sort((l, r) =>
		l.characterId.localeCompare(r.characterId),
	);
	for (let index = 0; index < sortedA.length; index += 1) {
		const left = sortedA[index];
		const right = sortedB[index];
		if (!left || !right) {
			return false;
		}
		if (
			left.characterId !== right.characterId ||
			Math.abs(left.x - right.x) > 0.05 ||
			Math.abs(left.y - right.y) > 0.05 ||
			Math.abs(left.scale - right.scale) > 0.005 ||
			Boolean(left.flipX) !== Boolean(right.flipX) ||
			left.zIndex !== right.zIndex
		) {
			return false;
		}
	}
	return true;
}
