export const phases = [
  { key: "free_discussion", label: "自由讨论", desc: "全员可发言 · 即时呈现 · 记为场外" },
  { key: "performance_time", label: "演绎时间", desc: "演绎发言 · 放行后呈现" },
  { key: "forced_cg", label: "强制CG", desc: "全员禁言 · GM 演出" },
  { key: "free_performance", label: "自由演绎", desc: "自由发言 · 角色扮演经放行" },
] as const;

export type QueueItem = {
  id: string;
  name: string;
  initials: string;
  kindLabel: string;
  kindTone: "accent" | "default";
  preview: string;
  emotion?: string;
};

export const speakQueue: QueueItem[] = [
  {
    id: "q1",
    name: "远野 澪",
    initials: "澪",
    kindLabel: "PC",
    kindTone: "accent",
    preview: "（她猛地转身，煤油灯的光晕在…",
    emotion: "惊讶",
  },
  {
    id: "q2",
    name: "白石 拓真",
    initials: "拓",
    kindLabel: "PC",
    kindTone: "accent",
    preview: "我数到三就撞开这扇门。",
  },
  {
    id: "q3",
    name: "匿名访客 #f2a9",
    initials: "客",
    kindLabel: "OB",
    kindTone: "default",
    preview: "OB：这里 SAN 检定怕是躲不过了…",
  },
];

export const scenes = [
  { id: "library-night", name: "图书馆 · 夜", thumb: "/demo/scenes/library-night-thumb.png", active: true },
  { id: "boathouse", name: "船屋", thumb: "/demo/scenes/boathouse-thumb.png", active: false },
  { id: "lake-altar", name: "湖底祭坛", thumb: "/demo/scenes/lake-altar-thumb.png", active: false },
];

export const stageCharacters = [
  { id: "mio", name: "远野 澪", initials: "远", kindLabel: "PC", expression: "默认", visible: true },
  { id: "takuma", name: "白石 拓真", initials: "白", kindLabel: "PC", expression: "惊讶", visible: true },
];

export const bgmState = {
  name: "雨夜的图书馆",
  meta: "BGM · 循环 · 02:41 / 04:10",
  playing: true,
  volume: 64,
};

export const soundEffects = ["雷声", "开门", "心跳", "低语"];

export const onlinePlayers = [
  { id: "p1", name: "阿川", fingerprint: "指纹 8c1d…2f", roleLabel: "PC · 远野 澪" },
  { id: "p2", name: "Kuro", fingerprint: "指纹 8c1d…4f", roleLabel: "PC · 白石 拓真" },
  { id: "p3", name: "匿名访客 #f2a9", fingerprint: "指纹 91ae…7c", roleLabel: "OB" },
];

export const gmMessages = [
  {
    id: "1",
    speakerName: "KP",
    speakerRoleLabel: "主持人",
    avatarInitials: "KP",
    avatarBg: "bg-accent",
    avatarFg: "text-accent-foreground",
    time: "21:02",
    body: "雨声忽然变大了。你们脚下的木地板传来一阵低沉的、类似船体挤压的呻吟声——图书馆的西侧书架后，似乎有一扇从未见过的暗门。",
    tone: "ic" as const,
  },
  {
    id: "2",
    speakerName: "远野 澪",
    speakerRoleLabel: "PC",
    avatarInitials: "澪",
    avatarBg: "bg-default",
    avatarFg: "text-foreground",
    time: "21:05",
    body: "「……如果日记里写的是真的，那么七年前沉入湖底的，恐怕就不只是那辆车。」她把煤油灯举高，凑近暗门的缝隙。",
    tone: "ic" as const,
  },
  {
    id: "3",
    speakerName: "白石 拓真",
    speakerRoleLabel: "PC",
    avatarInitials: "拓",
    avatarBg: "bg-default",
    avatarFg: "text-foreground",
    time: "21:06",
    body: "笑死，我 SAN 值已经开始预支了，KP 手下留情",
    tone: "ooc" as const,
  },
  {
    id: "4",
    speakerName: "KP",
    speakerRoleLabel: "主持人",
    avatarInitials: "KP",
    avatarBg: "bg-accent",
    avatarFg: "text-accent-foreground",
    time: "21:08",
    body: "你翻遍了手边的藏书目录，却什么都没找到。相反，你注意到目录最后一页被人用指甲反复刻下了同一行小字：不要开门。",
    tone: "ic" as const,
  },
];
