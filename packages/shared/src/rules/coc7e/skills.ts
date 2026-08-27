/** CoC 7e 标准技能（中文键为人物卡存储键；别名用于 Excel 解析） */
export const COC7E_SKILL_CATALOG: ReadonlyArray<{
  key: string;
  aliases: readonly string[];
  base: number;
}> = [
  { key: "会计", aliases: ["会计", "accounting"], base: 5 },
  { key: "人类学", aliases: ["人类学", "anthropology"], base: 1 },
  { key: "估价", aliases: ["估价", "appraise"], base: 5 },
  { key: "考古学", aliases: ["考古学", "archaeology"], base: 1 },
  { key: "艺术/工艺", aliases: ["艺术/工艺", "艺术", "工艺", "art", "craft", "art/craft"], base: 5 },
  { key: "魅惑", aliases: ["魅惑", "charm"], base: 15 },
  { key: "攀爬", aliases: ["攀爬", "climb"], base: 20 },
  { key: "计算机使用", aliases: ["计算机使用", "计算机", "computer use", "computer"], base: 5 },
  { key: "信用评级", aliases: ["信用评级", "信用", "credit rating", "credit"], base: 0 },
  { key: "克苏鲁神话", aliases: ["克苏鲁神话", "cthulhu mythos", "mythos"], base: 0 },
  { key: "乔装", aliases: ["乔装", "disguise"], base: 5 },
  { key: "闪避", aliases: ["闪避", "dodge"], base: 0 },
  { key: "汽车驾驶", aliases: ["汽车驾驶", "驾驶汽车", "drive auto", "drive"], base: 20 },
  { key: "电气维修", aliases: ["电气维修", "electrical repair"], base: 10 },
  { key: "话术", aliases: ["话术", "fast talk"], base: 5 },
  { key: "格斗", aliases: ["格斗", "斗殴", "fighting", "brawl", "格斗：斗殴", "格斗(斗殴)"], base: 25 },
  { key: "射击", aliases: ["射击", "手枪", "firearms", "handgun", "射击：手枪", "射击(手枪)"], base: 20 },
  { key: "急救", aliases: ["急救", "first aid"], base: 30 },
  { key: "历史", aliases: ["历史", "history"], base: 5 },
  { key: "恐吓", aliases: ["恐吓", "intimidate"], base: 15 },
  { key: "跳跃", aliases: ["跳跃", "jump"], base: 20 },
  { key: "语言", aliases: ["语言", "外语", "language", "other language"], base: 1 },
  { key: "母语", aliases: ["母语", "own language"], base: 0 },
  { key: "法律", aliases: ["法律", "law"], base: 5 },
  { key: "图书馆", aliases: ["图书馆", "图书馆使用", "library use", "library"], base: 20 },
  { key: "聆听", aliases: ["聆听", "listen"], base: 20 },
  { key: "锁匠", aliases: ["锁匠", "locksmith"], base: 1 },
  { key: "机械维修", aliases: ["机械维修", "mechanical repair"], base: 10 },
  { key: "医学", aliases: ["医学", "medicine"], base: 1 },
  { key: "博物学", aliases: ["博物学", "natural world", "natural"], base: 10 },
  { key: "领航", aliases: ["领航", "navigate"], base: 10 },
  { key: "神秘学", aliases: ["神秘学", "occult"], base: 5 },
  { key: "操作重型机械", aliases: ["操作重型机械", "重型机械", "operate heavy machinery"], base: 1 },
  { key: "说服", aliases: ["说服", "persuade"], base: 10 },
  { key: "精神分析", aliases: ["精神分析", "psychoanalysis"], base: 1 },
  { key: "心理学", aliases: ["心理学", "psychology"], base: 10 },
  { key: "骑术", aliases: ["骑术", "ride"], base: 5 },
  { key: "科学", aliases: ["科学", "science"], base: 1 },
  { key: "妙手", aliases: ["妙手", "sleight of hand"], base: 10 },
  { key: "侦查", aliases: ["侦查", "侦察", "spot hidden", "spot"], base: 25 },
  { key: "潜行", aliases: ["潜行", "stealth"], base: 20 },
  { key: "生存", aliases: ["生存", "survival"], base: 10 },
  { key: "游泳", aliases: ["游泳", "swim"], base: 20 },
  { key: "投掷", aliases: ["投掷", "throw"], base: 20 },
  { key: "追踪", aliases: ["追踪", "track"], base: 10 },
];

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

/** 将 Excel/输入中的技能名规范到人物卡存储键 */
export function canonicalizeCoc7eSkillKey(raw: string): string | null {
  const text = raw.trim().toLowerCase().replace(/[:：].*$/, "");
  for (const skill of COC7E_SKILL_CATALOG) {
    if (skill.aliases.some((alias) => alias.toLowerCase() === text)) {
      return skill.key;
    }
  }
  return null;
}

/** 从表格单元格识别技能键：精确别名，或别名后紧跟空白/标点/数字 */
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
      const bounded = next === "" || /[\s:：(\[（0-9]/.test(next);
      if (bounded && (!best || aliasLower.length > best.len)) {
        best = { key: skill.key, len: aliasLower.length };
      }
    }
  }
  return best?.key ?? null;
}
