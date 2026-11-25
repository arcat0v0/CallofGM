import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const DICE_SKINS = ["olive", "bone"] as const;
const DICE_SHAPES = [
	"d4",
	"d6",
	"d8",
	"d10",
	"d100-tens",
	"d12",
	"d20",
] as const;

export const DICE_ASSET_PATHS: readonly string[] = [
	...DICE_SKINS.flatMap((skin) =>
		DICE_SHAPES.map((shape) => `${skin}/${shape}.gltf`),
	),
	...DICE_SHAPES.map((shape) => `orientations/${shape}.json`),
	...DICE_SKINS.map((skin) => `previews/${skin}-d20.webp`),
];

const ALLOWED_DICE_ASSET_PATHS = new Set<string>(DICE_ASSET_PATHS);

export function isAllowedDiceAssetPath(relPath: string): boolean {
	return ALLOWED_DICE_ASSET_PATHS.has(relPath);
}

export function diceAssetContentType(relPath: string): string {
	const lower = relPath.toLowerCase();
	if (lower.endsWith(".gltf")) {
		return "model/gltf+json; charset=utf-8";
	}
	if (lower.endsWith(".json")) {
		return "application/json; charset=utf-8";
	}
	if (lower.endsWith(".webp")) {
		return "image/webp";
	}
	return "application/octet-stream";
}

export function resolveLocalDiceAssetsDir(): string | null {
	const publicDiceDir = resolve(
		import.meta.dir,
		"../../../../../client/public/dice",
	);
	if (existsSync(publicDiceDir)) {
		return publicDiceDir;
	}
	const distDiceDir = resolve(
		import.meta.dir,
		"../../../../../client/dist/dice",
	);
	if (existsSync(distDiceDir)) {
		return distDiceDir;
	}
	return null;
}

export interface LocalDiceAssetEntry {
	relPath: string;
	data: Uint8Array;
}

export async function readLocalDiceAssets(
	diceDir: string,
): Promise<{ entries: LocalDiceAssetEntry[]; digest: string }> {
	const entries: LocalDiceAssetEntry[] = [];
	const bundleHash = createHash("sha256");

	for (const relPath of DICE_ASSET_PATHS) {
		const fullPath = resolve(diceDir, relPath);
		const info = await stat(fullPath).catch(() => null);
		if (!info?.isFile()) {
			continue;
		}
		const data = new Uint8Array(await readFile(fullPath));
		const fileDigest = createHash("sha256").update(data).digest("hex");
		bundleHash.update(`${relPath}:${fileDigest}\n`);
		entries.push({ relPath, data });
	}

	return {
		entries,
		digest: `sha256:${bundleHash.digest("hex")}`,
	};
}
