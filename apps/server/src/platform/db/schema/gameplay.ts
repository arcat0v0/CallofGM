import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { handouts } from "./catalog";
import { characters } from "./characters";
import { anonymousPlayers, users } from "./identity";
import { sessions } from "./sessions";

export const sessionMessages = sqliteTable(
	"session_messages",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		senderId: text("sender_id").references(() => anonymousPlayers.id),
		senderUserId: text("sender_user_id").references(() => users.id),
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
		archivedAt: integer("archived_at"),
		archivedByRewindId: text("archived_by_rewind_id"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("session_messages_session_idx").on(table.sessionId)],
);

export const checkRequests = sqliteTable("check_requests", {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id),
	characterId: text("character_id")
		.notNull()
		.references(() => characters.id),
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
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id),
	handoutId: text("handout_id")
		.notNull()
		.references(() => handouts.id),
	isPublic: integer("is_public").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const handoutGrantRecipients = sqliteTable(
	"handout_grant_recipients",
	{
		id: text("id").primaryKey(),
		grantId: text("grant_id")
			.notNull()
			.references(() => handoutGrants.id),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("handout_grant_recipients_grant_character_uq").on(
			table.grantId,
			table.characterId,
		),
	],
);

export const handoutReads = sqliteTable(
	"handout_reads",
	{
		id: text("id").primaryKey(),
		grantId: text("grant_id")
			.notNull()
			.references(() => handoutGrants.id),
		playerId: text("player_id").references(() => anonymousPlayers.id),
		userId: text("user_id").references(() => users.id),
		readAt: integer("read_at").notNull(),
	},
	(table) => [
		uniqueIndex("handout_reads_grant_player_uq")
			.on(table.grantId, table.playerId)
			.where(sql`${table.playerId} is not null`),
		uniqueIndex("handout_reads_grant_user_uq")
			.on(table.grantId, table.userId)
			.where(sql`${table.userId} is not null`),
	],
);
