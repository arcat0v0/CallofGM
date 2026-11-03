import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
	"users",
	{
		id: text("id").primaryKey(),
		username: text("username").notNull(),
		usernameNormalized: text("username_normalized").notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		role: text("role").notNull(),
		disabledAt: integer("disabled_at"),
		deletedAt: integer("deleted_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [index("users_role_idx").on(table.role)],
);

export const userSessions = sqliteTable(
	"user_sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		sessionTokenHash: text("session_token_hash").notNull().unique(),
		expiresAt: integer("expires_at").notNull(),
		revokedAt: integer("revoked_at"),
		replacedBySessionId: text("replaced_by_session_id"),
		createdAt: integer("created_at").notNull(),
	},
	(table) => [index("user_sessions_user_idx").on(table.userId)],
);

export const anonymousPlayers = sqliteTable("anonymous_players", {
	id: text("id").primaryKey(),
	fingerprintHash: text("fingerprint_hash").notNull().unique(),
	firstActiveAt: integer("first_active_at").notNull(),
	lastActiveAt: integer("last_active_at").notNull(),
});

export const playerTokens = sqliteTable("player_tokens", {
	id: text("id").primaryKey(),
	tokenHash: text("token_hash").notNull().unique(),
	playerId: text("player_id").notNull(),
	expiresAt: integer("expires_at").notNull(),
	revokedAt: integer("revoked_at"),
	createdAt: integer("created_at").notNull(),
});

export const blacklistEntries = sqliteTable("blacklist_entries", {
	id: text("id").primaryKey(),
	fingerprintHash: text("fingerprint_hash").notNull().unique(),
	playerId: text("player_id"),
	userId: text("user_id"),
	displayName: text("display_name"),
	reason: text("reason").notNull(),
	/** null 表示永久封禁 */
	expiresAt: integer("expires_at"),
	createdAt: integer("created_at").notNull(),
});
