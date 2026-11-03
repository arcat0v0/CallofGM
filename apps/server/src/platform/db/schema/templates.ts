import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./catalog";
import { characters } from "./characters";
import { users } from "./identity";

export const templates = sqliteTable(
	"templates",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		ruleId: text("rule_id").notNull(),
		themeId: text("theme_id"),
		settingsJson: text("settings_json").notNull(),
		currentVersion: integer("current_version").notNull().default(1),
		sourceModuleId: text("source_module_id"),
		sourceTemplateId: text("source_template_id"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("templates_owner_idx").on(table.ownerId),
		index("templates_deleted_idx").on(table.deletedAt),
	],
);

export const templateVersions = sqliteTable(
	"template_versions",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		version: integer("version").notNull(),
		note: text("note"),
		snapshotJson: text("snapshot_json").notNull(),
		createdByUserId: text("created_by_user_id").references(() => users.id),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("template_versions_template_version_uq").on(
			table.templateId,
			table.version,
		),
	],
);

export const templateScenes = sqliteTable(
	"template_scenes",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull(),
		bgAssetId: text("bg_asset_id").references(() => mediaAssets.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("template_scenes_template_idx").on(table.templateId)],
);

export const templateTracks = sqliteTable(
	"template_tracks",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		name: text("name").notNull(),
		audioAssetId: text("audio_asset_id")
			.notNull()
			.references(() => mediaAssets.id),
		type: text("type").notNull(),
		duration: integer("duration").notNull().default(0),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("template_tracks_template_idx").on(table.templateId)],
);

export const templateHandouts = sqliteTable(
	"template_handouts",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		title: text("title").notNull(),
		content: text("content").notNull(),
		imageAssetId: text("image_asset_id").references(() => mediaAssets.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("template_handouts_template_idx").on(table.templateId)],
);

export const templateCharacters = sqliteTable(
	"template_characters",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => templates.id),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("template_characters_template_character_uq").on(
			table.templateId,
			table.characterId,
		),
		index("template_characters_template_idx").on(table.templateId),
	],
);
