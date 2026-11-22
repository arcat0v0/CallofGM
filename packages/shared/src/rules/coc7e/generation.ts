import { z } from "zod";
import { coc7eDamageBonusAndBuild } from "./derive";
import { type Coc7eAttributeKey, Coc7eAttributes } from "./sheet";

/**
 * CoC 7e 车卡属性生成方式（挂在人物提交链接上，由 GM 设定）。
 *
 * - destiny（天命 N）：服务端一次掷出 N 套完整属性（含幸运），玩家任选其一；每人每条链接只能掷一次。
 *   可另设 fallbackPoints：对天命结果不满意时，玩家可改用该点数购点（幸运随天命骰一并预掷）。
 * - pointBuy（购点 + 骰幸运）：玩家把总点数分配到八项属性（不含幸运），幸运由服务端掷一次 3d6×5。
 */
export const COC7E_DESTINY_MIN = 1;
export const COC7E_DESTINY_MAX = 10;
export const COC7E_DESTINY_DEFAULT = 5;
export const COC7E_POINT_BUY_MIN_TOTAL = 300;
export const COC7E_POINT_BUY_MAX_TOTAL = 600;
export const COC7E_POINT_BUY_DEFAULT_TOTAL = 460;
export const COC7E_POINT_BUY_ATTRIBUTE_MIN = 15;
export const COC7E_POINT_BUY_ATTRIBUTE_MAX = 90;

/** 购点分配的八项属性（不含幸运） */
export const COC7E_POINT_BUY_KEYS = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
] as const satisfies readonly Coc7eAttributeKey[];

export const Coc7eCreationOptions = z.discriminatedUnion("method", [
	z.object({
		method: z.literal("destiny"),
		count: z
			.number()
			.int()
			.min(COC7E_DESTINY_MIN)
			.max(COC7E_DESTINY_MAX)
			.default(COC7E_DESTINY_DEFAULT),
		/** 不满意天命时可改用的购点总数；null 表示不开放改购点 */
		fallbackPoints: z
			.number()
			.int()
			.min(COC7E_POINT_BUY_MIN_TOTAL)
			.max(COC7E_POINT_BUY_MAX_TOTAL)
			.nullable()
			.default(null),
	}),
	z.object({
		method: z.literal("pointBuy"),
		points: z
			.number()
			.int()
			.min(COC7E_POINT_BUY_MIN_TOTAL)
			.max(COC7E_POINT_BUY_MAX_TOTAL)
			.default(COC7E_POINT_BUY_DEFAULT_TOTAL),
	}),
]);
export type Coc7eCreationOptions = z.infer<typeof Coc7eCreationOptions>;

const LuckValue = z.number().int().min(15).max(90);

/** 一套天命属性；youngLuck 为 15–19 岁调查员“幸运掷两次取高”所需的第二次幸运骰 */
export const Coc7eDestinySet = z.object({
	attributes: Coc7eAttributes,
	youngLuck: LuckValue,
});
export type Coc7eDestinySet = z.infer<typeof Coc7eDestinySet>;

export const Coc7eCreationRollResult = z.discriminatedUnion("method", [
	z.object({
		method: z.literal("destiny"),
		sets: z.array(Coc7eDestinySet).min(1).max(COC7E_DESTINY_MAX),
		/** 改购点时使用的预掷幸运；null 表示未开放改购点 */
		fallback: z
			.object({ luck: LuckValue, youngLuck: LuckValue })
			.nullable()
			.default(null),
	}),
	z.object({
		method: z.literal("pointBuy"),
		luck: LuckValue,
		youngLuck: LuckValue,
	}),
]);
export type Coc7eCreationRollResult = z.infer<typeof Coc7eCreationRollResult>;

type NextInt = (sides: number) => number;

function d6(nextInt: NextInt): number {
	return nextInt(6);
}

function rollAttribute(key: Coc7eAttributeKey, nextInt: NextInt): number {
	if (key === "siz" || key === "int" || key === "edu") {
		return (d6(nextInt) + d6(nextInt) + 6) * 5;
	}
	return (d6(nextInt) + d6(nextInt) + d6(nextInt)) * 5;
}

/** 按车卡方式掷出结果；nextInt(sides) 必须返回 1..sides，由服务端注入安全随机源 */
export function rollCoc7eCreation(
	options: Coc7eCreationOptions,
	nextInt: NextInt,
): Coc7eCreationRollResult {
	if (options.method === "pointBuy") {
		return {
			method: "pointBuy",
			luck: rollAttribute("luck", nextInt),
			youngLuck: rollAttribute("luck", nextInt),
		};
	}
	const sets: Coc7eDestinySet[] = [];
	for (let index = 0; index < options.count; index += 1) {
		const attributes = {
			str: rollAttribute("str", nextInt),
			con: rollAttribute("con", nextInt),
			siz: rollAttribute("siz", nextInt),
			dex: rollAttribute("dex", nextInt),
			app: rollAttribute("app", nextInt),
			int: rollAttribute("int", nextInt),
			pow: rollAttribute("pow", nextInt),
			edu: rollAttribute("edu", nextInt),
			luck: rollAttribute("luck", nextInt),
		};
		sets.push({ attributes, youngLuck: rollAttribute("luck", nextInt) });
	}
	const fallback =
		options.fallbackPoints === null
			? null
			: {
					luck: rollAttribute("luck", nextInt),
					youngLuck: rollAttribute("luck", nextInt),
				};
	return { method: "destiny", sets, fallback };
}

/** 一次掷骰可选的候选项数量：天命各套 +（可选）改购点 */
export function coc7eCreationChoiceCount(
	result: Coc7eCreationRollResult,
): number {
	return result.method === "pointBuy"
		? 1
		: result.sets.length + (result.fallback === null ? 0 : 1);
}

/** 改购点候选项在 chosenIndex 中的位置；未开放改购点时为 null */
export function coc7eFallbackChoiceIndex(
	result: Coc7eCreationRollResult,
): number | null {
	return result.method === "destiny" && result.fallback !== null
		? result.sets.length
		: null;
}

/** 玩家当前选择是否为购点（原生购点或天命改购点） */
export function coc7eChosenPointBuy(
	result: Coc7eCreationRollResult,
	chosenIndex: number | null,
): boolean {
	if (result.method === "pointBuy") {
		return true;
	}
	return chosenIndex !== null && chosenIndex === coc7eFallbackChoiceIndex(result);
}

/** 一套属性的展示摘要：HP、伤害加值、不含/含幸运总和（与常见骰娘 `.coc` 输出一致） */
export function coc7eAttributeSetSummary(attributes: Coc7eAttributes): {
	hp: number;
	damageBonus: string;
	totalWithoutLuck: number;
	totalWithLuck: number;
} {
	const totalWithoutLuck = COC7E_POINT_BUY_KEYS.reduce(
		(sum, key) => sum + attributes[key],
		0,
	);
	return {
		hp: Math.floor((attributes.con + attributes.siz) / 10),
		damageBonus: coc7eDamageBonusAndBuild(attributes.str, attributes.siz)
			.damageBonus,
		totalWithoutLuck,
		totalWithLuck: totalWithoutLuck + attributes.luck,
	};
}

export function coc7ePointBuySpent(attributes: Coc7eAttributes): number {
	return COC7E_POINT_BUY_KEYS.reduce((sum, key) => sum + attributes[key], 0);
}

export type Coc7eCreationDifference = {
	key: Coc7eAttributeKey;
	expected: number;
	submitted: number;
};

/**
 * 审核比对：返回提交值与掷骰结果不一致的属性。
 * destiny 以选中的那套为准；pointBuy 只比对幸运（八项属性由购点自由分配）。
 * 幸运若等于 youngLuck 且年龄 15–19 岁，视为合法的“掷两次取高”。
 */
export function coc7eCreationDifferences(
	result: Coc7eCreationRollResult,
	chosenIndex: number | null,
	submitted: Coc7eAttributes,
	age: number | null,
): Coc7eCreationDifference[] {
	const young = age !== null && age >= 15 && age < 20;
	const luckDifference = (
		luck: number,
		youngLuck: number,
	): Coc7eCreationDifference[] => {
		const allowed = young ? Math.max(luck, youngLuck) : luck;
		return submitted.luck === allowed
			? []
			: [{ key: "luck", expected: allowed, submitted: submitted.luck }];
	};
	if (result.method === "pointBuy") {
		return luckDifference(result.luck, result.youngLuck);
	}
	if (chosenIndex === null) {
		return [];
	}
	if (result.fallback !== null && chosenIndex === result.sets.length) {
		return luckDifference(result.fallback.luck, result.fallback.youngLuck);
	}
	const set = result.sets[chosenIndex];
	if (!set) {
		return [];
	}
	const differences: Coc7eCreationDifference[] = [];
	for (const key of Object.keys(set.attributes) as Coc7eAttributeKey[]) {
		let expected = set.attributes[key];
		if (key === "luck" && young) {
			expected = Math.max(set.attributes.luck, set.youngLuck);
		}
		if (submitted[key] !== expected) {
			differences.push({ key, expected, submitted: submitted[key] });
		}
	}
	return differences;
}
