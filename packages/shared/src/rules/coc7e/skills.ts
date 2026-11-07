import type { Coc7eCharacterSheet } from "./sheet";

export interface Coc7eSkillDefinition {
	key: string;
	aliases: readonly string[];
	base: number;
	group?: string;
	modernOnly?: boolean;
	uncommon?: boolean;
}

function skill(
	key: string,
	base: number,
	aliases: readonly string[] = [],
	options: { group?: string; modernOnly?: boolean; uncommon?: boolean } = {},
): Coc7eSkillDefinition {
	return { key, base, aliases: [key, ...aliases], ...options };
}

function specialization(
	group: string,
	name: string,
	base: number,
	aliases: readonly string[] = [],
	options: { uncommon?: boolean } = {},
): Coc7eSkillDefinition {
	return skill(
		`${group}(${name})`,
		base,
		[`${group}：${name}`, name, ...aliases],
		{
			group,
			...options,
		},
	);
}

const art = (name: string, aliases: readonly string[] = []) =>
	specialization("技艺", name, 5, aliases);
const fighting = (
	name: string,
	base: number,
	aliases: readonly string[] = [],
) => specialization("格斗", name, base, aliases);
const firearms = (
	name: string,
	base: number,
	aliases: readonly string[] = [],
) => specialization("射击", name, base, aliases);
const science = (name: string, base = 1, aliases: readonly string[] = []) =>
	specialization("科学", name, base, aliases);

export const COC7E_SKILL_CATALOG: readonly Coc7eSkillDefinition[] = [
	skill("会计", 5, ["accounting"]),
	skill("动物驯养", 5, ["驯兽", "animal handling"], { uncommon: true }),
	skill("人类学", 1, ["anthropology"]),
	skill("估价", 5, ["appraise"]),
	skill("考古学", 1, ["archaeology"]),
	skill("炮术", 1, ["artillery"], { uncommon: true }),
	skill("魅惑", 15, ["取悦", "charm"]),
	skill("攀爬", 20, ["climb"]),
	skill("计算机使用", 5, ["计算机", "computer use", "computer"], {
		modernOnly: true,
	}),
	skill("信用评级", 0, ["信用", "credit rating", "credit"]),
	skill("克苏鲁神话", 0, ["cthulhu mythos", "mythos"]),
	skill("爆破", 1, ["demolitions"], { uncommon: true }),
	skill("乔装", 5, ["disguise"]),
	skill("潜水", 1, ["diving"], { uncommon: true }),
	skill("闪避", 0, ["dodge"]),
	skill("汽车驾驶", 20, ["驾驶汽车", "drive auto", "drive"]),
	skill("电气维修", 10, ["electrical repair"]),
	skill("电子学", 1, ["electronics"], { modernOnly: true }),
	skill("话术", 5, ["fast talk"]),
	skill("急救", 30, ["first aid"]),
	skill("历史", 5, ["history"]),
	skill("催眠", 1, ["hypnosis"], { uncommon: true }),
	skill("恐吓", 15, ["intimidate"]),
	skill("跳跃", 20, ["jump"]),
	skill("母语", 0, ["own language"]),
	skill("法律", 5, ["law"]),
	skill("图书馆", 20, ["图书馆使用", "library use", "library"]),
	skill("聆听", 20, ["listen"]),
	skill("锁匠", 1, ["locksmith"]),
	skill("机械维修", 10, ["mechanical repair"]),
	skill("医学", 1, ["medicine"]),
	skill("博物学", 10, ["natural world", "natural"]),
	skill("领航", 10, ["导航", "navigate", "navigation"]),
	skill("神秘学", 5, ["occult"]),
	skill("操作重型机械", 1, ["重型机械", "operate heavy machinery"]),
	skill("说服", 10, ["persuade"]),
	skill("精神分析", 1, ["psychoanalysis"]),
	skill("心理学", 10, ["psychology"]),
	skill("读唇", 1, ["read lips"], { uncommon: true }),
	skill("骑术", 5, ["ride"]),
	skill("妙手", 10, ["sleight of hand"]),
	skill("侦查", 25, ["侦察", "spot hidden", "spot"]),
	skill("潜行", 20, ["stealth"]),
	skill("游泳", 20, ["swim"]),
	skill("投掷", 20, ["throw"]),
	skill("追踪", 10, ["track"]),
	art("表演", ["acting"]),
	art("美术", ["fine art"]),
	art("伪造", ["forgery"]),
	art("摄影", ["photography"]),
	art("写作"),
	art("理发"),
	art("莫里斯舞蹈"),
	art("书法"),
	art("歌剧歌唱"),
	art("木匠"),
	art("粉刷匠和油漆工"),
	art("厨艺"),
	art("舞蹈"),
	art("制陶"),
	art("雕塑"),
	art("吹真空管"),
	fighting("斗殴", 25, ["格斗", "拳击", "空手道", "brawl", "fighting"]),
	fighting("斧", 15, ["axe"]),
	fighting("链锯", 10, ["chainsaw"]),
	fighting("连枷", 10, ["flail"]),
	fighting("绞索", 15, ["garrote"]),
	fighting("矛", 20, ["spear"]),
	fighting("剑", 20, ["sword"]),
	fighting("鞭", 5, ["whip"]),
	firearms("手枪", 20, ["射击", "handgun", "firearms"]),
	firearms("步枪/霰弹枪", 25, ["步枪", "霰弹枪", "步霰", "rifle", "shotgun"]),
	firearms("弓", 15, ["bow"]),
	firearms("冲锋枪", 15, ["submachine gun"]),
	firearms("机枪", 10, ["machine gun"]),
	firearms("重武器", 10, ["heavy weapons"]),
	firearms("火焰喷射器", 10, ["flamethrower"]),
	science("天文学"),
	science("生物学"),
	science("植物学"),
	science("化学"),
	science("密码学"),
	science("工程学"),
	science("司法科学"),
	science("地质学"),
	science("数学", 10),
	science("气象学"),
	science("药学"),
	science("物理学", 1, ["物理"]),
	science("动物学"),
	specialization("驾驶", "飞行器", 1, ["pilot aircraft"]),
	specialization("驾驶", "船", 1, ["pilot boat"]),
	specialization("生存", "沙漠", 10),
	specialization("生存", "海洋", 10),
	specialization("生存", "极地", 10),
	specialization("生存", "荒野", 10),
	specialization("学识", "梦", 1, [], { uncommon: true }),
	specialization("学识", "死灵之书", 1, [], { uncommon: true }),
	specialization("学识", "UFO", 1, [], { uncommon: true }),
	specialization("学识", "吸血鬼", 1, [], { uncommon: true }),
	specialization("学识", "狼人", 1, [], { uncommon: true }),
	specialization("学识", "亚狄斯星人", 1, [], { uncommon: true }),
];

export const COC7E_SKILL_GROUP_ALIASES: Record<string, readonly string[]> = {
	技艺: ["技艺", "艺术/工艺", "艺术与手艺", "艺术", "工艺", "art", "craft"],
	格斗: ["格斗", "fighting"],
	射击: ["射击", "firearms"],
	科学: ["科学", "science"],
	语言: ["语言", "外语", "其他语言", "language"],
	驾驶: ["驾驶", "pilot"],
	生存: ["生存", "survival"],
	学识: ["学识", "学问", "lore"],
};

export const COC7E_ATTRIBUTE_ALIASES: Record<string, readonly string[]> = {
	str: ["力量", "str"],
	con: ["体质", "con"],
	siz: ["体型", "siz"],
	dex: ["敏捷", "dex"],
	app: ["外貌", "app"],
	int: ["智力", "int", "灵感"],
	pow: ["意志", "pow"],
	edu: ["教育", "edu"],
	luck: ["幸运", "luck"],
};

export const COC7E_ATTRIBUTE_LABELS: Record<
	string,
	{ label: string; abbr: string }
> = Object.fromEntries(
	Object.entries(COC7E_ATTRIBUTE_ALIASES).map(([key, aliases]) => [
		key,
		{ label: aliases[0]!, abbr: key.toUpperCase() },
	]),
);

const exactAliases = new Map<string, string>();
for (const entry of COC7E_SKILL_CATALOG) {
	for (const alias of entry.aliases) {
		const normalized = alias.trim().toLowerCase();
		if (!exactAliases.has(normalized)) {
			exactAliases.set(normalized, entry.key);
		}
	}
}

export function coc7eSkillLabel(rawKey: string): string {
	const key = rawKey.trim();
	const attribute = COC7E_ATTRIBUTE_LABELS[key];
	if (attribute) {
		return attribute.label;
	}
	return canonicalizeCoc7eSkillKey(key) ?? key;
}

export function canonicalizeCoc7eSkillKey(raw: string): string | null {
	return exactAliases.get(raw.trim().toLowerCase()) ?? null;
}

export function coc7eSkillBaseValue(
	sheet: Coc7eCharacterSheet,
	rawKey: string,
): number | null {
	const key = rawKey.trim();
	const canonical = canonicalizeCoc7eSkillKey(key);
	const custom =
		sheet.customSkills?.[key] ??
		(canonical ? sheet.customSkills?.[canonical] : undefined);
	if (custom) {
		if (custom.formula === "edu") {
			return sheet.attributes.edu;
		}
		if (custom.formula === "halfDex") {
			return Math.floor(sheet.attributes.dex / 2);
		}
		return custom.base;
	}
	if (!canonical) {
		return null;
	}
	if (canonical === "闪避") {
		return Math.floor(sheet.attributes.dex / 2);
	}
	if (canonical === "母语") {
		return sheet.attributes.edu;
	}
	return (
		COC7E_SKILL_CATALOG.find((entry) => entry.key === canonical)?.base ?? null
	);
}

export function coc7eSkillTargetValue(
	sheet: Coc7eCharacterSheet,
	rawKey: string,
): number | null {
	const key = rawKey.trim();
	const canonical = canonicalizeCoc7eSkillKey(key);
	const direct =
		sheet.skills[key] ?? (canonical ? sheet.skills[canonical] : undefined);
	if (direct !== undefined) {
		return direct;
	}
	const attributeValue = (sheet.attributes as Record<string, number>)[key];
	if (attributeValue !== undefined) {
		return attributeValue;
	}
	return coc7eSkillBaseValue(sheet, key);
}

export function coc7eSkillGrowthAllowed(
	rawKey: string,
	bonusDice: number,
): boolean {
	if (bonusDice > 0) {
		return false;
	}
	const canonical = canonicalizeCoc7eSkillKey(rawKey) ?? rawKey.trim();
	return canonical !== "信用评级" && canonical !== "克苏鲁神话";
}

export function matchCoc7eSkillCell(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) {
		return null;
	}
	const direct = canonicalizeCoc7eSkillKey(trimmed);
	if (direct) {
		return direct;
	}
	const lowered = trimmed.toLowerCase();
	let best: { key: string; len: number } | null = null;
	for (const skill of COC7E_SKILL_CATALOG) {
		for (const alias of skill.aliases) {
			const aliasLower = alias.toLowerCase();
			if (!lowered.startsWith(aliasLower)) {
				continue;
			}
			const next = lowered.slice(aliasLower.length, aliasLower.length + 1);
			const bounded = next === "" || /[\s:：([（0-9①②③④⑤⑥⑦⑧⑨]/.test(next);
			if (bounded && (!best || aliasLower.length > best.len)) {
				best = { key: skill.key, len: aliasLower.length };
			}
		}
	}
	return best?.key ?? null;
}
