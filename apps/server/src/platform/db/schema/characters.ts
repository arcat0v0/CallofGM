import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { mediaAssets, modules } from "./catalog";
import { users } from "./identity";

export const characters = sqliteTable(
	"characters",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		ownerKind: text("owner_kind").notNull(),
		name: text("name").notNull(),
		background: text("background").notNull().default(""),
		kind: text("kind").notNull(),
		ruleId: text("rule_id").notNull(),
		sheetJson: text("sheet_json").notNull(),
		sheetVersion: integer("sheet_version").notNull().default(1),
		profileVersion: integer("profile_version").notNull().default(1),
		version: integer("version").notNull().default(1),
		originType: text("origin_type"),
		originRefId: text("origin_ref_id"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("characters_owner_idx").on(table.ownerId),
		index("characters_deleted_idx").on(table.deletedAt),
	],
);

export const characterVersions = sqliteTable(
	"character_versions",
	{
		id: text("id").primaryKey(),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		version: integer("version").notNull(),
		sheetVersion: integer("sheet_version").notNull(),
		name: text("name").notNull(),
		background: text("background").notNull(),
		sheetJson: text("sheet_json").notNull(),
		actorUserId: text("actor_user_id").references(() => users.id),
		reason: text("reason").notNull(),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("character_versions_character_version_uq").on(
			table.characterId,
			table.version,
		),
	],
);

export const characterGrowthEntries = sqliteTable(
	"character_growth_entries",
	{
		id: text("id").primaryKey(),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		sessionId: text("session_id"),
		skillKey: text("skill_key").notNull(),
		oldValue: integer("old_value").notNull(),
		newValue: integer("new_value").notNull(),
		actorUserId: text("actor_user_id").references(() => users.id),
		reason: text("reason").notNull(),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("character_growth_character_idx").on(table.characterId)],
);

export const characterAudits = sqliteTable(
	"character_audits",
	{
		id: text("id").primaryKey(),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		sessionId: text("session_id"),
		gmUserId: text("gm_user_id").references(() => users.id),
		field: text("field").notNull(),
		oldValue: text("old_value").notNull(),
		newValue: text("new_value").notNull(),
		reason: text("reason"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("character_audits_character_idx").on(table.characterId)],
);

export const characterPortraits = sqliteTable(
	"character_portraits",
	{
		id: text("id").primaryKey(),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		expressionKey: text("expression_key").notNull(),
		label: text("label"),
		portraitAssetId: text("portrait_asset_id")
			.notNull()
			.references(() => mediaAssets.id),
		isDefault: integer("is_default").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("character_portraits_character_expression_uq").on(
			table.characterId,
			table.expressionKey,
		),
		index("character_portraits_deleted_idx").on(table.deletedAt),
	],
);

export const moduleCharacters = sqliteTable(
	"module_characters",
	{
		id: text("id").primaryKey(),
		moduleId: text("module_id")
			.notNull()
			.references(() => modules.id),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("module_characters_module_character_uq").on(
			table.moduleId,
			table.characterId,
		),
		index("module_characters_deleted_idx").on(table.deletedAt),
	],
);

export const importStagings = sqliteTable("import_stagings", {
	id: text("id").primaryKey(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id),
	characterName: text("character_name").notNull(),
	sheetJson: text("sheet_json").notNull(),
	patchJson: text("patch_json"),
	ruleId: text("rule_id").notNull(),
	errorsJson: text("errors_json").notNull().default("[]"),
	expiresAt: integer("expires_at").notNull(),
	consumedAt: integer("consumed_at"),
	createdAt: integer("created_at").notNull(),
});

export const characterInvites = sqliteTable(
	"character_invites",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		scope: text("scope").notNull(),
		targetId: text("target_id").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		expiresAt: integer("expires_at").notNull(),
		revokedAt: integer("revoked_at"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("character_invites_owner_idx").on(table.ownerId),
		index("character_invites_target_idx").on(table.scope, table.targetId),
	],
);

export const characterReviews = sqliteTable(
	"character_reviews",
	{
		id: text("id").primaryKey(),
		inviteId: text("invite_id").references(() => characterInvites.id),
		scope: text("scope").notNull(),
		targetId: text("target_id").notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		submittedByUserId: text("submitted_by_user_id")
			.notNull()
			.references(() => users.id),
		submittedSheetVersion: integer("submitted_sheet_version").notNull(),
		status: text("status").notNull().default("pending"),
		decisionReason: text("decision_reason"),
		decidedByUserId: text("decided_by_user_id").references(() => users.id),
		decidedAt: integer("decided_at"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("character_reviews_owner_status_idx").on(table.ownerId, table.status),
		index("character_reviews_target_idx").on(table.scope, table.targetId),
	],
);
