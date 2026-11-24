import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

export const mediaAssets = sqliteTable(
	"media_assets",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		purpose: text("purpose").notNull(),
		storageProvider: text("storage_provider").notNull().default("local"),
		storageBucket: text("storage_bucket"),
		storageKey: text("storage_key").notNull(),
		filename: text("filename").notNull(),
		mimeType: text("mime_type").notNull(),
		size: integer("size").notNull(),
		sha256: text("sha256").notNull(),
		metadataJson: text("metadata_json").notNull().default("{}"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("media_assets_owner_idx").on(table.ownerId),
		index("media_assets_deleted_idx").on(table.deletedAt),
		index("media_assets_provider_idx").on(table.storageProvider),
	],
);

export const pendingMediaUploads = sqliteTable(
	"pending_media_uploads",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		purpose: text("purpose").notNull(),
		storageKey: text("storage_key").notNull(),
		storageBucket: text("storage_bucket").notNull(),
		filename: text("filename").notNull(),
		declaredContentType: text("declared_content_type").notNull(),
		expectedSize: integer("expected_size").notNull(),
		expiresAt: integer("expires_at").notNull(),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("pending_media_uploads_expires_idx").on(table.expiresAt),
		index("pending_media_uploads_owner_idx").on(table.ownerId),
	],
);

export const modules = sqliteTable(
	"modules",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		name: text("name").notNull(),
		description: text("description").notNull(),
		ruleId: text("rule_id").notNull(),
		themeId: text("theme_id"),
		sourceTemplateId: text("source_template_id"),
		sourceTemplateVersion: integer("source_template_version"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("modules_owner_idx").on(table.ownerId),
		index("modules_deleted_idx").on(table.deletedAt),
	],
);

export const scenes = sqliteTable(
	"scenes",
	{
		id: text("id").primaryKey(),
		moduleId: text("module_id")
			.notNull()
			.references(() => modules.id),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull(),
		bgAssetId: text("bg_asset_id").references(() => mediaAssets.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("scenes_deleted_idx").on(table.deletedAt)],
);

export const tracks = sqliteTable(
	"tracks",
	{
		id: text("id").primaryKey(),
		moduleId: text("module_id")
			.notNull()
			.references(() => modules.id),
		name: text("name").notNull(),
		source: text("source").notNull().default("upload"),
		externalId: text("external_id"),
		artistsJson: text("artists_json").notNull().default("[]"),
		album: text("album"),
		sourceUrl: text("source_url"),
		audioAssetId: text("audio_asset_id").references(() => mediaAssets.id),
		type: text("type").notNull(),
		duration: integer("duration").notNull().default(0),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("tracks_deleted_idx").on(table.deletedAt)],
);

export const handouts = sqliteTable(
	"handouts",
	{
		id: text("id").primaryKey(),
		moduleId: text("module_id")
			.notNull()
			.references(() => modules.id),
		title: text("title").notNull(),
		content: text("content").notNull(),
		imageAssetId: text("image_asset_id").references(() => mediaAssets.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("handouts_deleted_idx").on(table.deletedAt)],
);
