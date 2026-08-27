import * as xlsx from "xlsx";
import { coc7e } from "@cogm/shared";
import type { CharacterSheetPreview } from "@/rules/rule-system";

export async function parseCoc7eCharacterSheet(input: ArrayBuffer): Promise<CharacterSheetPreview<coc7e.Coc7eCharacterSheet>> {
  const workbook = xlsx.read(input, { type: "array" });
  let characterName = "无名氏";
  const attributes: Record<string, number> = {};
  const skills: Record<string, number> = {};
  const errors: Array<{ cell: string; message: string }> = [];

  const nameQueries = ["姓名", "角色姓名", "调查员姓名", "name", "character name"];
  const attrMap = coc7e.COC7E_ATTRIBUTE_ALIASES;

  const getNumber = (val: unknown): number | null => {
    if (typeof val === "number") {
      return Math.floor(val);
    }
    if (typeof val === "string") {
      const parsed = parseInt(val.trim(), 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  const findAdjacentNumber = (rows: unknown[][], r: number, c: number): number | null => {
    for (let dc = 1; dc <= 3; dc++) {
      const val = rows[r]?.[c + dc];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        const num = getNumber(val);
        if (num !== null) return num;
        break;
      }
    }
    for (let dr = 1; dr <= 3; dr++) {
      const val = rows[r + dr]?.[c];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        const num = getNumber(val);
        if (num !== null) return num;
        break;
      }
    }
    return null;
  };

  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val === undefined || val === null) continue;
        const text = String(val).trim();
        if (!text) continue;
        if (nameQueries.some(q => text.toLowerCase() === q || text.toLowerCase() === `${q}:` || text.toLowerCase() === `${q}：` || text.toLowerCase().includes(q))) {
          const nextRow = rows[r + 1];
          const nameVal = row[c + 1] || (nextRow && nextRow[c]);
          if (nameVal !== undefined && nameVal !== null) {
            const cleanedName = String(nameVal).trim();
            if (cleanedName && cleanedName.toLowerCase() !== "str" && cleanedName.toLowerCase() !== "con") {
              characterName = cleanedName;
            }
          }
        }

        for (const [key, terms] of Object.entries(attrMap)) {
          if (terms.some(term => text.toLowerCase() === term || text.toLowerCase() === `${term.toLowerCase()}:` || text.toLowerCase() === `${term.toLowerCase()}：` || text.includes(term))) {
            const num = findAdjacentNumber(rows, r, c);
            if (num !== null && num >= 1 && num <= 99) {
              if (attributes[key] === undefined) {
                attributes[key] = num;
              }
            }
          }
        }

        const skillKey = coc7e.matchCoc7eSkillCell(text);
        if (skillKey) {
          let num = findAdjacentNumber(rows, r, c);
          if (num === null) {
            const trailing = text.match(/(\d{1,2})\s*$/);
            num = trailing ? getNumber(trailing[1]) : null;
          }
          if (num !== null && num >= 0 && num <= 99 && skills[skillKey] === undefined) {
            skills[skillKey] = num;
          }
        }
      }
    }
  }

  const keys = ["str", "con", "siz", "dex", "app", "int", "pow", "edu", "luck"] as const;
  const criticals: Record<string, true> = { con: true, siz: true, pow: true };
  for (const key of keys) {
    if (attributes[key] === undefined) {
      if (criticals[key]) {
        errors.push({
          cell: key.toUpperCase(),
          message: `关键属性 ${key.toUpperCase()} 缺失或无效 (必须在 1-99 之间)`,
        });
      } else {
        errors.push({
          cell: key.toUpperCase(),
          message: `属性 ${key.toUpperCase()} 缺失`,
        });
      }
      attributes[key] = 50;
    }
  }

  const dex = attributes.dex ?? 50;
  const edu = attributes.edu ?? 50;
  for (const skill of coc7e.COC7E_SKILL_CATALOG) {
    if (skills[skill.key] !== undefined) {
      continue;
    }
    if (skill.key === "闪避") {
      skills[skill.key] = Math.max(1, Math.min(99, Math.floor(dex / 2)));
    } else if (skill.key === "母语") {
      skills[skill.key] = Math.max(1, Math.min(99, edu));
    } else {
      skills[skill.key] = skill.base;
    }
  }

  const sheetData: coc7e.Coc7eCharacterSheet = {
    schemaVersion: 1,
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
    skills,
  };

  return {
    characterName,
    sheetData,
    errors,
  };
}
