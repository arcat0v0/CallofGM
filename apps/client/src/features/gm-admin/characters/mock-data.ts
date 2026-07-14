export type CharacterKind = "PC" | "NPC";

export type DerivedStats = {
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  san: { current: number; max: number };
  luck: number;
  mov: number;
};

export type Attribute = { label: string; abbr: string; value: number };

export type Skill = { label: string; value: number; highlighted: boolean };

export type GameCharacter = {
  id: string;
  name: string;
  initial: string;
  profession: string;
  kind: CharacterKind;
  meta: string;
  claim?: string;
  portrait?: string;
  expressions: string[];
  derived: DerivedStats;
  attributes: Attribute[];
  skills: Skill[];
};

function attrs(entries: [string, string, number][]): Attribute[] {
  return entries.map(([label, abbr, value]) => ({ label, abbr, value }));
}

function skills(entries: [string, number, boolean][]): Skill[] {
  return entries.map(([label, value, highlighted]) => ({ label, value, highlighted }));
}

export const characters: GameCharacter[] = [
  {
    id: "mio",
    name: "远野 澪",
    initial: "远",
    profession: "侦探",
    kind: "PC",
    meta: "25 岁 · 女 · 私家侦探 · 出身横滨",
    claim: "已认领 · 阿川",
    portrait: "/demo/portraits/tono-mio.png",
    expressions: ["默认", "微笑", "惊讶", "生气", "受伤"],
    derived: { hp: { current: 11, max: 11 }, mp: { current: 14, max: 14 }, san: { current: 52, max: 58 }, luck: 65, mov: 8 },
    attributes: attrs([
      ["力量", "STR", 55],
      ["体质", "CON", 60],
      ["体型", "SIZ", 50],
      ["敏捷", "DEX", 70],
      ["外貌", "APP", 65],
      ["智力", "INT", 80],
      ["意志", "POW", 70],
      ["教育", "EDU", 75],
      ["理智", "SAN", 52],
    ]),
    skills: skills([
      ["侦查", 65, true],
      ["聆听", 55, true],
      ["图书馆", 70, true],
      ["心理学", 60, true],
      ["话术", 50, false],
      ["侦察", 45, false],
      ["闪避", 35, false],
      ["斗殴", 40, false],
      ["射击 手枪", 45, false],
      ["急救", 55, true],
      ["母语 日语", 75, true],
      ["历史", 40, false],
    ]),
  },
  {
    id: "takuma",
    name: "白石 拓真",
    initial: "白",
    profession: "记者",
    kind: "PC",
    meta: "28 岁 · 男 · 报社记者 · 出身东京",
    claim: "已认领 · Kuro",
    portrait: "/demo/portraits/shiraishi-takuma.png",
    expressions: ["默认", "微笑", "惊讶", "受伤"],
    derived: { hp: { current: 12, max: 12 }, mp: { current: 12, max: 12 }, san: { current: 55, max: 60 }, luck: 55, mov: 8 },
    attributes: attrs([
      ["力量", "STR", 60],
      ["体质", "CON", 55],
      ["体型", "SIZ", 65],
      ["敏捷", "DEX", 55],
      ["外貌", "APP", 60],
      ["智力", "INT", 70],
      ["意志", "POW", 60],
      ["教育", "EDU", 70],
      ["理智", "SAN", 55],
    ]),
    skills: skills([
      ["摄影", 60, true],
      ["图书馆", 55, true],
      ["说服", 65, true],
      ["心理学", 50, true],
      ["侦查", 55, true],
      ["汽车驾驶", 50, false],
      ["母语 日语", 70, true],
      ["英语", 40, false],
      ["斗殴", 45, false],
      ["闪避", 40, false],
      ["急救", 30, false],
      ["历史", 45, false],
    ]),
  },
  {
    id: "tsubaki",
    name: "南 椿",
    initial: "椿",
    profession: "医生",
    kind: "PC",
    meta: "31 岁 · 女 · 外科医生 · 出身京都",
    portrait: undefined,
    expressions: ["默认", "微笑", "惊讶"],
    derived: { hp: { current: 11, max: 11 }, mp: { current: 13, max: 13 }, san: { current: 65, max: 65 }, luck: 60, mov: 8 },
    attributes: attrs([
      ["力量", "STR", 45],
      ["体质", "CON", 60],
      ["体型", "SIZ", 50],
      ["敏捷", "DEX", 65],
      ["外貌", "APP", 70],
      ["智力", "INT", 75],
      ["意志", "POW", 65],
      ["教育", "EDU", 80],
      ["理智", "SAN", 65],
    ]),
    skills: skills([
      ["医学", 70, true],
      ["急救", 65, true],
      ["生物学", 60, true],
      ["药学", 55, true],
      ["心理学", 50, true],
      ["聆听", 45, false],
      ["侦查", 40, false],
      ["母语 日语", 75, true],
      ["英语", 50, false],
      ["说服", 40, false],
      ["闪避", 45, false],
      ["斗殴", 25, false],
    ]),
  },
  {
    id: "uyu",
    name: "馆长 · 乌有",
    initial: "乌",
    profession: "",
    kind: "NPC",
    meta: "馆长 · 年龄不详 · 图书馆管理人",
    portrait: undefined,
    expressions: ["默认", "惊讶"],
    derived: { hp: { current: 10, max: 10 }, mp: { current: 16, max: 16 }, san: { current: 40, max: 80 }, luck: 50, mov: 6 },
    attributes: attrs([
      ["力量", "STR", 40],
      ["体质", "CON", 50],
      ["体型", "SIZ", 55],
      ["敏捷", "DEX", 45],
      ["外貌", "APP", 45],
      ["智力", "INT", 85],
      ["意志", "POW", 80],
      ["教育", "EDU", 90],
      ["理智", "SAN", 40],
    ]),
    skills: skills([
      ["图书馆", 85, true],
      ["历史", 75, true],
      ["神秘学", 70, true],
      ["母语 日语", 80, true],
      ["心理学", 55, true],
      ["侦查", 50, false],
      ["聆听", 45, false],
      ["克苏鲁神话", 20, true],
      ["说服", 60, true],
      ["潜行", 40, false],
      ["闪避", 30, false],
      ["急救", 25, false],
    ]),
  },
  {
    id: "man-in-black",
    name: "黑衣人",
    initial: "影",
    profession: "",
    kind: "NPC",
    meta: "身份不明 · 总在雨夜出现",
    portrait: undefined,
    expressions: ["默认", "生气"],
    derived: { hp: { current: 14, max: 14 }, mp: { current: 14, max: 14 }, san: { current: 30, max: 70 }, luck: 45, mov: 9 },
    attributes: attrs([
      ["力量", "STR", 75],
      ["体质", "CON", 70],
      ["体型", "SIZ", 65],
      ["敏捷", "DEX", 80],
      ["外貌", "APP", 40],
      ["智力", "INT", 60],
      ["意志", "POW", 70],
      ["教育", "EDU", 55],
      ["理智", "SAN", 30],
    ]),
    skills: skills([
      ["潜行", 75, true],
      ["隐藏", 70, true],
      ["闪避", 80, true],
      ["斗殴", 65, true],
      ["侦查", 60, true],
      ["聆听", 55, true],
      ["射击 手枪", 60, true],
      ["母语 日语", 60, false],
      ["恐吓", 65, true],
      ["追踪", 55, true],
      ["急救", 40, false],
      ["攀爬", 50, false],
    ]),
  },
];
