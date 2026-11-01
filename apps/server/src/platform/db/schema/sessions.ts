import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { anonymousPlayers } from "./identity";
import { modules, scenes, tracks } from "./catalog";
import { characters } from "./characters";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name"),
  moduleId: text("module_id").notNull().references(() => modules.id),
  status: text("status").notNull(),
  phase: text("phase").notNull(),
  currentSceneId: text("current_scene_id").references(() => scenes.id, { onDelete: "set null" }),
  lastEventId: integer("last_event_id").notNull().default(0),
  sharePcSheets: integer("share_pc_sheets").notNull().default(1),
  obSeePcState: integer("ob_see_pc_state").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const sessionCharacters = sqliteTable("session_characters", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull().references(() => characters.id),
  kind: text("kind").notNull(),
  currentExpressionKey: text("current_expression_key"),
  stateJson: text("state_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("session_characters_session_character_uq").on(table.sessionId, table.characterId)]);

export const sessionClaims = sqliteTable("session_claims", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => anonymousPlayers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  characterId: text("character_id").references(() => characters.id),
  releasedAt: integer("released_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("session_claims_active_character_uq")
    .on(table.sessionId, table.characterId)
    .where(sql`${table.releasedAt} is null and ${table.characterId} is not null`),
  uniqueIndex("session_claims_active_player_uq")
    .on(table.sessionId, table.playerId)
    .where(sql`${table.releasedAt} is null`),
]);

export const sessionAudioState = sqliteTable("session_audio_state", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  trackId: text("track_id").references(() => tracks.id, { onDelete: "set null" }),
  playing: integer("playing").notNull(),
  volume: integer("volume").notNull().default(100),
  loop: integer("loop").notNull(),
  seekOffsetMs: integer("seek_offset_ms").notNull().default(0),
  startedAtMs: integer("started_at_ms").notNull().default(0),
  version: integer("version").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("session_audio_state_session_uq").on(table.sessionId)]);

export const sessionOutbox = sqliteTable("session_outbox", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  /** 事件可见范围（realtime VisibilityScope JSON），补发与快照历史共用同一套过滤 */
  visibilityJson: text("visibility_json").notNull().default('{"type":"public"}'),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("session_outbox_session_event_uq").on(table.sessionId, table.eventId)]);
