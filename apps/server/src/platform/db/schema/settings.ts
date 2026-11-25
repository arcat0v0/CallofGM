import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiSettings = sqliteTable("ui_settings", {
	id: text("id").primaryKey(),
	gmThemeId: text("gm_theme_id"),
	updatedAt: integer("updated_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
	section: text("section").primaryKey(),
	valueJson: text("value_json").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const installedThemes = sqliteTable(
	"installed_themes",
	{
		key: text("key").primaryKey(),
		id: text("id").notNull(),
		version: text("version").notNull(),
		manifestJson: text("manifest_json").notNull(),
		digest: text("digest").notNull(),
		hasPreview: integer("has_preview").notNull().default(0),
		storageProvider: text("storage_provider").notNull().default("local"),
		storagePrefix: text("storage_prefix").notNull().default(""),
		filesJson: text("files_json").notNull().default("[]"),
		installedAt: integer("installed_at").notNull(),
	},
	(table) => [
		index("installed_themes_id_idx").on(table.id),
		index("installed_themes_provider_idx").on(table.storageProvider),
	],
);
