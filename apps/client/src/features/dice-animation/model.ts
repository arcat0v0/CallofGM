export type DiceRollAnimation = {
	kind: "roll";
	faces: number;
	total: number;
	rolls: number[];
};

export type CheckAnimation = {
	kind: "check";
	roll: number;
	outcome: string;
};

export type DiceAnimationRequest = (DiceRollAnimation | CheckAnimation) & {
	id: string;
	label: string;
	hidden?: boolean;
	skin?: DiceSkin;
};

export type DiceSkin = "olive" | "bone";

export type DiceAnimationDie = {
	asset: string;
	value: string;
	orientationHint?: string;
};

export const DICE_TUMBLE_MS = 750;
export const DICE_SETTLE_MS = 450;
export const DICE_HOLD_MS = 1400;
export const DICE_ANIMATION_DURATION_MS =
	DICE_TUMBLE_MS + DICE_SETTLE_MS + DICE_HOLD_MS;
export const DICE_REDUCED_MOTION_DURATION_MS = 1400;
export const DICE_CAMERA_FOV_DEG = 35;
export const DICE_CAMERA_DISTANCE = 5.5;

export type DiceGridLayout = {
	cols: number;
	rows: number;
	dieWorldSize: number;
	usableWidth: number;
	usableHeight: number;
	positions: Array<{ x: number; y: number }>;
};

export const DICE_MODEL_NAMES = [
	"d4",
	"d6",
	"d8",
	"d10",
	"d100-tens",
	"d12",
	"d20",
] as const;

export function diceAsset(skin: DiceSkin, name: string): string {
	return `/dice/${skin}/${name}.gltf`;
}

export const PRELOAD_DICE_ASSETS = (["olive", "bone"] as const).flatMap((skin) =>
	DICE_MODEL_NAMES.map((name) => diceAsset(skin, name)),
);

export const PRELOAD_ORIENTATION_ASSETS = [
	"/dice/orientations/d4.json",
	"/dice/orientations/d6.json",
	"/dice/orientations/d8.json",
	"/dice/orientations/d10.json",
	"/dice/orientations/d100-tens.json",
	"/dice/orientations/d12.json",
	"/dice/orientations/d20.json",
] as const;

export function isPercentageDice(faces: number): boolean {
	return faces === 100;
}

export function normalizeRollValue(faces: number, value: number): number {
	if (!isPercentageDice(faces)) return value;
	const roll = value === 100 ? 0 : value;
	return roll % 10;
}

export function d100Digits(total: number): readonly [number, number] {
	const normalized = ((((total - 1) % 100) + 100) % 100) + 1;
	const ones = normalized % 10;
	const tens = Math.floor(normalized / 10);
	return [tens === 0 && ones === 0 ? 10 : tens, ones];
}

function percentileTensValue(tens: number, ones: number): string {
	return tens === 0 || (tens === 10 && ones === 0) ? "00" : String(tens * 10);
}

function orientationAsset(name: string): string {
	return `/dice/orientations/${name}.json`;
}

export function buildDiceAnimationDice(
	request: DiceAnimationRequest,
): DiceAnimationDie[] {
	const assetFor = (name: string) => diceAsset(request.skin ?? "olive", name);
	if (request.kind === "check") {
		const [tens, ones] = d100Digits(request.roll);
		return [
			{
				asset: assetFor("d100-tens"),
				value: percentileTensValue(tens, ones),
				orientationHint: orientationAsset("d100-tens"),
			},
			{
				asset: assetFor("d10"),
				value: String(ones),
				orientationHint: orientationAsset("d10"),
			},
		];
	}

	if (isPercentageDice(request.faces)) {
		return request.rolls.flatMap((roll) => {
			const [tens, ones] = d100Digits(roll);
			return [
				{
					asset: assetFor("d100-tens"),
					value: percentileTensValue(tens, ones),
					orientationHint: orientationAsset("d100-tens"),
				},
				{
					asset: assetFor("d10"),
					value: String(ones),
					orientationHint: orientationAsset("d10"),
				},
			];
		});
	}

	const assetByFaces: Record<number, string> = {
		4: assetFor("d4"),
		6: assetFor("d6"),
		8: assetFor("d8"),
		10: assetFor("d10"),
		12: assetFor("d12"),
		20: assetFor("d20"),
	};
	const asset = assetByFaces[request.faces];
	if (!asset) return [];

	const orientationNameByFaces: Record<number, string> = {
		4: "d4",
		6: "d6",
		8: "d8",
		10: "d10",
		12: "d12",
		20: "d20",
	};
	const orientationName = orientationNameByFaces[request.faces];
	return request.rolls.map((roll) => ({
		asset,
		value: String(normalizeRollValue(request.faces, roll)),
		...(orientationName
			? { orientationHint: orientationAsset(orientationName) }
			: {}),
	}));
}

export function parseDiceFaces(expression: string): number | null {
	const match = /^\s*(?:\d+)?[dD](\d+)(?:[+-]\d+)?\s*$/.exec(expression);
	return match ? Number(match[1]) : null;
}

export function computeDiceGridLayout(
	count: number,
	width: number,
	height: number,
	fovDeg: number = DICE_CAMERA_FOV_DEG,
	cameraDistance: number = DICE_CAMERA_DISTANCE,
): DiceGridLayout {
	const safeWidth = Math.max(width, 1);
	const safeHeight = Math.max(height, 1);
	const aspect = safeWidth / safeHeight;
	const visibleHeight =
		2 * cameraDistance * Math.tan((fovDeg * Math.PI) / 180 / 2);
	const visibleWidth = visibleHeight * aspect;
	const usableWidth = visibleWidth * 0.8;
	const usableHeight = visibleHeight * 0.78;

	if (count <= 0) {
		return {
			cols: 0,
			rows: 0,
			dieWorldSize: 0,
			usableWidth,
			usableHeight,
			positions: [],
		};
	}

	if (count === 1) {
		return {
			cols: 1,
			rows: 1,
			dieWorldSize: Math.min(Math.min(usableWidth, usableHeight) * 0.62, 1.85),
			usableWidth,
			usableHeight,
			positions: [{ x: 0, y: 0 }],
		};
	}

	let bestCols = 1;
	let bestRows = count;
	let bestCell = -1;
	let bestFill = -1;

	for (let cols = 1; cols <= count; cols += 1) {
		const rows = Math.ceil(count / cols);
		const cell = Math.min(usableWidth / cols, usableHeight / rows);
		const fill = count / (cols * rows);
		if (
			cell > bestCell + 1e-6 ||
			(Math.abs(cell - bestCell) <= 1e-6 && fill > bestFill + 1e-6)
		) {
			bestCols = cols;
			bestRows = rows;
			bestCell = cell;
			bestFill = fill;
		}
	}

	const gapFactor = 1.34;
	const dieWorldSize = Math.min(bestCell / gapFactor, 1.65);
	const spacing = dieWorldSize * gapFactor;
	const positions: Array<{ x: number; y: number }> = [];

	for (let index = 0; index < count; index += 1) {
		const row = Math.floor(index / bestCols);
		const col = index % bestCols;
		const itemsInRow = row === bestRows - 1 ? count - row * bestCols : bestCols;
		const x = (col - (itemsInRow - 1) / 2) * spacing;
		const y = ((bestRows - 1) / 2 - row) * spacing;
		positions.push({ x, y });
	}

	return {
		cols: bestCols,
		rows: bestRows,
		dieWorldSize,
		usableWidth,
		usableHeight,
		positions,
	};
}
