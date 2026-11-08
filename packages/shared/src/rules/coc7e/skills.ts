import type { Coc7eCharacterSheet } from "./sheet";

export interface Coc7eSkillDefinition {
	key: string;
	aliases: readonly string[];
	base: number;
	group?: string;
	modernOnly?: boolean;
	uncommon?: boolean;
	description?: string;
}

export interface Coc7eSkillGroupInfo {
	base: number;
	description: string;
}

function skill(
	key: string,
	base: number,
	aliases: readonly string[] = [],
	options: {
		group?: string;
		modernOnly?: boolean;
		uncommon?: boolean;
		description?: string;
	} = {},
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
	skill("会计", 5, ["accounting"], {
		description: "记账、查账与解读财务文件，发现收支中的异常。",
	}),
	skill("动物驯养", 5, ["驯兽", "animal handling"], {
		uncommon: true,
		description: "驯服、照料与役使动物，理解其习性与情绪。",
	}),
	skill("人类学", 1, ["anthropology"], {
		description: "理解人类社会与文化的结构，识别异族习俗的含意。",
	}),
	skill("估价", 5, ["appraise"], {
		description: "判断物品的价值、年代与真伪线索。",
	}),
	skill("考古学", 1, ["archaeology"], {
		description: "通过发掘与研究遗迹，解读古代文明与文物。",
	}),
	skill("炮术", 1, ["artillery"], {
		uncommon: true,
		description: "操作与维护火炮等重型武器。",
	}),
	skill("魅惑", 15, ["取悦", "charm"], {
		description: "以魅力与殷勤让目标自愿配合。",
	}),
	skill("攀爬", 20, ["climb"], {
		description: "攀登峭壁、建筑立面或绳索。",
	}),
	skill("计算机使用", 5, ["计算机", "computer use", "computer"], {
		modernOnly: true,
		description: "操作、检索与入侵计算机系统。",
	}),
	skill("信用评级", 0, ["信用", "credit rating", "credit"], {
		description: "代表社会地位与经济实力，决定可动用的资源与人脉。",
	}),
	skill("克苏鲁神话", 0, ["cthulhu mythos", "mythos"], {
		description: "触及真相的禁忌知识，只能通过遭遇增长，且会降低理智上限。",
	}),
	skill("爆破", 1, ["demolitions"], {
		uncommon: true,
		description: "安全地安装与引爆炸药。",
	}),
	skill("乔装", 5, ["disguise"], {
		description: "改变外貌、衣着与举止以冒充他人。",
	}),
	skill("潜水", 1, ["diving"], {
		uncommon: true,
		description: "使用装备潜水，并应对水下突发状况。",
	}),
	skill("闪避", 0, ["dodge"], {
		description:
			"本能地躲开攻击，基础值等于敏捷值的一半；无法孤注一掷，每轮至多对抗一次攻击。",
	}),
	skill("汽车驾驶", 20, ["驾驶汽车", "drive auto", "drive"], {
		description: "驾驶汽车，并处理常见路况与故障。",
	}),
	skill("电气维修", 10, ["electrical repair"], {
		description: "检修电气线路与电气设备。",
	}),
	skill("电子学", 1, ["electronics"], {
		modernOnly: true,
		description: "理解、组装与破解电子设备。",
	}),
	skill("话术", 5, ["fast talk"], {
		description: "用连珠妙语哄骗目标当场让利，事后容易被识破。",
	}),
	skill("急救", 30, ["first aid"], {
		description: "稳定伤势防止死亡，每小时恢复 1 点生命值。",
	}),
	skill("历史", 5, ["history"], {
		description: "掌握历史事件、年代与人物的知识。",
	}),
	skill("催眠", 1, ["hypnosis"], {
		uncommon: true,
		description: "以催眠缓解精神创伤，或探寻被遗忘的记忆。",
	}),
	skill("恐吓", 15, ["intimidate"], {
		description: "以威胁使目标屈服、逃跑或泄密。",
	}),
	skill("跳跃", 20, ["jump"], {
		description: "跨越沟壑、攀上高台，或自高处安全落地。",
	}),
	skill("母语", 0, ["own language"], {
		description: "母语的听说读写能力，基础值等于教育值。",
	}),
	skill("法律", 5, ["law"], {
		description: "熟悉法律条文与司法程序，可用于辩护或钻空子。",
	}),
	skill("图书馆", 20, ["图书馆使用", "library use", "library"], {
		description: "在档案与藏书里快速查证资料，为研究其他技能争取时间。",
	}),
	skill("礼仪", 5, ["etiquette"], {
		description: "理解不同圈层的社交规范，并得体应对。",
	}),
	skill("聆听", 20, ["listen"], {
		description: "察觉门后脚步、低语等细微声响。",
	}),
	skill("锁匠", 1, ["locksmith"], {
		description: "开启、破坏或安装机械锁具。",
	}),
	skill("机械维修", 10, ["mechanical repair"], {
		description: "拆装、检修机械设备与简单机器。",
	}),
	skill("医学", 1, ["medicine"], {
		description: "诊断与治疗伤病，实施手术和重伤救治。",
	}),
	skill("博物学", 10, ["natural world", "natural"], {
		description: "辨认动植物、物产与自然现象。",
	}),
	skill("领航", 10, ["导航", "navigate", "navigation"], {
		description: "依据星象、地图与环境判断方位和路线。",
	}),
	skill("神秘学", 5, ["occult"], {
		description: "掌握秘教仪式、玄学传说与符咒知识。",
	}),
	skill("操作重型机械", 1, ["重型机械", "operate heavy machinery"], {
		description: "操作起重机、推土机等重型机械。",
	}),
	skill("说服", 10, ["persuade"], {
		description: "以理由与辩才让目标认同并让步。",
	}),
	skill("精神分析", 1, ["psychoanalysis"], {
		description: "长期治疗疯狂症状，帮助患者恢复理智。",
	}),
	skill("心理学", 10, ["psychology"], {
		description: "判断他人的情绪、意图与可信度。",
	}),
	skill("读唇", 1, ["read lips"], {
		uncommon: true,
		description: "通过口型理解对方在说什么。",
	}),
	skill("骑术", 5, ["ride"], {
		description: "骑乘与驾驭马匹等坐骑。",
	}),
	skill("妙手", 10, ["sleight of hand"], {
		description: "手快地偷取、藏匿或调包小物件。",
	}),
	skill("侦查", 25, ["侦察", "spot hidden", "spot"], {
		description: "察觉细节、异状与暗藏之物，是调查的核心技能。",
	}),
	skill("潜行", 20, ["stealth"], {
		description: "无声移动、藏匿身形，避开他人耳目。",
	}),
	skill("游泳", 20, ["swim"], {
		description: "游泳与水中求生。",
	}),
	skill("投掷", 20, ["throw"], {
		description: "准确投掷刀具、绳索等物品。",
	}),
	skill("追踪", 10, ["track"], {
		description: "沿足迹与痕迹跟踪目标。",
	}),
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

export const COC7E_SKILL_GROUP_INFO: Record<string, Coc7eSkillGroupInfo> = {
	技艺: {
		base: 5,
		description: "艺术或手艺技能，代表一门专业技艺的造诣，名称可自由填写。",
	},
	格斗: { base: 0, description: "近战格斗技能，决定徒手或持械攻防的能力。" },
	射击: { base: 0, description: "远程武器射击技能，决定各类枪械弓弩的命中能力。" },
	科学: {
		base: 1,
		description: "系统的科学知识，用于分析、推断与研究，名称可自由填写。",
	},
	语言: { base: 1, description: "一门外语的听说读写能力，名称可自由填写。" },
	驾驶: { base: 1, description: "驾驶飞行器、船只等载具的技能。" },
	生存: {
		base: 10,
		description: "在特定极端环境中求生、觅食与辨向的能力。",
	},
	学识: { base: 1, description: "关于神秘领域的非常规专门知识。" },
};

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

export function coc7eSkillDescription(rawKey: string): string | null {
	const key = canonicalizeCoc7eSkillKey(rawKey) ?? rawKey.trim();
	const entry = COC7E_SKILL_CATALOG.find((item) => item.key === key);
	if (entry?.description) {
		return entry.description;
	}
	const group = entry?.group ?? coc7eSkillFamily(key);
	return group ? (COC7E_SKILL_GROUP_INFO[group]?.description ?? null) : null;
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

export function coc7eSkillFamily(rawKey: string): string | null {
	const key = rawKey.trim();
	if (key === "") {
		return null;
	}
	const lowered = key.toLowerCase();
	const matchesAlias = (alias: string) =>
		alias.trim().toLowerCase() === lowered;
	for (const [family, aliases] of Object.entries(COC7E_SKILL_GROUP_ALIASES)) {
		if (aliases.some(matchesAlias)) {
			return family;
		}
	}
	const entry = COC7E_SKILL_CATALOG.find(
		(item) => item.key === key || item.aliases.some((alias) => alias === key),
	);
	if (entry?.group) {
		return entry.group;
	}
	const head = key.match(/^([^()（）]+)[(（]/)?.[1]?.trim();
	if (head) {
		for (const [family, aliases] of Object.entries(COC7E_SKILL_GROUP_ALIASES)) {
			if (aliases.some((alias) => alias.trim() === head)) {
				return family;
			}
		}
	}
	return null;
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
