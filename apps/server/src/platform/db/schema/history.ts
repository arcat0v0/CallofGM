import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sessions } from "./sessions";

export const sessionHistoryEvents = sqliteTable("session_history_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  visibilityJson: text("visibility_json").notNull(),
  playerVisible: integer("player_visible").notNull().default(1),
  anchorable: integer("anchorable").notNull().default(1),
  occurredAt: integer("occurred_at").notNull(),
  archivedAt: integer("archived_at"),
  archivedByRewindId: text("archived_by_rewind_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("session_history_events_session_event_uq").on(table.sessionId, table.eventId),
  index("session_history_events_session_event_idx").on(table.sessionId, table.eventId),
]);

export const sessionRuntimeCheckpoints = sqliteTable("session_runtime_checkpoints", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("session_runtime_checkpoints_session_event_uq").on(table.sessionId, table.eventId),
]);

export const sessionRewinds = sqliteTable("session_rewinds", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  anchorEventId: integer("anchor_event_id").notNull(),
  anchorOccurredAt: integer("anchor_occurred_at").notNull(),
  headEventIdBefore: integer("head_event_id_before").notNull(),
  rewindEventId: integer("rewind_event_id"),
  targetRewindId: text("target_rewind_id"),
  reason: text("reason"),
  archivedMessageCount: integer("archived_message_count").notNull().default(0),
  archivedEventCount: integer("archived_event_count").notNull().default(0),
  discardedPendingCount: integer("discarded_pending_count").notNull().default(0),
  undoneAt: integer("undone_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("session_rewinds_session_created_idx").on(table.sessionId, table.createdAt),
]);
