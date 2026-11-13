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
};

export type DiceAnimationDie = {
	asset: string;
	value: string;
	orientationHint?: string;
};

export const DICE_ANIMATION_DURATION_MS = 1150;

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
	return tens === 10 && ones === 0 ? "00" : String(tens * 10);
}

function orientationAsset(name: string): string {
	return `/dice/orientations/${name}.json`;
}

function oliveAsset(name: string): string {
	return `/dice/olive/${name}.gltf`;
}

export function buildDiceAnimationDice(
	request: DiceAnimationRequest,
): DiceAnimationDie[] {
	if (request.kind === "check") {
		const [tens, ones] = d100Digits(request.roll);
		return [
			{
				asset: oliveAsset("d100-tens"),
				value: percentileTensValue(tens, ones),
				orientationHint: orientationAsset("d100-tens"),
			},
			{
				asset: oliveAsset("d10"),
				value: String(ones),
				orientationHint: orientationAsset("d10"),
			},
		];
	}

	if (isPercentageDice(request.faces)) {
		const [tens, ones] = d100Digits(request.total);
		return [
			{
				asset: oliveAsset("d100-tens"),
				value: percentileTensValue(tens, ones),
				orientationHint: orientationAsset("d100-tens"),
			},
			{
				asset: oliveAsset("d10"),
				value: String(ones),
				orientationHint: orientationAsset("d10"),
			},
		];
	}

	const assetByFaces: Record<number, string> = {
		4: "/dice/cc0-black-gold/D4.gltf",
		6: oliveAsset("d6"),
		8: "/dice/cc0-black-gold/D8.gltf",
		10: oliveAsset("d10"),
		12: "/dice/cc0-black-gold/D12.gltf",
		20: oliveAsset("d20"),
	};
	const asset = assetByFaces[request.faces];
	if (!asset) return [];

	const orientationNameByFaces: Record<number, string> = {
		6: "d6",
		10: "d10",
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
