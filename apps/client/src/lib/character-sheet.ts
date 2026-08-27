import { coc7e } from "@cogm/shared";
import { mediaUrl } from "@/lib/media";
import { ATTR_LABELS, expressionLabel, initialsOf } from "@/lib/format";

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

export type CharacterPortrait = {
  id?: string;
  expressionKey: string;
  portraitAssetId: string;
  isDefault: boolean;
};

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
  portraits: CharacterPortrait[];
  derived: DerivedStats;
  attributes: Attribute[];
  skills: Skill[];
};

export type CharacterRow = {
  id: string;
  name: string;
  kind: string;
  ruleId: string;
  sheetJson: string;
  portraits?: Array<{
    id?: string;
    expressionKey: string;
    portraitAssetId: string;
    isDefault: number | boolean;
  }>;
};

const ATTR_ORDER = ["str", "con", "siz", "dex", "app", "int", "pow", "edu"] as const;

function movement(str: number, dex: number, siz: number): number {
  if (str >= siz && dex >= siz) return 9;
  if (str >= siz || dex >= siz) return 8;
  return 7;
}

export function mapCharacterRow(row: CharacterRow): GameCharacter {
  const parsed = coc7e.Coc7eCharacterSheet.safeParse(JSON.parse(row.sheetJson));
  const sheet = parsed.success ? parsed.data : null;
  const attributes = sheet?.attributes;
  const hpMax = attributes ? Math.max(1, Math.floor((attributes.con + attributes.siz) / 10)) : 1;
  const mpMax = attributes ? Math.max(0, Math.floor(attributes.pow / 5)) : 0;
  const portraits: CharacterPortrait[] = (row.portraits ?? []).map((item) => ({
    id: item.id,
    expressionKey: item.expressionKey,
    portraitAssetId: item.portraitAssetId,
    isDefault: item.isDefault === 1 || item.isDefault === true,
  }));
  const defaultPortrait = portraits.find((item) => item.isDefault) ?? portraits[0];
  const skills = Object.entries(sheet?.skills ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, highlighted: index < 6 }));

  return {
    id: row.id,
    name: row.name,
    initial: initialsOf(row.name),
    profession: "—",
    kind: row.kind === "npc" ? "NPC" : "PC",
    meta: row.ruleId,
    portrait: mediaUrl(defaultPortrait?.portraitAssetId) ?? undefined,
    expressions: portraits.length > 0 ? portraits.map((item) => expressionLabel(item.expressionKey)) : ["默认"],
    portraits,
    derived: {
      hp: { current: hpMax, max: hpMax },
      mp: { current: mpMax, max: mpMax },
      san: { current: attributes?.pow ?? 0, max: attributes?.pow ?? 0 },
      luck: attributes?.luck ?? 0,
      mov: attributes ? movement(attributes.str, attributes.dex, attributes.siz) : 8,
    },
    attributes: ATTR_ORDER.map((key) => ({
      label: ATTR_LABELS[key]!.label,
      abbr: ATTR_LABELS[key]!.abbr,
      value: attributes?.[key] ?? 0,
    })),
    skills,
  };
}
