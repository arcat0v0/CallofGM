import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiSettings = sqliteTable("ui_settings", {
	id: text("id").primaryKey(),
	gmThemeId: text("gm_theme_id"),
	updatedAt: integer("updated_at").notNull(),
});
