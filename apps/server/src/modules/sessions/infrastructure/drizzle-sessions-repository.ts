import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	or,
	sql,
} from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	anonymousPlayers,
	characterReviews,
	characters,
	moduleCharacters,
	modules,
	sessionCharacters,
	sessionClaims,
	sessionKicks,
	sessionRuntimeCheckpoints,
	sessions,
	users,
} from "@/platform/db/schema";
import type {
	ClaimRecord,
	SeatHolderInput,
	SessionCharacterOwnerState,
	SessionCharacterReviewState,
	SessionKickInput,
	SessionKickRecord,
	SessionsRepository,
} from "../application/ports";

function holderCondition(
	holder: SeatHolderInput,
	table: typeof sessionClaims | typeof sessionKicks,
) {
	return holder.holderKind === "user"
		? eq(table.userId, holder.userId!)
		: eq(table.playerId, holder.playerId!);
}

export class DrizzleSessionsRepository implements SessionsRepository {
	constructor(private readonly db: DbClient) {}

	async findSessionById(id: string, db: DbClient = this.db) {
		const result = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, id))
			.limit(1);
		return result[0] ?? null;
	}

	async findActiveSessionById(id: string, db: DbClient = this.db) {
		const result = await db
			.select()
			.from(sessions)
			.where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
			.limit(1);
		return result[0] ?? null;
	}

	async findActiveSessionIdsByPrefix(
		prefix: string,
		limit: number,
		db: DbClient = this.db,
	): Promise<string[]> {
		const normalized = prefix.toLowerCase();
		const upper =
			normalized.slice(0, -1) +
			String.fromCharCode(normalized.charCodeAt(normalized.length - 1) + 1);
		const rows = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(
				and(
					gte(sessions.id, normalized),
					lt(sessions.id, upper),
					isNull(sessions.deletedAt),
				),
			)
			.limit(limit);
		return rows.map((row) => row.id);
	}

	async saveSession(session: typeof sessions.$inferInsert): Promise<void> {
		await this.db.insert(sessions).values(session);
	}

	async updateSession(
		id: string,
		updates: Partial<Omit<typeof sessions.$inferInsert, "id" | "createdAt">>,
		db: DbClient = this.db,
	) {
		await db.update(sessions).set(updates).where(eq(sessions.id, id));
	}

	async softDeleteSession(id: string, deletedAt: number): Promise<void> {
		await this.db
			.update(sessions)
			.set({ deletedAt })
			.where(eq(sessions.id, id));
	}

	async createSession(
		session: typeof sessions.$inferInsert,
		charactersToSave: (typeof sessionCharacters.$inferInsert)[],
		checkpoint?: {
			id: string;
			eventId: number;
			stateJson: string;
			createdAt: number;
		},
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx.insert(sessions).values(session);
			if (charactersToSave.length > 0) {
				await tx.insert(sessionCharacters).values(charactersToSave);
			}
			if (checkpoint) {
				await tx.insert(sessionRuntimeCheckpoints).values({
					id: checkpoint.id,
					sessionId: session.id,
					eventId: checkpoint.eventId,
					stateJson: checkpoint.stateJson,
					createdAt: checkpoint.createdAt,
				});
			}
		});
	}

	async saveSessionCharacterSnapshot(
		row: typeof sessionCharacters.$inferInsert,
	): Promise<void> {
		await this.db
			.insert(sessionCharacters)
			.values(row)
			.onConflictDoUpdate({
				target: [sessionCharacters.sessionId, sessionCharacters.characterId],
				set: { deletedAt: null },
			});
	}

	async findCharactersByIds(ids: string[]) {
		if (ids.length === 0) {
			return [];
		}
		return await this.db
			.select()
			.from(characters)
			.where(and(inArray(characters.id, ids), isNull(characters.deletedAt)));
	}

	async findLinkedCharacterIds(
		moduleId: string,
		ids: string[],
	): Promise<string[]> {
		if (ids.length === 0) {
			return [];
		}
		const rows = await this.db
			.select({ characterId: moduleCharacters.characterId })
			.from(moduleCharacters)
			.where(
				and(
					eq(moduleCharacters.moduleId, moduleId),
					inArray(moduleCharacters.characterId, ids),
					isNull(moduleCharacters.deletedAt),
				),
			);
		return rows.map((row) => row.characterId);
	}

	async moduleExists(moduleId: string): Promise<boolean> {
		const result = await this.db
			.select({ id: modules.id })
			.from(modules)
			.where(and(eq(modules.id, moduleId), isNull(modules.deletedAt)))
			.limit(1);
		return result.length > 0;
	}

	async findModuleById(moduleId: string) {
		const result = await this.db
			.select()
			.from(modules)
			.where(eq(modules.id, moduleId))
			.limit(1);
		return result[0] ?? null;
	}

	async linkCharacterToModule(input: {
		id: string;
		moduleId: string;
		characterId: string;
		createdAt: number;
	}): Promise<void> {
		await this.db
			.insert(moduleCharacters)
			.values(input)
			.onConflictDoUpdate({
				target: [moduleCharacters.moduleId, moduleCharacters.characterId],
				set: { deletedAt: null },
			});
	}

	async softDeleteSessionCharacter(
		sessionId: string,
		characterId: string,
		deletedAt: number,
	): Promise<boolean> {
		const updated = await this.db
			.update(sessionCharacters)
			.set({ deletedAt })
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			)
			.returning({ id: sessionCharacters.id });
		return updated.length > 0;
	}

	async findSessionCharacterKind(
		sessionId: string,
		characterId: string,
	): Promise<string | null> {
		const result = await this.db
			.select({ kind: sessionCharacters.kind })
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			)
			.limit(1);
		return result[0]?.kind ?? null;
	}

	async isCharacterInSession(
		sessionId: string,
		characterId: string,
	): Promise<boolean> {
		const result = await this.db
			.select({ id: sessionCharacters.id })
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			)
			.limit(1);
		return result.length > 0;
	}

	async findActiveClaimByCharacterId(
		sessionId: string,
		characterId: string,
	): Promise<ClaimRecord | null> {
		const result = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					eq(sessionClaims.characterId, characterId),
					isNull(sessionClaims.releasedAt),
				),
			)
			.limit(1);
		return (result[0] as ClaimRecord | undefined) ?? null;
	}

	async listActiveSessionsForUser(userId: string) {
		const rows = await this.db
			.select({
				sessionId: sessions.id,
				name: sessions.name,
				status: sessions.status,
				phase: sessions.phase,
				ruleId: sessions.ruleId,
				role: sessionClaims.role,
				characterId: sessionClaims.characterId,
				characterName: sessionCharacters.name,
			})
			.from(sessionClaims)
			.innerJoin(sessions, eq(sessionClaims.sessionId, sessions.id))
			.leftJoin(
				sessionCharacters,
				and(
					eq(sessionCharacters.sessionId, sessions.id),
					eq(sessionCharacters.characterId, sessionClaims.characterId),
				),
			)
			.where(
				and(
					eq(sessionClaims.userId, userId),
					isNull(sessionClaims.releasedAt),
					isNull(sessions.deletedAt),
				),
			)
			.orderBy(desc(sessions.createdAt));
		return rows;
	}

	async findActiveClaimByHolder(
		sessionId: string,
		holder: SeatHolderInput,
	): Promise<ClaimRecord | null> {
		const result = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					holderCondition(holder, sessionClaims),
					isNull(sessionClaims.releasedAt),
				),
			)
			.limit(1);
		return (result[0] as ClaimRecord | undefined) ?? null;
	}

	async releaseHolderClaims(
		sessionId: string,
		holder: SeatHolderInput,
		releasedAt: number,
	): Promise<void> {
		await this.db
			.update(sessionClaims)
			.set({ releasedAt })
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					holderCondition(holder, sessionClaims),
					isNull(sessionClaims.releasedAt),
				),
			);
	}

	async saveClaim(claim: typeof sessionClaims.$inferInsert): Promise<void> {
		await this.db.insert(sessionClaims).values(claim);
	}

	async replaceHolderClaim(
		claim: typeof sessionClaims.$inferInsert,
		releasedAt: number,
	): Promise<boolean> {
		return await this.db.transaction(async (tx) => {
			if (claim.characterId) {
				const occupied = await tx
					.select({ id: sessionClaims.id })
					.from(sessionClaims)
					.where(
						and(
							eq(sessionClaims.sessionId, claim.sessionId),
							eq(sessionClaims.characterId, claim.characterId),
							isNull(sessionClaims.releasedAt),
						),
					)
					.limit(1);
				if (occupied.length > 0) return false;
			}
			await tx
				.update(sessionClaims)
				.set({ releasedAt })
				.where(
					and(
						eq(sessionClaims.sessionId, claim.sessionId),
						holderCondition(
							{
								holderKind: claim.holderKind as "user" | "anonymous",
								userId: claim.userId ?? null,
								playerId: claim.playerId ?? null,
							},
							sessionClaims,
						),
						isNull(sessionClaims.releasedAt),
					),
				);
			await tx.insert(sessionClaims).values(claim);
			return true;
		});
	}

	async forceReplaceHolderClaim(
		claim: typeof sessionClaims.$inferInsert,
		releasedAt: number,
	): Promise<{ displacedHolderKeys: string[] }> {
		return await this.db.transaction(async (tx) => {
			const displacedHolderKeys: string[] = [];
			const selfKey =
				claim.holderKind === "user"
					? `user:${claim.userId}`
					: `player:${claim.playerId}`;

			if (claim.characterId) {
				const occupied = await tx
					.select({
						playerId: sessionClaims.playerId,
						userId: sessionClaims.userId,
					})
					.from(sessionClaims)
					.where(
						and(
							eq(sessionClaims.sessionId, claim.sessionId),
							eq(sessionClaims.characterId, claim.characterId),
							isNull(sessionClaims.releasedAt),
						),
					);
				for (const row of occupied) {
					const key = row.userId
						? `user:${row.userId}`
						: `player:${row.playerId}`;
					if (key !== selfKey) {
						displacedHolderKeys.push(key);
					}
				}
				await tx
					.update(sessionClaims)
					.set({ releasedAt })
					.where(
						and(
							eq(sessionClaims.sessionId, claim.sessionId),
							eq(sessionClaims.characterId, claim.characterId),
							isNull(sessionClaims.releasedAt),
						),
					);
			}

			await tx
				.update(sessionClaims)
				.set({ releasedAt })
				.where(
					and(
						eq(sessionClaims.sessionId, claim.sessionId),
						holderCondition(
							{
								holderKind: claim.holderKind as "user" | "anonymous",
								userId: claim.userId ?? null,
								playerId: claim.playerId ?? null,
							},
							sessionClaims,
						),
						isNull(sessionClaims.releasedAt),
					),
				);
			await tx.insert(sessionClaims).values(claim);
			return { displacedHolderKeys };
		});
	}

	async listSessions(options: {
		ownerId?: string;
		limit: number;
		offset?: number;
		cursor?: string;
	}) {
		const limit = options.limit;
		const scope = options.ownerId
			? eq(sessions.ownerId, options.ownerId)
			: undefined;
		const notDeleted = isNull(sessions.deletedAt);

		let items: (typeof sessions.$inferSelect)[];
		if (options.cursor) {
			const cursorRow = await this.db
				.select()
				.from(sessions)
				.where(eq(sessions.id, options.cursor))
				.limit(1);
			const c = cursorRow[0];
			if (!c) {
				return { items: [], nextCursor: null };
			}
			items = await this.db
				.select()
				.from(sessions)
				.where(
					and(
						notDeleted,
						...(scope ? [scope] : []),
						or(
							gt(sessions.createdAt, c.createdAt),
							and(eq(sessions.createdAt, c.createdAt), gt(sessions.id, c.id)),
						),
					),
				)
				.orderBy(asc(sessions.createdAt), asc(sessions.id))
				.limit(limit + 1);
		} else if (options.offset !== undefined) {
			items = await this.db
				.select()
				.from(sessions)
				.where(and(notDeleted, ...(scope ? [scope] : [])))
				.orderBy(asc(sessions.createdAt), asc(sessions.id))
				.limit(limit + 1)
				.offset(options.offset);
		} else {
			items = await this.db
				.select()
				.from(sessions)
				.where(and(notDeleted, ...(scope ? [scope] : [])))
				.orderBy(asc(sessions.createdAt), asc(sessions.id))
				.limit(limit + 1);
		}
		const hasMore = items.length > limit;
		const returnedItems = hasMore ? items.slice(0, limit) : items;
		const lastItem = returnedItems[returnedItems.length - 1];
		return {
			items: returnedItems,
			nextCursor: hasMore && lastItem ? lastItem.id : null,
		};
	}

	async findSessionCharactersWithClaims(sessionId: string) {
		const sessionChars = await this.db
			.select({
				id: sessionCharacters.id,
				characterId: sessionCharacters.characterId,
				kind: sessionCharacters.kind,
				name: sessionCharacters.name,
				background: sessionCharacters.background,
				ruleId: sessionCharacters.ruleId,
				sheetJson: sessionCharacters.sheetJson,
				baseSheetVersion: sessionCharacters.baseSheetVersion,
				baseProfileVersion: sessionCharacters.baseProfileVersion,
				currentExpressionKey: sessionCharacters.currentExpressionKey,
				stateJson: sessionCharacters.stateJson,
			})
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					isNull(sessionCharacters.deletedAt),
				),
			);

		if (sessionChars.length === 0) {
			return [];
		}

		const activeClaims = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					isNull(sessionClaims.releasedAt),
				),
			);

		const holderNames = await this.loadHolderDisplayNames(activeClaims);

		const claimMap = new Map<
			string,
			NonNullable<ReturnType<typeof this.toClaimView>>
		>();
		for (const claim of activeClaims) {
			if (!claim.characterId) continue;
			const view = this.toClaimView(claim, holderNames);
			if (view) {
				claimMap.set(claim.characterId, view);
			}
		}

		return sessionChars.map((sc) => ({
			id: sc.characterId,
			characterId: sc.characterId,
			name: sc.name,
			background: sc.background,
			kind: sc.kind,
			ruleId: sc.ruleId,
			sheetJson: sc.sheetJson,
			baseSheetVersion: sc.baseSheetVersion,
			baseProfileVersion: sc.baseProfileVersion,
			currentExpressionKey: sc.currentExpressionKey,
			state: JSON.parse(sc.stateJson),
			claim: claimMap.get(sc.characterId) ?? null,
		}));
	}

	async findSessionCharacterSnapshot(sessionId: string, characterId: string) {
		const rows = await this.db
			.select({
				characterId: sessionCharacters.characterId,
				name: sessionCharacters.name,
				background: sessionCharacters.background,
				sheetJson: sessionCharacters.sheetJson,
				baseSheetVersion: sessionCharacters.baseSheetVersion,
				baseProfileVersion: sessionCharacters.baseProfileVersion,
				stateJson: sessionCharacters.stateJson,
				kind: sessionCharacters.kind,
				ruleId: sessionCharacters.ruleId,
			})
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async updateSessionCharacterSnapshot(
		sessionId: string,
		characterId: string,
		patch: {
			name?: string;
			background?: string;
			sheetJson?: string;
			stateJson?: string;
			baseSheetVersion?: number;
			baseProfileVersion?: number;
		},
	): Promise<void> {
		await this.db
			.update(sessionCharacters)
			.set(patch)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
				),
			);
	}

	async findSessionReviewStates(
		sessionId: string,
		characterIds?: string[],
	): Promise<Map<string, SessionCharacterReviewState>> {
		if (characterIds && characterIds.length === 0) {
			return new Map();
		}
		const conditions = [
			eq(characterReviews.scope, "session"),
			eq(characterReviews.targetId, sessionId),
			isNull(characterReviews.deletedAt),
		];
		if (characterIds && characterIds.length > 0) {
			conditions.push(inArray(characterReviews.characterId, characterIds));
		}
		const rows = await this.db
			.select({
				characterId: characterReviews.characterId,
				status: characterReviews.status,
				submittedByUserId: characterReviews.submittedByUserId,
				submittedSheetVersion: characterReviews.submittedSheetVersion,
				currentSheetVersion: characters.sheetVersion,
				characterDeletedAt: characters.deletedAt,
			})
			.from(characterReviews)
			.leftJoin(characters, eq(characterReviews.characterId, characters.id))
			.where(and(...conditions))
			.orderBy(
				desc(characterReviews.createdAt),
				desc(sql`character_reviews.rowid`),
			);

		const latest = new Map<string, SessionCharacterReviewState>();
		for (const row of rows) {
			if (!latest.has(row.characterId)) {
				latest.set(row.characterId, {
					characterId: row.characterId,
					status: row.status,
					submittedByUserId: row.submittedByUserId,
					submittedSheetVersion: row.submittedSheetVersion,
					currentSheetVersion: row.currentSheetVersion ?? null,
					characterDeleted: row.characterDeletedAt !== null,
				});
			}
		}
		return latest;
	}

	async findCharacterOwners(
		characterIds: string[],
	): Promise<Map<string, SessionCharacterOwnerState>> {
		if (characterIds.length === 0) {
			return new Map();
		}
		const rows = await this.db
			.select({
				characterId: characters.id,
				ownerId: characters.ownerId,
				ownerKind: characters.ownerKind,
				ownerRole: users.role,
				characterDeletedAt: characters.deletedAt,
			})
			.from(characters)
			.leftJoin(users, eq(characters.ownerId, users.id))
			.where(inArray(characters.id, characterIds));

		const owners = new Map<string, SessionCharacterOwnerState>();
		for (const row of rows) {
			owners.set(row.characterId, {
				characterId: row.characterId,
				ownerId: row.ownerId,
				ownerKind: row.ownerKind,
				ownerRole: row.ownerRole ?? null,
				characterDeleted: row.characterDeletedAt !== null,
			});
		}
		return owners;
	}

	async findActiveClaims(sessionId: string): Promise<ClaimRecord[]> {
		const rows = await this.db
			.select()
			.from(sessionClaims)
			.where(
				and(
					eq(sessionClaims.sessionId, sessionId),
					isNull(sessionClaims.releasedAt),
				),
			);
		return rows as ClaimRecord[];
	}

	private toClaimView(
		claim: typeof sessionClaims.$inferSelect,
		holderNames: Map<string, string>,
	) {
		if (!claim.characterId) {
			return null;
		}
		const holderKind = claim.holderKind as "user" | "anonymous";
		const holderId = holderKind === "user" ? claim.userId! : claim.playerId!;
		return {
			holderKind,
			holderId,
			playerId: claim.playerId,
			userId: claim.userId,
			displayName: holderNames.get(`${holderKind}:${holderId}`) ?? null,
			role: claim.role,
		};
	}

	private async loadHolderDisplayNames(
		claims: Array<typeof sessionClaims.$inferSelect>,
	): Promise<Map<string, string>> {
		const names = new Map<string, string>();
		const userIds = claims
			.map((c) => c.userId)
			.filter((id): id is string => Boolean(id));
		const playerIds = claims
			.map((c) => c.playerId)
			.filter((id): id is string => Boolean(id));

		if (userIds.length > 0) {
			const rows = await this.db
				.select({ id: users.id, username: users.username })
				.from(users)
				.where(inArray(users.id, userIds));
			for (const row of rows) {
				names.set(`user:${row.id}`, row.username);
			}
		}
		if (playerIds.length > 0) {
			const rows = await this.db
				.select({ id: anonymousPlayers.id })
				.from(anonymousPlayers)
				.where(inArray(anonymousPlayers.id, playerIds));
			for (const row of rows) {
				names.set(`player:${row.id}`, `观战 ${row.id.slice(0, 8)}`);
			}
		}
		return names;
	}

	async findActiveSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
	): Promise<SessionKickRecord | null> {
		const rows = await this.db
			.select()
			.from(sessionKicks)
			.where(
				and(
					eq(sessionKicks.sessionId, sessionId),
					holderCondition(holder, sessionKicks),
					isNull(sessionKicks.liftedAt),
				),
			)
			.limit(1);
		return (rows[0] as SessionKickRecord | undefined) ?? null;
	}

	async findActiveSessionKickByUserId(
		sessionId: string,
		userId: string,
	): Promise<SessionKickRecord | null> {
		return this.findActiveSessionKick(sessionId, {
			holderKind: "user",
			userId,
			playerId: null,
		});
	}

	async recordSessionKick(kick: SessionKickInput): Promise<void> {
		await this.db.insert(sessionKicks).values(kick).onConflictDoNothing();
	}

	async liftSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
		liftedAt: number,
	): Promise<boolean> {
		const rows = await this.db
			.update(sessionKicks)
			.set({ liftedAt })
			.where(
				and(
					eq(sessionKicks.sessionId, sessionId),
					holderCondition(holder, sessionKicks),
					isNull(sessionKicks.liftedAt),
				),
			)
			.returning({ id: sessionKicks.id });
		return rows.length > 0;
	}
}
