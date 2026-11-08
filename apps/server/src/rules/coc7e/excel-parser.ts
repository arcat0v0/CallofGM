import { coc7e } from "@cogm/shared";
import * as xlsx from "xlsx";
import type { CharacterSheetPreview } from "@/rules/rule-system";

type Sheet = coc7e.Coc7eCharacterSheet;
type Cell = xlsx.CellObject | undefined;
type Patch = Record<string, unknown>;

const ATTRIBUTE_KEYS = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
] as const;

const CORE_ATTRIBUTES = new Set([
	"str",
	"con",
	"siz",
	"dex",
	"int",
	"pow",
	"edu",
]);

const MAIN_ATTRIBUTE_CELLS: Record<(typeof ATTRIBUTE_KEYS)[number], string> = {
	str: "U3",
	con: "U5",
	siz: "U7",
	dex: "AA3",
	app: "AA5",
	int: "AA7",
	pow: "AG3",
	edu: "AG5",
	luck: "AG7",
};

const SIMPLE_ATTRIBUTE_CELLS: Record<(typeof ATTRIBUTE_KEYS)[number], string> =
	{
		str: "C3",
		con: "C5",
		siz: "L5",
		dex: "F3",
		app: "F5",
		int: "L3",
		pow: "I3",
		edu: "I5",
		luck: "I9",
	};

function text(cell: Cell): string {
	if (!cell || cell.v === undefined || cell.v === null) {
		return "";
	}
	return String(cell.v).trim();
}

function integer(cell: Cell): number | null {
	if (!cell || cell.v === undefined || cell.v === null) {
		return null;
	}
	if (typeof cell.v === "number") {
		return Number.isFinite(cell.v) ? Math.trunc(cell.v) : null;
	}
	if (typeof cell.v === "string") {
		const value = Number.parseInt(cell.v.trim(), 10);
		return Number.isNaN(value) ? null : value;
	}
	return null;
}

function money(cell: Cell): number | null {
	if (!cell || cell.v === undefined || cell.v === null) {
		return null;
	}
	if (typeof cell.v === "number") {
		return Number.isFinite(cell.v) ? cell.v : null;
	}
	if (typeof cell.v !== "string") {
		return null;
	}
	const value = cell.v.trim();
	if (!value) {
		return null;
	}
	if (/^(没有|无|——|-)$/.test(value)) {
		return 0;
	}
	const normalized = value.replace(/[,$，\s]/g, "");
	const match = normalized.match(/^(\d+(?:\.\d+)?)(万|千|百)?/);
	if (!match) {
		return null;
	}
	const multiplier =
		match[2] === "万"
			? 10000
			: match[2] === "千"
				? 1000
				: match[2] === "百"
					? 100
					: 1;
	return Math.round(Number(match[1]) * multiplier);
}

function groupLabel(value: string): string {
	return value
		.replace(/[：:]\s*$/, "")
		.replace(/[①②③④⑤⑥⑦⑧⑨]/g, "")
		.replace(/[Ω★☆]/g, "")
		.replace(/\s+/g, "")
		.trim();
}

function resolveSkill(
	label: string,
	detail = "",
): { key: string; custom: boolean } | null {
	const cleaned = groupLabel(label);
	if (!cleaned || /^[—-]+$/.test(cleaned)) {
		return null;
	}
	const inlineDetail =
		detail.trim() || label.split(/[：:]/).slice(1).join("：").trim();
	const canonical = coc7e.canonicalizeCoc7eSkillKey(cleaned);
	if (canonical) {
		return { key: canonical, custom: false };
	}
	const group = Object.keys(coc7e.COC7E_SKILL_GROUP_ALIASES).find(
		(name) =>
			cleaned === name ||
			coc7e.COC7E_SKILL_GROUP_ALIASES[name]?.includes(cleaned),
	);
	if (group && inlineDetail) {
		const candidate = `${group}(${inlineDetail})`;
		return {
			key: coc7e.canonicalizeCoc7eSkillKey(candidate) ?? candidate,
			custom: coc7e.canonicalizeCoc7eSkillKey(candidate) === null,
		};
	}
	if (group && !inlineDetail) {
		return null;
	}
	const matched = coc7e.matchCoc7eSkillCell(cleaned);
	if (matched) {
		return { key: matched, custom: false };
	}
	if (cleaned.length > 100 || /[\n\r]/.test(cleaned)) {
		return null;
	}
	return { key: cleaned, custom: true };
}

function baseSkills(sheet: Sheet): Record<string, number> {
	const skills: Record<string, number> = {};
	for (const entry of coc7e.COC7E_SKILL_CATALOG) {
		const base = coc7e.coc7eSkillBaseValue(sheet, entry.key);
		if (base !== null) {
			skills[entry.key] = base;
		}
	}
	return skills;
}

function skillDetail(
	patch: Patch,
	key: string,
	value: number,
	provided: boolean,
	customBase: number | null,
	custom: boolean,
) {
	const skills = (patch.skills as Record<string, number> | undefined) ?? {};
	const customSkills =
		(patch.customSkills as Record<string, { base: number }> | undefined) ?? {};
	if (provided) {
		skills[key] = value;
		patch.skills = skills;
	}
	if (custom && customBase !== null) {
		customSkills[key] = { base: customBase };
		patch.customSkills = customSkills;
	}
}

function templateAttributes(
	worksheet: xlsx.WorkSheet,
	cells: Record<(typeof ATTRIBUTE_KEYS)[number], string>,
	attributes: Record<string, number>,
	errors: Array<{ cell: string; message: string }>,
	patch: Patch,
) {
	for (const key of ATTRIBUTE_KEYS) {
		const address = cells[key];
		const value = integer(worksheet[address]);
		if (value !== null && value >= 1 && value <= 99) {
			attributes[key] = value;
			const provided = new Set(
				(patch.providedFields as string[] | undefined) ?? [],
			);
			provided.add(`attributes.${key}`);
			patch.providedFields = [...provided];
			patch.attributes = {
				...((patch.attributes as Record<string, number> | undefined) ?? {}),
				[key]: value,
			};
			continue;
		}
		if (CORE_ATTRIBUTES.has(key)) {
			errors.push({
				cell: address,
				message: `关键属性 ${key.toUpperCase()} 缺失或无效 (必须在 1-99 之间)`,
			});
		}
	}
}

function parseTemplateSkillRow(
	worksheet: xlsx.WorkSheet,
	row: number,
	nameColumn: string,
	detailColumn: string | null,
	baseColumn: string,
	totalColumn: string,
	investmentColumns: string[],
	attributes: Record<string, number>,
	patch: Patch,
	fullSkills: Record<string, number>,
	skillProvided: Set<string>,
) {
	const address = (column: string) => `${column}${row}`;
	const label = text(worksheet[address(nameColumn)]);
	if (!label) {
		return;
	}
	const detail = detailColumn ? text(worksheet[address(detailColumn)]) : "";
	const resolved = resolveSkill(label, detail);
	if (!resolved) {
		return;
	}
	const base = integer(worksheet[address(baseColumn)]);
	const total = integer(worksheet[address(totalColumn)]);
	const invested = investmentColumns
		.map((column) => integer(worksheet[address(column)]) ?? 0)
		.reduce((sum, value) => sum + Math.max(0, value), 0);
	const reference = coc7e.createEmptyCoc7eSheet({
		str: attributes.str ?? 50,
		con: attributes.con ?? 50,
		siz: attributes.siz ?? 50,
		dex: attributes.dex ?? 50,
		app: attributes.app ?? 50,
		int: attributes.int ?? 50,
		pow: attributes.pow ?? 50,
		edu: attributes.edu ?? 50,
		luck: attributes.luck ?? 50,
	});
	const fallbackBase = coc7e.coc7eSkillBaseValue(reference, resolved.key) ?? 0;
	const effectiveBase = base !== null && base >= 0 ? base : fallbackBase;
	let effectiveTotal =
		total !== null && total >= 0 && total <= 999 ? total : null;
	if (effectiveTotal === null && invested > 0) {
		effectiveTotal = effectiveBase + invested;
	}
	if (effectiveTotal === null) {
		effectiveTotal = effectiveBase;
	}
	if (total !== null && total === 0 && effectiveBase > 0 && invested === 0) {
		effectiveTotal = effectiveBase;
	}
	if (resolved.custom && effectiveBase === 0 && effectiveTotal === 0) {
		return;
	}
	fullSkills[resolved.key] = effectiveTotal;
	const provided =
		skillProvided.size < 2000 &&
		(invested > 0 || effectiveTotal !== effectiveBase || resolved.custom);
	if (provided) {
		skillDetail(
			patch,
			resolved.key,
			effectiveTotal,
			true,
			resolved.custom ? effectiveBase : null,
			resolved.custom,
		);
		skillProvided.add(resolved.key);
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			`skills.${resolved.key}`,
		];
	}
}

function parseTemplateWeapons(
	worksheet: xlsx.WorkSheet,
	patch: Patch,
	warnings: Array<{ cell: string; message: string }>,
) {
	const weapons: unknown[] = [];
	for (let row = 53; row <= 57; row += 1) {
		const address = (column: string) => `${column}${row}`;
		const name = text(worksheet[address("B")]);
		if (!name || name === "无") {
			continue;
		}
		const skillText = text(worksheet[address("M")]);
		const skill = resolveSkill(skillText);
		const damage = text(worksheet[address("W")]);
		if (!skill || !damage) {
			warnings.push({
				cell: `${row} 行`,
				message: `武器「${name}」缺少关联技能或伤害，已跳过`,
			});
			continue;
		}
		const ammo = integer(worksheet[address("AG")]);
		const malfunction = integer(worksheet[address("AJ")]);
		weapons.push({
			name,
			skillKey: skill.key,
			damage,
			range: text(worksheet[address("AA")]),
			attacks: text(worksheet[address("AE")]),
			ammo: ammo !== null && ammo >= 0 && ammo <= 999 ? ammo : null,
			malfunction:
				malfunction !== null && malfunction >= 0 && malfunction <= 999
					? malfunction
					: null,
			impale: /^(√|✓|是|true)$/i.test(text(worksheet[address("AC")])),
			applyDamageBonus: /db|伤害加值/i.test(damage),
		});
	}
	if (weapons.length > 0) {
		patch.weapons = weapons;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"weapons",
		];
	}
}

function parseTemplateAssets(worksheet: xlsx.WorkSheet, patch: Patch) {
	const currency = text(worksheet.S62);
	const spendingLevel = money(worksheet.I62);
	const cash = money(worksheet.O62);
	const otherAssets = money(worksheet.L62);
	const assets: Record<string, unknown> = {};
	if (currency) {
		assets.currency = currency;
	}
	if (spendingLevel !== null) {
		assets.spendingLevel = spendingLevel;
	}
	if (cash !== null) {
		assets.cash = cash;
	}
	if (otherAssets !== null) {
		assets.otherAssets = otherAssets;
	}
	if (Object.keys(assets).length > 0) {
		patch.assets = assets;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"assets",
		];
	}
}

function parseTemplateGear(worksheet: xlsx.WorkSheet, patch: Patch) {
	const gear: Array<{ name: string; quantity: number }> = [];
	for (let row = 79; row <= 94; row += 1) {
		for (const column of ["F", "N"]) {
			const name = text(worksheet[`${column}${row}`]);
			if (!name || /^(——|无|物品名称)$/.test(name)) {
				continue;
			}
			gear.push({ name, quantity: 1 });
		}
	}
	if (gear.length > 0) {
		patch.gear = gear;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"gear",
		];
	}
}

function parseTemplateSpells(worksheet: xlsx.WorkSheet, patch: Patch) {
	const spells: unknown[] = [];
	for (let row = 114; row <= 117; row += 1) {
		const name = text(worksheet[`Y${row}`]);
		if (!name) {
			continue;
		}
		const cost = text(worksheet[`AC${row}`]);
		const mpMatch = cost.match(/(\d+(?:\s*[dD]\d+)?)\s*mp/i);
		const sanMatch = cost.match(/(\d+(?:\s*[dD]\d+)?)\s*san/i);
		const castingTime = cost
			.replace(/\d+(?:\s*[dD]\d+)?\s*mp/gi, "")
			.replace(/\d+(?:\s*[dD]\d+)?\s*san/gi, "")
			.trim();
		spells.push({
			name,
			mpCost: mpMatch?.[1] ?? "",
			sanCost: sanMatch?.[1] ?? "",
			castingTime,
			effect: text(worksheet[`AH${row}`]),
		});
	}
	if (spells.length > 0) {
		patch.spells = spells;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"spells",
		];
	}
}

function parseTemplateEncounters(worksheet: xlsx.WorkSheet, patch: Patch) {
	const encounters: unknown[] = [];
	for (let row = 98; row <= 110; row += 1) {
		const name = text(worksheet[`W${row}`]);
		if (!name || name.startsWith("例：")) {
			continue;
		}
		const result = text(worksheet[`AA${row}`]);
		const notes = text(worksheet[`AK${row}`]);
		const sanMatches = [
			...result.matchAll(
				/SAN(?:[（(][^)）]*[)）])?\s*[-−]\s*(\d+(?:\s*[dD]\d+)?)/gi,
			),
		];
		const mythosMatch = result.match(/克苏鲁(?:神话)?\s*\+\s*(\d+)/i);
		encounters.push({
			name,
			sanLoss: sanMatches
				.map((match) => match[1]?.replace(/\s/g, ""))
				.join("/"),
			mythosGain: mythosMatch ? Number(mythosMatch[1]) : 0,
			count: 1,
			notes: [result, notes].filter(Boolean).join("\n"),
		});
	}
	if (encounters.length > 0) {
		patch.encounters = encounters;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"encounters",
		];
	}
}

function applyTemplateOtherFields(
	worksheet: xlsx.WorkSheet,
	patch: Patch,
	warnings: Array<{ cell: string; message: string }>,
) {
	const age = integer(worksheet.E4);
	if (age !== null && age >= 15 && age <= 90) {
		patch.age = age;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"age",
		];
	}
	const eraText = text(worksheet.M4);
	if (eraText) {
		patch.era = /1920|192\d/.test(eraText) ? "1920s" : "modern";
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"era",
		];
	}
	const occupationName = text(worksheet.E5);
	if (occupationName) {
		const normalizedName = occupationName.replace(/[（(][^）)]*[）)]/g, "");
		const preset =
			coc7e.COC7E_OCCUPATIONS.find((item) => item.name === occupationName) ??
			coc7e.COC7E_OCCUPATIONS.find(
				(item) =>
					item.name.replace(/[（(][^）)]*[）)]/g, "") === normalizedName,
			) ??
			coc7e.COC7E_OCCUPATIONS.find(
				(item) =>
					normalizedName !== "" &&
					item.name
						.replace(/[（(][^）)]*[）)]/g, "")
						.startsWith(normalizedName),
			);
		patch.occupation = preset
			? {
					presetId: preset.id,
					name: preset.name,
					skillPointFormula: [...(preset.skillPointOptions[0] ?? [])],
					creditMin: preset.creditMin,
					creditMax: preset.creditMax,
					skillKeys: [...preset.fixedSkillKeys],
					choiceSelections: {},
					freeSkillKeys: [],
				}
			: {
					presetId: null,
					name: occupationName,
					skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
					creditMin: 0,
					creditMax: 99,
					skillKeys: [],
					choiceSelections: {},
					freeSkillKeys: [],
				};
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"occupation",
		];
	} else {
		warnings.push({ cell: "E5", message: "未读取到职业名称" });
	}
}

function parseMainTemplate(
	worksheet: xlsx.WorkSheet,
	attributes: Record<string, number>,
	errors: Array<{ cell: string; message: string }>,
	patch: Patch,
	fullSkills: Record<string, number>,
	skillProvided: Set<string>,
	warnings: Array<{ cell: string; message: string }>,
) {
	templateAttributes(
		worksheet,
		MAIN_ATTRIBUTE_CELLS,
		attributes,
		errors,
		patch,
	);
	for (let row = 16; row <= 49; row += 1) {
		parseTemplateSkillRow(
			worksheet,
			row,
			"F",
			"H",
			"J",
			"R",
			["L", "N", "P"],
			attributes,
			patch,
			fullSkills,
			skillProvided,
		);
		parseTemplateSkillRow(
			worksheet,
			row,
			"AB",
			"AD",
			"AF",
			"AN",
			["AH", "AJ", "AL"],
			attributes,
			patch,
			fullSkills,
			skillProvided,
		);
	}
	const name = text(worksheet.E3);
	applyTemplateOtherFields(worksheet, patch, warnings);
	parseTemplateWeapons(worksheet, patch, warnings);
	parseTemplateAssets(worksheet, patch);
	parseTemplateGear(worksheet, patch);
	parseTemplateSpells(worksheet, patch);
	parseTemplateEncounters(worksheet, patch);
	return name;
}

function parseSimpleSkills(
	worksheet: xlsx.WorkSheet,
	patch: Patch,
	fullSkills: Record<string, number>,
	skillProvided: Set<string>,
) {
	for (let row = 3; row <= 36; row += 1) {
		for (const [nameColumn, valueColumn] of [
			["N", "Q"],
			["T", "W"],
		]) {
			const label = text(worksheet[`${nameColumn}${row}`]);
			if (!label || /^\d+$/.test(label)) {
				continue;
			}
			const value = integer(worksheet[`${valueColumn}${row}`]);
			if (value === null || value <= 0 || value > 999) {
				continue;
			}
			const resolved = resolveSkill(label);
			if (!resolved) {
				continue;
			}
			fullSkills[resolved.key] = value;
			if (resolved.custom) {
				skillDetail(patch, resolved.key, value, true, 0, true);
			} else {
				skillDetail(patch, resolved.key, value, true, null, false);
			}
			skillProvided.add(resolved.key);
			patch.providedFields = [
				...((patch.providedFields as string[] | undefined) ?? []),
				`skills.${resolved.key}`,
			];
		}
	}
}

function parseSimpleAssets(worksheet: xlsx.WorkSheet, patch: Patch) {
	const currency = text(worksheet.M19);
	const spendingLevel = money(worksheet.G19);
	const cash = money(worksheet.K19);
	const otherAssets = money(worksheet.I19);
	const assets: Record<string, unknown> = {};
	if (currency) {
		assets.currency = currency;
	}
	if (spendingLevel !== null) {
		assets.spendingLevel = spendingLevel;
	}
	if (cash !== null) {
		assets.cash = cash;
	}
	if (otherAssets !== null) {
		assets.otherAssets = otherAssets;
	}
	if (Object.keys(assets).length > 0) {
		patch.assets = assets;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"assets",
		];
	}
}

function parseSimpleGear(worksheet: xlsx.WorkSheet, patch: Patch) {
	const gear: Array<{ name: string; quantity: number }> = [];
	for (let row = 22; row <= 26; row += 1) {
		for (const column of ["B", "E", "H", "K"]) {
			const name = text(worksheet[`${column}${row}`]);
			if (!name || /^\d+$/.test(name) || name === "无") {
				continue;
			}
			gear.push({ name, quantity: 1 });
		}
	}
	if (gear.length > 0) {
		patch.gear = gear;
		patch.providedFields = [
			...((patch.providedFields as string[] | undefined) ?? []),
			"gear",
		];
	}
}

function parseSimplifiedTemplate(
	worksheet: xlsx.WorkSheet,
	attributes: Record<string, number>,
	errors: Array<{ cell: string; message: string }>,
	patch: Patch,
	fullSkills: Record<string, number>,
	skillProvided: Set<string>,
) {
	templateAttributes(
		worksheet,
		SIMPLE_ATTRIBUTE_CELLS,
		attributes,
		errors,
		patch,
	);
	parseSimpleSkills(worksheet, patch, fullSkills, skillProvided);
	const summary = text(worksheet.B2);
	const name = summary.split("，")[0]?.trim() ?? "";
	const ageMatch = summary.match(/(\d+)\s*岁/);
	if (ageMatch) {
		const value = Number(ageMatch[1]);
		if (value >= 15 && value <= 90) {
			patch.age = value;
		}
	}
	if (summary.includes("现代")) {
		patch.era = "modern";
	}
	parseSimpleAssets(worksheet, patch);
	parseSimpleGear(worksheet, patch);
	return name;
}

function mergeTemplateSkills(
	attributes: Record<string, number>,
	fullSkills: Record<string, number>,
	provided: Record<string, number>,
) {
	const sheet = coc7e.createEmptyCoc7eSheet({
		str: attributes.str ?? 50,
		con: attributes.con ?? 50,
		siz: attributes.siz ?? 50,
		dex: attributes.dex ?? 50,
		app: attributes.app ?? 50,
		int: attributes.int ?? 50,
		pow: attributes.pow ?? 50,
		edu: attributes.edu ?? 50,
		luck: attributes.luck ?? 50,
	});
	return { ...baseSkills(sheet), ...fullSkills, ...provided };
}

function buildTemplatePreview(
	workbook: xlsx.WorkBook,
	partial: boolean,
): CharacterSheetPreview<Sheet> | null {
	const main = workbook.Sheets["人物卡"];
	const simplified = workbook.Sheets["简化卡"];
	if (!main && !simplified) {
		return null;
	}
	const attributes: Record<string, number> = {};
	const errors: Array<{ cell: string; message: string }> = [];
	const warnings: Array<{ cell: string; message: string }> = [];
	const patch: Patch = { schemaVersion: 2, partial };
	const fullSkills: Record<string, number> = {};
	const skillProvided = new Set<string>();
	const characterName = main
		? parseMainTemplate(
				main,
				attributes,
				errors,
				patch,
				fullSkills,
				skillProvided,
				warnings,
			)
		: simplified
			? parseSimplifiedTemplate(
					simplified,
					attributes,
					errors,
					patch,
					fullSkills,
					skillProvided,
				)
			: "";
	if (partial) {
		for (let index = errors.length - 1; index >= 0; index -= 1) {
			if (/关键属性/.test(errors[index]?.message ?? "")) {
				errors.splice(index, 1);
			}
		}
	}
	const sheetData = coc7e.normalizeCoc7eSheet({
		...patch,
		attributes: {
			str: attributes.str ?? 50,
			con: attributes.con ?? 50,
			siz: attributes.siz ?? 50,
			dex: attributes.dex ?? 50,
			app: attributes.app ?? 50,
			int: attributes.int ?? 50,
			pow: attributes.pow ?? 50,
			edu: attributes.edu ?? 50,
			luck: attributes.luck ?? 50,
		},
		skills: mergeTemplateSkills(attributes, fullSkills, {}),
		customSkills:
			(patch.customSkills as Record<string, { base: number }> | undefined) ??
			{},
	});
	const nameProvided = characterName.length > 0;
	return {
		characterName: nameProvided ? characterName : "无名氏",
		sheetData,
		errors,
		warnings,
		patch,
		providedFields: (patch.providedFields as string[] | undefined) ?? [],
		nameProvided,
	};
}

function parseGenericWorkbook(
	workbook: xlsx.WorkBook,
	partial: boolean,
): CharacterSheetPreview<Sheet> {
	let characterName = "";
	let nameProvided = false;
	const attributes: Record<string, number> = {};
	const skills: Record<string, number> = {};
	const errors: Array<{ cell: string; message: string }> = [];
	const warnings: Array<{ cell: string; message: string }> = [];
	const providedFields: string[] = [];
	const nameQueries = [
		"姓名",
		"角色姓名",
		"调查员姓名",
		"name",
		"character name",
	];
	const normalizeNameLabel = (value: string): string =>
		value
			.trim()
			.toLowerCase()
			.replace(/[:：]\s*$/, "");
	const findAdjacentNumber = (
		rows: unknown[][],
		row: number,
		column: number,
	): number | null => {
		for (let offset = 1; offset <= 3; offset += 1) {
			const value = rows[row]?.[column + offset];
			if (
				value !== undefined &&
				value !== null &&
				String(value).trim() !== ""
			) {
				const parsed = integer({ v: value } as xlsx.CellObject);
				if (parsed !== null) {
					return parsed;
				}
				break;
			}
		}
		for (let offset = 1; offset <= 3; offset += 1) {
			const value = rows[row + offset]?.[column];
			if (
				value !== undefined &&
				value !== null &&
				String(value).trim() !== ""
			) {
				const parsed = integer({ v: value } as xlsx.CellObject);
				if (parsed !== null) {
					return parsed;
				}
				break;
			}
		}
		return null;
	};
	const readAdjacentName = (
		rows: unknown[][],
		row: number,
		column: number,
	): string | null => {
		const value = rows[row]?.[column + 1] ?? rows[row + 1]?.[column];
		if (value === undefined || value === null) {
			return null;
		}
		const cleaned = String(value).trim();
		if (!cleaned || /^(str|con)$/i.test(cleaned)) {
			return null;
		}
		return cleaned;
	};
	for (const name of workbook.SheetNames) {
		const worksheet = workbook.Sheets[name];
		if (!worksheet) {
			continue;
		}
		const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
		if (!nameProvided) {
			for (let row = 0; row < rows.length && !nameProvided; row += 1) {
				const values = rows[row];
				if (!values) {
					continue;
				}
				for (let column = 0; column < values.length; column += 1) {
					const value = values[column];
					if (value === undefined || value === null) {
						continue;
					}
					const normalized = normalizeNameLabel(String(value));
					const exactLabel = nameQueries.find(
						(query) => query.toLowerCase() === normalized,
					);
					if (exactLabel) {
						const adjacent = readAdjacentName(rows, row, column);
						if (adjacent) {
							characterName = adjacent;
							nameProvided = true;
							break;
						}
						continue;
					}
					const skip = /玩家姓名|玩家名字|player name/.test(normalized);
					const fuzzyLabel = nameQueries.find((query) =>
						normalized.includes(query.toLowerCase()),
					);
					if (fuzzyLabel && !skip) {
						const adjacent = readAdjacentName(rows, row, column);
						if (adjacent) {
							characterName = adjacent;
							nameProvided = true;
							warnings.push({
								cell: xlsx.utils.encode_cell({ r: row, c: column }),
								message: `姓名标签「${fuzzyLabel}」为模糊匹配，请核对角色名「${adjacent}」`,
							});
							break;
						}
					}
				}
			}
		}
		for (let row = 0; row < rows.length; row += 1) {
			const values = rows[row];
			if (!values) {
				continue;
			}
			for (let column = 0; column < values.length; column += 1) {
				const value = values[column];
				if (value === undefined || value === null) {
					continue;
				}
				const label = String(value).trim();
				if (!label || label.length > 80) {
					continue;
				}
				const normalized = label.toLowerCase().replace(/[:：]\s*$/, "");
				const attributeLabel = normalized
					.replace(/\s*[（(][^)）]*[)）]\s*$/, "")
					.trim();
				for (const key of ATTRIBUTE_KEYS) {
					const aliases = coc7e.COC7E_ATTRIBUTE_ALIASES[key] ?? [];
					if (
						!aliases.some(
							(alias) =>
								attributeLabel === alias.toLowerCase() ||
								normalized === alias.toLowerCase(),
						)
					) {
						continue;
					}
					if (attributes[key] !== undefined) {
						continue;
					}
					const parsed = findAdjacentNumber(rows, row, column);
					if (parsed !== null && parsed >= 1 && parsed <= 99) {
						attributes[key] = parsed;
						providedFields.push(`attributes.${key}`);
					}
				}
				const skill = coc7e.matchCoc7eSkillCell(label);
				if (!skill || skills[skill] !== undefined) {
					continue;
				}
				let parsed = findAdjacentNumber(rows, row, column);
				if (parsed === null) {
					const trailing = label.match(/(\d{1,3})\s*$/);
					parsed = trailing ? Number(trailing[1]) : null;
				}
				if (parsed !== null && parsed >= 0 && parsed <= 999) {
					skills[skill] = parsed;
					providedFields.push(`skills.${skill}`);
				}
			}
		}
	}
	for (const key of ATTRIBUTE_KEYS) {
		if (attributes[key] !== undefined) {
			continue;
		}
		if (!partial && CORE_ATTRIBUTES.has(key)) {
			errors.push({
				cell: key.toUpperCase(),
				message: `关键属性 ${key.toUpperCase()} 缺失或无效 (必须在 1-99 之间)`,
			});
		}
		attributes[key] = 50;
	}
	const sheet = coc7e.createEmptyCoc7eSheet({
		str: attributes.str ?? 50,
		con: attributes.con ?? 50,
		siz: attributes.siz ?? 50,
		dex: attributes.dex ?? 50,
		app: attributes.app ?? 50,
		int: attributes.int ?? 50,
		pow: attributes.pow ?? 50,
		edu: attributes.edu ?? 50,
		luck: attributes.luck ?? 50,
	});
	const sheetData = coc7e.normalizeCoc7eSheet({
		...sheet,
		skills: { ...baseSkills(sheet), ...skills },
	});
	const patch: Patch = { schemaVersion: 2, partial };
	if (
		Object.keys(attributes).length > 0 &&
		providedFields.some((field) => field.startsWith("attributes."))
	) {
		patch.attributes = Object.fromEntries(
			ATTRIBUTE_KEYS.filter((key) =>
				providedFields.includes(`attributes.${key}`),
			).map((key) => [key, attributes[key]]),
		);
	}
	if (Object.keys(skills).length > 0) {
		patch.skills = skills;
	}
	return {
		characterName: nameProvided ? characterName : "无名氏",
		sheetData,
		errors,
		warnings,
		patch,
		providedFields,
		nameProvided,
	};
}

export async function parseCoc7eCharacterSheet(
	input: ArrayBuffer,
	options: { partial?: boolean } = {},
): Promise<CharacterSheetPreview<coc7e.Coc7eCharacterSheet>> {
	const workbook = xlsx.read(input, { type: "array" });
	const template = buildTemplatePreview(workbook, options.partial === true);
	if (template) {
		return template;
	}
	return parseGenericWorkbook(workbook, options.partial === true);
}
