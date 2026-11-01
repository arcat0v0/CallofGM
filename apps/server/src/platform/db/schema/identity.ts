import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const gmLoginSessions = sqliteTable("gm_login_sessions", {
  id: text("id").primaryKey(),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
});

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
  displayName: text("display_name"),
  reason: text("reason").notNull(),
  /** null 表示永久封禁 */
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
});

export const gmCredentials = sqliteTable("gm_credentials", {
  id: text("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
