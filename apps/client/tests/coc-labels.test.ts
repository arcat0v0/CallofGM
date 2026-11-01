import { describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { mapActivityEvent } from "../src/lib/chat-map";
import { skillKeysFor, skillValue } from "../src/lib/coc-live";

const sheet = {
  schemaVersion: 1 as const,
  attributes: { str: 60, con: 50, siz: 60, dex: 70, app: 50, int: 65, pow: 55, edu: 80, luck: 45 },
  skills: { 侦查: 70, 聆听: 40 },
};

describe("coc7e label mapping", () => {
  test("attributes map to Chinese names, skills keep their catalog key", () => {
    expect(coc7e.coc7eSkillLabel("str")).toBe("力量");
    expect(coc7e.coc7eSkillLabel("pow")).toBe("意志");
    expect(coc7e.coc7eSkillLabel("侦查")).toBe("侦查");
    expect(coc7e.coc7eSkillLabel("unknown-key")).toBe("unknown-key");
  });

  test("attribute labels derive from the rule aliases", () => {
    expect(coc7e.COC7E_ATTRIBUTE_LABELS.str).toEqual({ label: "力量", abbr: "STR" });
    expect(coc7e.COC7E_ATTRIBUTE_LABELS.luck).toEqual({ label: "幸运", abbr: "LUCK" });
  });
});

describe("coc7e skill target values", () => {
  test("sheet values win, then attributes, then catalog base", () => {
    expect(coc7e.coc7eSkillTargetValue(sheet, "侦查")).toBe(70);
    expect(coc7e.coc7eSkillTargetValue(sheet, "str")).toBe(60);
    expect(coc7e.coc7eSkillTargetValue(sheet, "图书馆")).toBe(20);
    expect(coc7e.coc7eSkillTargetValue(sheet, "not-a-skill")).toBeNull();
  });

  test("derived catalog skills use the rule formulas", () => {
    expect(coc7e.coc7eSkillTargetValue(sheet, "闪避")).toBe(35);
    expect(coc7e.coc7eSkillTargetValue(sheet, "母语")).toBe(80);
  });
});

describe("skill list shared by dice tray and character sheet", () => {
  const character = {
    characterId: "c1",
    name: "陈默",
    kind: "pc" as const,
    currentExpressionKey: null,
    state: null,
    portraits: [],
    claim: null,
    sheet,
  };

  test("covers every attribute and catalog skill, plus sheet-only skills", () => {
    const keys = skillKeysFor({ ...character, sheet: { ...sheet, skills: { ...sheet.skills, 家传手艺: 40 } } });
    expect(keys.slice(0, 9)).toEqual(["str", "con", "siz", "dex", "app", "int", "pow", "edu", "luck"]);
    expect(keys).toContain("侦查");
    expect(keys).toContain("图书馆");
    expect(keys).toContain("家传手艺");
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("values resolve through the rule system for sheet and catalog skills", () => {
    expect(skillValue(character, "str")).toBe(60);
    expect(skillValue(character, "侦查")).toBe(70);
    expect(skillValue(character, "图书馆")).toBe(20);
    expect(skillValue(character, "急救")).toBe(30);
  });
});

describe("check result display", () => {
  test("player-facing check messages use Chinese skill labels", () => {
    const message = mapActivityEvent(
      "check:resolved",
      {
        characterId: "c1",
        characterName: "陈默",
        skillKey: "str",
        hidden: false,
        result: { roll: 18, targetValue: 60, outcome: "hard_success" },
      },
      7,
      1_700_000_000_000,
    );
    expect(message?.body).toBe("力量 18/60 · 困难成功");
  });

  test("SAN checks keep their dedicated wording", () => {
    const message = mapActivityEvent(
      "check:resolved",
      {
        characterId: "c1",
        characterName: "陈默",
        skillKey: "san",
        hidden: false,
        result: { roll: 42, loss: 3, sanAfter: 45, success: true },
      },
      8,
      1_700_000_000_000,
    );
    expect(message?.body).toBe("理智检定 42 · 成功 · 损失 3 → SAN 45");
  });
});