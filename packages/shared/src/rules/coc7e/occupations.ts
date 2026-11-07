import type { Coc7eAttributeKey, Coc7eOccupation } from "./sheet";

export interface Coc7eOccupationDefinition {
	id: string;
	name: string;
	creditMin: number;
	creditMax: number;
	skillPointFormulaOptions: Coc7eOccupation["skillPointFormula"][];
	skillKeys: string[];
	modernOnly?: boolean;
}

function points(
	...parts: Array<[Coc7eAttributeKey, number]>
): Coc7eOccupation["skillPointFormula"] {
	return parts.map(([attribute, multiplier]) => ({ attribute, multiplier }));
}

function occupation(
	id: string,
	name: string,
	creditMin: number,
	creditMax: number,
	skillPointFormulaOptions: Coc7eOccupation["skillPointFormula"][],
	skillKeys: string[],
	modernOnly = false,
): Coc7eOccupationDefinition {
	return {
		id,
		name,
		creditMin,
		creditMax,
		skillPointFormulaOptions,
		skillKeys,
		...(modernOnly ? { modernOnly: true } : {}),
	};
}

const social = ["魅惑", "话术", "恐吓", "说服"];
const edu4 = [points(["edu", 4])];
const eduDexOrStr = [
	points(["edu", 2], ["dex", 2]),
	points(["edu", 2], ["str", 2]),
];

export const COC7E_OCCUPATIONS: readonly Coc7eOccupationDefinition[] = [
	occupation("antiquarian", "古文物学家", 30, 70, edu4, ["估价", "技艺", "历史", "图书馆", "语言", ...social, "侦查"]),
	occupation("artist", "艺术家", 9, 50, [points(["edu", 2], ["pow", 2]), points(["edu", 2], ["dex", 2])], ["技艺", "历史", "博物学", ...social, "语言", "心理学", "侦查"]),
	occupation("athlete", "运动员", 9, 70, eduDexOrStr, ["攀爬", "跳跃", "格斗(斗殴)", "骑术", ...social, "游泳", "投掷"]),
	occupation("author", "作家", 9, 30, edu4, ["技艺(写作)", "历史", "图书馆", "博物学", "神秘学", "语言", "母语", "心理学"]),
	occupation("clergy", "神职人员", 9, 60, edu4, ["会计", "历史", "图书馆", "聆听", "语言", ...social, "心理学"]),
	occupation("criminal", "罪犯", 5, 65, eduDexOrStr, [...social, "心理学", "侦查", "潜行", "估价", "乔装", "格斗", "射击", "锁匠", "机械维修", "妙手"]),
	occupation("dilettante", "业余艺术爱好者", 50, 99, [points(["edu", 2], ["app", 2])], ["技艺", "射击", "语言", "骑术", ...social]),
	occupation("doctor", "医生", 30, 80, edu4, ["急救", "语言", "医学", "心理学", "科学(生物学)", "科学(药学)", "精神分析"]),
	occupation("drifter", "流浪者", 0, 5, [points(["edu", 2], ["app", 2]), ...eduDexOrStr], ["攀爬", "跳跃", "聆听", "领航", ...social, "潜行"]),
	occupation("engineer", "工程师", 30, 60, edu4, ["技艺", "电气维修", "图书馆", "机械维修", "操作重型机械", "科学(工程学)", "科学(物理学)"]),
	occupation("entertainer", "艺人", 9, 70, [points(["edu", 2], ["app", 2])], ["技艺(表演)", "乔装", ...social, "聆听", "心理学"]),
	occupation("farmer", "农民", 9, 30, eduDexOrStr, ["技艺", "汽车驾驶", ...social, "机械维修", "博物学", "操作重型机械", "追踪"]),
	occupation("hacker", "黑客", 10, 70, edu4, ["计算机使用", "电气维修", "电子学", "图书馆", "侦查", ...social], true),
	occupation("reporter", "记者", 9, 30, edu4, ["技艺(摄影)", "历史", "图书馆", "语言", ...social, "心理学"]),
	occupation("lawyer", "律师", 30, 80, edu4, ["会计", "法律", "图书馆", ...social, "心理学"]),
	occupation("librarian", "图书馆管理员", 9, 35, edu4, ["会计", "图书馆", "语言", "母语"]),
	occupation("military-officer", "军官", 20, 70, eduDexOrStr, ["会计", "射击", "领航", ...social, "心理学", "生存"]),
	occupation("missionary", "传教士", 0, 30, edu4, ["技艺", "机械维修", "医学", "博物学", ...social]),
	occupation("musician", "音乐家", 9, 30, [points(["edu", 2], ["dex", 2]), points(["edu", 2], ["pow", 2])], ["技艺", ...social, "聆听", "心理学"]),
	occupation("parapsychologist", "超心理学家", 9, 30, edu4, ["人类学", "技艺(摄影)", "历史", "图书馆", "神秘学", "语言", "心理学"]),
	occupation("pilot", "飞行员", 20, 70, eduDexOrStr, ["电气维修", "机械维修", "领航", "操作重型机械", "驾驶(飞行器)", "科学(天文学)"]),
	occupation("police-detective", "警探", 20, 50, eduDexOrStr, ["技艺(表演)", "乔装", "射击", "法律", "聆听", ...social, "心理学", "侦查"]),
	occupation("police-officer", "警察", 9, 30, eduDexOrStr, ["格斗(斗殴)", "射击", "急救", ...social, "法律", "心理学", "侦查", "汽车驾驶", "骑术"]),
	occupation("private-investigator", "私家侦探", 9, 30, eduDexOrStr, ["技艺(摄影)", "乔装", "法律", "图书馆", ...social, "心理学", "侦查", "计算机使用", "锁匠", "射击"]),
	occupation("professor", "教授", 20, 70, edu4, ["图书馆", "语言", "母语", "心理学"]),
	occupation("soldier", "士兵", 9, 30, eduDexOrStr, ["攀爬", "游泳", "闪避", "格斗", "射击", "潜行", "生存", "急救", "机械维修", "语言"]),
	occupation("tribe-member", "部落成员", 0, 15, eduDexOrStr, ["攀爬", "格斗", "投掷", "博物学", "聆听", "神秘学", "侦查", "游泳", "生存"]),
	occupation("zealot", "狂热者", 0, 30, [points(["edu", 2], ["app", 2]), points(["edu", 2], ["pow", 2])], ["历史", ...social, "心理学", "潜行"]),
];
