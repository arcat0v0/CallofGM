import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { mediaAssets, modules } from "./catalog";
import { gmLoginSessions } from "./identity";

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  ruleId: text("rule_id").notNull(),
  sheetJson: text("sheet_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const characterPortraits = sqliteTable("character_portraits", {
  id: text("id").primaryKey(),
  characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  expressionKey: text("expression_key").notNull(),
  portraitAssetId: text("portrait_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  isDefault: integer("is_default").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("character_portraits_character_expression_uq").on(table.characterId, table.expressionKey)]);

export const moduleCharacters = sqliteTable("module_characters", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("module_characters_module_character_uq").on(table.moduleId, table.characterId)]);

export const importStagings = sqliteTable("import_stagings", {
  id: text("id").primaryKey(),
  characterName: text("character_name").notNull(),
  sheetJson: text("sheet_json").notNull(),
  ruleId: text("rule_id").notNull(),
  errorsJson: text("errors_json").notNull().default("[]"),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
  gmSessionId: text("gm_session_id").references(() => gmLoginSessions.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
});
