import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { modules, scenes, tracks } from "./catalog";
import { characters } from "./characters";
import { anonymousPlayers, users } from "./identity";

export const sessions = sqliteTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		name: text("name"),
		moduleId: text("module_id")
			.notNull()
			.references(() => modules.id),
		ruleId: text("rule_id").notNull(),
		status: text("status").notNull(),
		phase: text("phase").notNull(),
		currentSceneId: text("current_scene_id").references(() => scenes.id),
		lastEventId: integer("last_event_id").notNull().default(0),
		sharePcSheets: integer("share_pc_sheets").notNull().default(1),
		obSeePcState: integer("ob_see_pc_state").notNull().default(1),
		portraitLayout: text("portrait_layout").notNull().default("auto"),
		portraitScale: text("portrait_scale").notNull().default("md"),
		growthConfirmedAt: integer("growth_confirmed_at"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("sessions_owner_idx").on(table.ownerId),
		index("sessions_deleted_idx").on(table.deletedAt),
	],
);

export const sessionCharacters = sqliteTable(
	"session_characters",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		kind: text("kind").notNull(),
		name: text("name").notNull(),
		background: text("background").notNull().default(""),
		ruleId: text("rule_id").notNull(),
		sheetJson: text("sheet_json").notNull(),
		baseSheetVersion: integer("base_sheet_version").notNull(),
		baseProfileVersion: integer("base_profile_version").notNull(),
		currentExpressionKey: text("current_expression_key"),
		stateJson: text("state_json").notNull(),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("session_characters_session_character_uq").on(
			table.sessionId,
			table.characterId,
		),
		index("session_characters_deleted_idx").on(table.deletedAt),
	],
);

export const sessionClaims = sqliteTable(
	"session_claims",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		holderKind: text("holder_kind").notNull(),
		playerId: text("player_id").references(() => anonymousPlayers.id),
		userId: text("user_id").references(() => users.id),
		role: text("role").notNull(),
		characterId: text("character_id").references(() => characters.id),
		releasedAt: integer("released_at"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("session_claims_active_character_uq")
			.on(table.sessionId, table.characterId)
			.where(
				sql`${table.releasedAt} is null and ${table.characterId} is not null`,
			),
		uniqueIndex("session_claims_active_player_uq")
			.on(table.sessionId, table.playerId)
			.where(
				sql`${table.releasedAt} is null and ${table.playerId} is not null`,
			),
		uniqueIndex("session_claims_active_user_uq")
			.on(table.sessionId, table.userId)
			.where(sql`${table.releasedAt} is null and ${table.userId} is not null`),
	],
);

export const sessionKicks = sqliteTable(
	"session_kicks",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		holderKind: text("holder_kind").notNull(),
		playerId: text("player_id").references(() => anonymousPlayers.id),
		userId: text("user_id").references(() => users.id),
		reason: text("reason"),
		createdAt: integer("created_at").notNull(),
		liftedAt: integer("lifted_at"),
	},
	(table) => [
		uniqueIndex("session_kicks_active_player_uq")
			.on(table.sessionId, table.playerId)
			.where(sql`${table.liftedAt} is null and ${table.playerId} is not null`),
		uniqueIndex("session_kicks_active_user_uq")
			.on(table.sessionId, table.userId)
			.where(sql`${table.liftedAt} is null and ${table.userId} is not null`),
	],
);

export const sessionAudioState = sqliteTable(
	"session_audio_state",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		trackId: text("track_id").references(() => tracks.id),
		playing: integer("playing").notNull(),
		volume: integer("volume").notNull().default(100),
		loop: integer("loop").notNull(),
		seekOffsetMs: integer("seek_offset_ms").notNull().default(0),
		startedAtMs: integer("started_at_ms").notNull().default(0),
		version: integer("version").notNull().default(0),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("session_audio_state_session_uq").on(table.sessionId),
	],
);

export const sessionOutbox = sqliteTable(
	"session_outbox",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		eventId: integer("event_id").notNull(),
		type: text("type").notNull(),
		payloadJson: text("payload_json").notNull(),
		/** 事件可见范围（realtime VisibilityScope JSON），补发与快照历史共用同一套过滤 */
		visibilityJson: text("visibility_json")
			.notNull()
			.default('{"type":"public"}'),
		status: text("status").notNull().default("pending"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("session_outbox_session_event_uq").on(
			table.sessionId,
			table.eventId,
		),
	],
);
