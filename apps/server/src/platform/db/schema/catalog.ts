import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  ruleId: text("rule_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  bgAssetId: text("bg_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
});

export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  audioAssetId: text("audio_asset_id").notNull().references(() => mediaAssets.id),
  type: text("type").notNull(),
  duration: integer("duration").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const handouts = sqliteTable("handouts", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageAssetId: text("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
});
