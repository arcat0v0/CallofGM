import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { anonymousPlayers } from "./identity";
import { characters } from "./characters";
import { sessions } from "./sessions";
import { handouts } from "./catalog";

export const sessionMessages = sqliteTable("session_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  senderId: text("sender_id").references(() => anonymousPlayers.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  characterId: text("character_id").references(() => characters.id),
  channel: text("channel").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  queueOrder: integer("queue_order").notNull().default(0),
  expressionKey: text("expression_key"),
  eventId: integer("event_id"),
  presentedAt: integer("presented_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: integer("created_at").notNull(),
});

export const checkRequests = sqliteTable("check_requests", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull().references(() => characters.id),
  skillKey: text("skill_key").notNull(),
  difficulty: text("difficulty").notNull(),
  bonusDice: integer("bonus_dice").notNull().default(0),
  penaltyDice: integer("penalty_dice").notNull().default(0),
  hidden: integer("hidden").notNull().default(0),
  sanLossExpression: text("san_loss_expression"),
  status: text("status").notNull().default("pending"),
  resolvedCheckResultJson: text("resolved_check_result_json"),
  createdAt: integer("created_at").notNull(),
});

export const handoutGrants = sqliteTable("handout_grants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  handoutId: text("handout_id").notNull().references(() => handouts.id, { onDelete: "cascade" }),
  isPublic: integer("is_public").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const handoutGrantRecipients = sqliteTable("handout_grant_recipients", {
  id: text("id").primaryKey(),
  grantId: text("grant_id").notNull().references(() => handoutGrants.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("handout_grant_recipients_grant_character_uq").on(table.grantId, table.characterId)]);

export const handoutReads = sqliteTable("handout_reads", {
  id: text("id").primaryKey(),
  grantId: text("grant_id").notNull().references(() => handoutGrants.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => anonymousPlayers.id, { onDelete: "cascade" }),
  readAt: integer("read_at").notNull(),
}, (table) => [uniqueIndex("handout_reads_grant_player_uq").on(table.grantId, table.playerId)]);
