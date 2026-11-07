import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	characterAudits,
	characterGrowthEntries,
	characterInvites,
	characterPortraits,
	characterReviews,
	characters,
	characterVersions,
	importStagings,
	mediaAssets,
	moduleCharacters,
	modules,
	sessions as sessionsTable,
	sessionCharacters,
	users,
} from "@/platform/db/schema";
import type {
	CharacterAuditRecord,
	CharacterGrowthRecord,
	CharacterInviteRecord,
	CharacterReviewDetail,
	CharacterReviewRecord,
	CharactersRepository,
	CharacterVersionRecord,
	CursorPageOptions,
} from "../application/ports";
import { CharacterNotFoundError, CharacterVersionConflictError } from "../domain/errors";

function paginated<T extends { id: string }>(items: T[], limit: number) {
	const hasMore = items.length > limit;
	const returnedItems = hasMore ? items.slice(0, limit) : items;
	const lastItem = returnedItems[returnedItems.length - 1];
	return {
		items: returnedItems,
		nextCursor: hasMore && lastItem ? lastItem.id : null,
	};
}

export class DrizzleCharactersRepository implements CharactersRepository {
	constructor(private readonly db: DbClient) {}

	async findCharacterById(id: string) {
		const result = await this.db
			.select()
			.from(characters)
			.where(eq(characters.id, id))
			.limit(1);
		return result[0] ?? null;
	}

	async saveCharacter(
		character: typeof characters.$inferInsert,
	): Promise<void> {
		await this.db.insert(characters).values(character);
	}

	async updateCharacter(
		id: string,
		updates: Partial<
			Omit<typeof characters.$inferInsert, "id" | "createdAt" | "ruleId">
		>,
		expectedVersion?: number,
	) {
		const whereClause = expectedVersion !== undefined
			? and(eq(characters.id, id), eq(characters.version, expectedVersion))
			: eq(characters.id, id);
		const result = await this.db
			.update(characters)
			.set(updates)
			.where(whereClause)
			.returning();
		const row = result[0];
		if (!row) {
			if (expectedVersion !== undefined) {
				throw new CharacterVersionConflictError();
			}
			throw new CharacterNotFoundError();
		}
		return row;
	}

	async softDeleteCharacter(id: string, deletedAt: number): Promise<void> {
		await this.db
			.update(characters)
			.set({ deletedAt, updatedAt: deletedAt })
			.where(eq(characters.id, id));
		await this.db
			.update(characterPortraits)
			.set({ deletedAt })
			.where(
				and(
					eq(characterPortraits.characterId, id),
					isNull(characterPortraits.deletedAt),
				),
			);
	}

	async listCharacters(
		ownerId: string,
		options: CursorPageOptions & { kind?: string },
	) {
		const limit = options.limit;
		const conditions = [
			eq(characters.ownerId, ownerId),
			isNull(characters.deletedAt),
		];
		if (options.kind) {
			conditions.push(eq(characters.kind, options.kind));
		}
		const rows = await this.db
			.select()
			.from(characters)
			.where(and(...conditions))
			.orderBy(asc(characters.createdAt), asc(characters.id));
		const filtered = options.cursor
			? rows.filter((row) => row.id > (options.cursor as string))
			: rows;
		return paginated(filtered.slice(0, limit + 1), limit);
	}

	async appendVersion(
		version: typeof characterVersions.$inferInsert,
	): Promise<void> {
		await this.db
			.insert(characterVersions)
			.values(version)
			.onConflictDoNothing();
	}

	async listVersions(characterId: string): Promise<CharacterVersionRecord[]> {
		const rows = await this.db
			.select()
			.from(characterVersions)
			.where(eq(characterVersions.characterId, characterId))
			.orderBy(desc(characterVersions.version));
		return rows as CharacterVersionRecord[];
	}

	async appendGrowth(
		entry: typeof characterGrowthEntries.$inferInsert,
	): Promise<void> {
		await this.db.insert(characterGrowthEntries).values(entry);
	}

	async listGrowth(characterId: string): Promise<CharacterGrowthRecord[]> {
		const rows = await this.db
			.select()
			.from(characterGrowthEntries)
			.where(eq(characterGrowthEntries.characterId, characterId))
			.orderBy(desc(characterGrowthEntries.createdAt));
		return rows as CharacterGrowthRecord[];
	}

	async appendAudit(entry: typeof characterAudits.$inferInsert): Promise<void> {
		await this.db.insert(characterAudits).values(entry);
	}

	async listAudits(characterId: string): Promise<CharacterAuditRecord[]> {
		const rows = await this.db
			.select()
			.from(characterAudits)
			.where(eq(characterAudits.characterId, characterId))
			.orderBy(desc(characterAudits.createdAt));
		return rows as CharacterAuditRecord[];
	}

	async findMediaAsset(id: string) {
		const rows = await this.db
			.select({
				id: mediaAssets.id,
				purpose: mediaAssets.purpose,
				mimeType: mediaAssets.mimeType,
				ownerId: mediaAssets.ownerId,
			})
			.from(mediaAssets)
			.where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async findPortraitById(id: string) {
		const rows = await this.db
			.select()
			.from(characterPortraits)
			.where(eq(characterPortraits.id, id))
			.limit(1);
		return rows[0] ?? null;
	}

	async findPortraitByExpression(characterId: string, expressionKey: string) {
		const rows = await this.db
			.select()
			.from(characterPortraits)
			.where(
				and(
					eq(characterPortraits.characterId, characterId),
					eq(characterPortraits.expressionKey, expressionKey),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async savePortrait(
		portrait: typeof characterPortraits.$inferInsert,
	): Promise<void> {
		await this.db.insert(characterPortraits).values(portrait);
	}

	async updatePortrait(
		id: string,
		updates: Partial<
			Pick<
				typeof characterPortraits.$inferInsert,
				"label" | "isDefault" | "sortOrder" | "deletedAt"
			>
		>,
	): Promise<void> {
		await this.db
			.update(characterPortraits)
			.set(updates)
			.where(eq(characterPortraits.id, id));
	}

	async unsetDefaultPortraits(characterId: string): Promise<void> {
		await this.db
			.update(characterPortraits)
			.set({ isDefault: 0 })
			.where(
				and(
					eq(characterPortraits.characterId, characterId),
					eq(characterPortraits.isDefault, 1),
				),
			);
	}

	async listPortraitsByCharacterId(characterId: string) {
		const rows = await this.db
			.select()
			.from(characterPortraits)
			.where(
				and(
					eq(characterPortraits.characterId, characterId),
					isNull(characterPortraits.deletedAt),
				),
			)
			.orderBy(
				asc(characterPortraits.sortOrder),
				asc(characterPortraits.createdAt),
			);
		return rows;
	}

	async resetSessionCharacterExpression(
		characterId: string,
		fromExpressionKey: string,
		toExpressionKey: string | null,
	): Promise<void> {
		await this.db
			.update(sessionCharacters)
			.set({ currentExpressionKey: toExpressionKey })
			.where(
				and(
					eq(sessionCharacters.characterId, characterId),
					eq(sessionCharacters.currentExpressionKey, fromExpressionKey),
				),
			);
	}

	async findStagingById(id: string) {
		const rows = await this.db
			.select()
			.from(importStagings)
			.where(eq(importStagings.id, id))
			.limit(1);
		return rows[0] ?? null;
	}

	async saveStaging(
		staging: typeof importStagings.$inferInsert,
	): Promise<void> {
		await this.db.insert(importStagings).values(staging);
	}

	async consumeStaging(id: string, consumedAt: number): Promise<void> {
		await this.db
			.update(importStagings)
			.set({ consumedAt })
			.where(eq(importStagings.id, id));
	}

	async moduleExists(moduleId: string): Promise<boolean> {
		const rows = await this.db
			.select({ id: modules.id })
			.from(modules)
			.where(and(eq(modules.id, moduleId), isNull(modules.deletedAt)))
			.limit(1);
		return rows.length > 0;
	}

	async findModule(id: string) {
		const rows = await this.db
			.select({
				id: modules.id,
				ownerId: modules.ownerId,
				name: modules.name,
				ruleId: modules.ruleId,
			})
			.from(modules)
			.where(eq(modules.id, id))
			.limit(1);
		return rows[0] ?? null;
	}

	async findSession(id: string) {
		const rows = await this.db
			.select({
				id: sessionsTable.id,
				ownerId: sessionsTable.ownerId,
				name: sessionsTable.name,
				moduleId: sessionsTable.moduleId,
				ruleId: sessionsTable.ruleId,
			})
			.from(sessionsTable)
			.where(eq(sessionsTable.id, id))
			.limit(1);
		return rows[0] ?? null;
	}

	async findModuleCharacterLink(moduleId: string, characterId: string) {
		const rows = await this.db
			.select({ id: moduleCharacters.id })
			.from(moduleCharacters)
			.where(
				and(
					eq(moduleCharacters.moduleId, moduleId),
					eq(moduleCharacters.characterId, characterId),
					isNull(moduleCharacters.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async linkCharacterToModule(
		link: typeof moduleCharacters.$inferInsert,
	): Promise<void> {
		await this.db.insert(moduleCharacters).values(link).onConflictDoNothing();
	}

	async restoreModuleCharacterLink(
		moduleId: string,
		characterId: string,
	): Promise<void> {
		await this.db
			.update(moduleCharacters)
			.set({ deletedAt: null })
			.where(
				and(
					eq(moduleCharacters.moduleId, moduleId),
					eq(moduleCharacters.characterId, characterId),
				),
			);
	}

	async unlinkModuleCharacter(
		moduleId: string,
		characterId: string,
		deletedAt: number,
	): Promise<void> {
		const rows = await this.db
			.update(moduleCharacters)
			.set({ deletedAt })
			.where(
				and(
					eq(moduleCharacters.moduleId, moduleId),
					eq(moduleCharacters.characterId, characterId),
					isNull(moduleCharacters.deletedAt),
				),
			)
			.returning({ id: moduleCharacters.id });
		if (rows.length === 0) {
			throw new CharacterNotFoundError(
				"Character is not linked to this module",
			);
		}
	}

	async listModuleCharacters(moduleId: string, options: CursorPageOptions) {
		const limit = options.limit;
		const rows = await this.db
			.select({
				id: characters.id,
				ownerId: characters.ownerId,
				ownerKind: characters.ownerKind,
				name: characters.name,
				background: characters.background,
				kind: characters.kind,
				ruleId: characters.ruleId,
				sheetJson: characters.sheetJson,
				sheetVersion: characters.sheetVersion,
				profileVersion: characters.profileVersion,
				version: characters.version,
				originType: characters.originType,
				originRefId: characters.originRefId,
				deletedAt: characters.deletedAt,
				createdAt: characters.createdAt,
				updatedAt: characters.updatedAt,
			})
			.from(moduleCharacters)
			.innerJoin(characters, eq(moduleCharacters.characterId, characters.id))
			.where(
				and(
					eq(moduleCharacters.moduleId, moduleId),
					isNull(moduleCharacters.deletedAt),
					isNull(characters.deletedAt),
				),
			)
			.orderBy(asc(moduleCharacters.createdAt), asc(moduleCharacters.id));
		const filtered = options.cursor
			? rows.filter((row) => row.id > (options.cursor as string))
			: rows;
		return paginated(filtered.slice(0, limit + 1), limit);
	}

	async saveInvite(
		invite: typeof characterInvites.$inferInsert,
	): Promise<void> {
		await this.db.insert(characterInvites).values(invite);
	}

	async findInviteById(id: string) {
		const rows = await this.db
			.select()
			.from(characterInvites)
			.where(eq(characterInvites.id, id))
			.limit(1);
		return (rows[0] as CharacterInviteRecord | undefined) ?? null;
	}

	async findInviteByTokenHash(tokenHash: string) {
		const rows = await this.db
			.select()
			.from(characterInvites)
			.where(eq(characterInvites.tokenHash, tokenHash))
			.limit(1);
		return (rows[0] as CharacterInviteRecord | undefined) ?? null;
	}

	async listInvites(ownerId: string) {
		const rows = await this.db
			.select()
			.from(characterInvites)
			.where(
				and(
					eq(characterInvites.ownerId, ownerId),
					isNull(characterInvites.deletedAt),
				),
			)
			.orderBy(desc(characterInvites.createdAt));
		return rows as CharacterInviteRecord[];
	}

	async revokeInvite(id: string, revokedAt: number): Promise<void> {
		await this.db
			.update(characterInvites)
			.set({ revokedAt })
			.where(eq(characterInvites.id, id));
	}

	async saveReview(
		review: typeof characterReviews.$inferInsert,
	): Promise<void> {
		await this.db.insert(characterReviews).values(review);
	}

	async findReviewById(id: string) {
		const rows = await this.db
			.select()
			.from(characterReviews)
			.where(eq(characterReviews.id, id))
			.limit(1);
		return (rows[0] as CharacterReviewRecord | undefined) ?? null;
	}

	private async decorateReviews(
		rows: Array<typeof characterReviews.$inferSelect>,
	): Promise<CharacterReviewDetail[]> {
		if (rows.length === 0) {
			return [];
		}
		const characterIds = [...new Set(rows.map((row) => row.characterId))];
		const submitterIds = [...new Set(rows.map((row) => row.submittedByUserId))];

		const characterRows = await this.db
			.select({ id: characters.id, name: characters.name })
			.from(characters)
			.where(inArray(characters.id, characterIds));
		const nameById = new Map(characterRows.map((row) => [row.id, row.name]));

		const userRows = await this.db
			.select({ id: users.id, username: users.username })
			.from(users)
			.where(inArray(users.id, submitterIds));
		const userById = new Map(userRows.map((row) => [row.id, row.username]));

		const moduleIds = rows
			.filter((row) => row.scope === "module")
			.map((row) => row.targetId);
		const sessionIds = rows
			.filter((row) => row.scope === "session")
			.map((row) => row.targetId);
		const targetNames = new Map<string, string>();
		if (moduleIds.length > 0) {
			const moduleRows = await this.db
				.select({ id: modules.id, name: modules.name })
				.from(modules)
				.where(inArray(modules.id, moduleIds));
			for (const row of moduleRows)
				targetNames.set(`module:${row.id}`, row.name);
		}
		if (sessionIds.length > 0) {
			const sessionRows = await this.db
				.select({
					id: sessionsTable.id,
					name: sessionsTable.name,
					moduleId: sessionsTable.moduleId,
				})
				.from(sessionsTable)
				.where(inArray(sessionsTable.id, sessionIds));
			for (const row of sessionRows)
				targetNames.set(`session:${row.id}`, row.name ?? row.id);
		}

		return rows.map((row) => ({
			...(row as CharacterReviewRecord),
			characterName: nameById.get(row.characterId) ?? row.characterId,
			submittedByName: userById.get(row.submittedByUserId) ?? null,
			targetName: targetNames.get(`${row.scope}:${row.targetId}`) ?? null,
		}));
	}

	async listReviewsForOwner(
		ownerId: string,
		status?: string,
	): Promise<CharacterReviewDetail[]> {
		const conditions = [
			eq(characterReviews.ownerId, ownerId),
			isNull(characterReviews.deletedAt),
		];
		if (status) {
			conditions.push(eq(characterReviews.status, status));
		}
		const rows = await this.db
			.select()
			.from(characterReviews)
			.where(and(...conditions))
			.orderBy(desc(characterReviews.createdAt));
		return this.decorateReviews(rows);
	}

	async listReviewsForSubmitter(
		userId: string,
	): Promise<CharacterReviewDetail[]> {
		const rows = await this.db
			.select()
			.from(characterReviews)
			.where(
				and(
					eq(characterReviews.submittedByUserId, userId),
					isNull(characterReviews.deletedAt),
				),
			)
			.orderBy(desc(characterReviews.createdAt));
		return this.decorateReviews(rows);
	}

	async listApprovedReviews(
		scope: string,
		targetId: string,
	): Promise<CharacterReviewRecord[]> {
		const rows = await this.db
			.select()
			.from(characterReviews)
			.innerJoin(characters, eq(characterReviews.characterId, characters.id))
			.where(
				and(
					eq(characterReviews.scope, scope),
					eq(characterReviews.targetId, targetId),
					eq(characterReviews.status, "approved"),
					eq(characterReviews.submittedSheetVersion, characters.sheetVersion),
					isNull(characterReviews.deletedAt),
					isNull(characters.deletedAt),
				),
			);
		return rows.map((row) => row.character_reviews) as CharacterReviewRecord[];
	}

	async decideReview(input: {
		id: string;
		status: string;
		decidedByUserId: string;
		decidedAt: number;
		decisionReason: string | null;
	}): Promise<void> {
		await this.db
			.update(characterReviews)
			.set({
				status: input.status,
				decidedByUserId: input.decidedByUserId,
				decidedAt: input.decidedAt,
				decisionReason: input.decisionReason,
			})
			.where(
				and(
					eq(characterReviews.id, input.id),
					eq(characterReviews.status, "pending"),
				),
			);
	}

	async findReviewForCharacter(
		scope: string,
		targetId: string,
		characterId: string,
	) {
		const rows = await this.db
			.select()
			.from(characterReviews)
			.where(
				and(
					eq(characterReviews.scope, scope),
					eq(characterReviews.targetId, targetId),
					eq(characterReviews.characterId, characterId),
					isNull(characterReviews.deletedAt),
				),
			)
			.orderBy(desc(characterReviews.createdAt))
			.limit(1);
		return (rows[0] as CharacterReviewRecord | undefined) ?? null;
	}

	async findUserDisplayName(userId: string): Promise<string | null> {
		const rows = await this.db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return rows[0]?.username ?? null;
	}
}

export { paginated };
