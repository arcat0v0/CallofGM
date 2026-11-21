import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	characterAudits,
	characterCreationRolls,
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
	sessionCharacters,
	sessionHistoryEvents,
	sessions as sessionsTable,
	users,
} from "@/platform/db/schema";
import type {
	CharacterAuditRecord,
	CharacterCreationRollRecord,
	CharacterGrowthRecord,
	CharacterLibraryScope,
	CharacterInviteRecord,
	CharacterReviewDetail,
	CharacterReviewRecord,
	CharacterSheetContextCompanionRow,
	CharacterSheetContextPhaseRow,
	CharactersRepository,
	CharacterVersionRecord,
	CursorPageOptions,
} from "../application/ports";
import {
	CharacterNotFoundError,
	CharacterVersionConflictError,
	ReviewAlreadyDecidedError,
} from "../domain/errors";

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

	async listLibraryScope(gmUserId: string): Promise<CharacterLibraryScope> {
		const gmModules = await this.db
			.select({ id: modules.id, name: modules.name, ruleId: modules.ruleId })
			.from(modules)
			.where(and(eq(modules.ownerId, gmUserId), isNull(modules.deletedAt)))
			.orderBy(asc(modules.createdAt), asc(modules.id));
		const moduleIds = gmModules.map((module) => module.id);
		const links =
			moduleIds.length === 0
				? []
				: await this.db
						.select({
							characterId: moduleCharacters.characterId,
							moduleId: moduleCharacters.moduleId,
						})
						.from(moduleCharacters)
						.where(
							and(
								inArray(moduleCharacters.moduleId, moduleIds),
								isNull(moduleCharacters.deletedAt),
							),
						)
						.orderBy(asc(moduleCharacters.createdAt));
		const linkedIds = [...new Set(links.map((link) => link.characterId))];
		const rows = await this.db
			.select({
				id: characters.id,
				name: characters.name,
				kind: characters.kind,
				ruleId: characters.ruleId,
				ownerId: characters.ownerId,
				ownerKind: characters.ownerKind,
				ownerName: users.username,
				updatedAt: characters.updatedAt,
			})
			.from(characters)
			.innerJoin(users, eq(users.id, characters.ownerId))
			.where(
				and(
					isNull(characters.deletedAt),
					linkedIds.length === 0
						? eq(characters.ownerId, gmUserId)
						: or(
								eq(characters.ownerId, gmUserId),
								inArray(characters.id, linkedIds),
							),
				),
			);
		const scopedIds = new Set(rows.map((row) => row.id));
		const portraitRows =
			rows.length === 0
				? []
				: await this.db
						.select({
							characterId: characterPortraits.characterId,
							portraitAssetId: characterPortraits.portraitAssetId,
							isDefault: characterPortraits.isDefault,
							sortOrder: characterPortraits.sortOrder,
							createdAt: characterPortraits.createdAt,
						})
						.from(characterPortraits)
						.innerJoin(
							characters,
							eq(characters.id, characterPortraits.characterId),
						)
						.where(
							and(
								isNull(characterPortraits.deletedAt),
								isNull(characters.deletedAt),
								linkedIds.length === 0
									? eq(characters.ownerId, gmUserId)
									: or(
											eq(characters.ownerId, gmUserId),
											inArray(characters.id, linkedIds),
										),
							),
						);
		return {
			characters: rows.map((row) => ({
				...row,
				ownerName: row.ownerId === gmUserId ? null : row.ownerName,
			})),
			links: links.filter((link) => scopedIds.has(link.characterId)),
			modules: gmModules,
			portraits: portraitRows,
		};
	}

	async gmHasReadAccess(
		gmUserId: string,
		characterId: string,
	): Promise<boolean> {
		const owned = await this.db
			.select({ id: characters.id })
			.from(characters)
			.where(
				and(eq(characters.id, characterId), eq(characters.ownerId, gmUserId)),
			)
			.limit(1);
		if (owned.length > 0) {
			return true;
		}
		const viaModule = await this.db
			.select({ id: moduleCharacters.id })
			.from(moduleCharacters)
			.innerJoin(modules, eq(modules.id, moduleCharacters.moduleId))
			.where(
				and(
					eq(moduleCharacters.characterId, characterId),
					isNull(moduleCharacters.deletedAt),
					eq(modules.ownerId, gmUserId),
					isNull(modules.deletedAt),
				),
			)
			.limit(1);
		if (viaModule.length > 0) {
			return true;
		}
		const viaSession = await this.db
			.select({ id: sessionCharacters.id })
			.from(sessionCharacters)
			.innerJoin(sessionsTable, eq(sessionsTable.id, sessionCharacters.sessionId))
			.where(
				and(
					eq(sessionCharacters.characterId, characterId),
					eq(sessionsTable.ownerId, gmUserId),
				),
			)
			.limit(1);
		if (viaSession.length > 0) {
			return true;
		}
		const viaReview = await this.db
			.select({ id: characterReviews.id })
			.from(characterReviews)
			.where(
				and(
					eq(characterReviews.characterId, characterId),
					eq(characterReviews.ownerId, gmUserId),
					isNull(characterReviews.deletedAt),
				),
			)
			.limit(1);
		return viaReview.length > 0;
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
		const whereClause =
			expectedVersion !== undefined
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
				"label" | "isDefault" | "sortOrder" | "deletedAt" | "portraitAssetId"
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

	async findCreationRoll(inviteId: string, userId: string) {
		const rows = await this.db
			.select()
			.from(characterCreationRolls)
			.where(
				and(
					eq(characterCreationRolls.inviteId, inviteId),
					eq(characterCreationRolls.userId, userId),
				),
			)
			.limit(1);
		return (rows[0] as CharacterCreationRollRecord | undefined) ?? null;
	}

	async saveCreationRollOnce(
		roll: CharacterCreationRollRecord,
	): Promise<CharacterCreationRollRecord> {
		await this.db
			.insert(characterCreationRolls)
			.values(roll)
			.onConflictDoNothing({
				target: [characterCreationRolls.inviteId, characterCreationRolls.userId],
			});
		const stored = await this.findCreationRoll(roll.inviteId, roll.userId);
		if (!stored) {
			throw new Error("creation roll was not persisted");
		}
		return stored;
	}

	async chooseCreationRoll(
		id: string,
		index: number,
		chosenAt: number,
	): Promise<boolean> {
		const updated = await this.db
			.update(characterCreationRolls)
			.set({ chosenIndex: index, chosenAt })
			.where(
				and(
					eq(characterCreationRolls.id, id),
					isNull(characterCreationRolls.chosenIndex),
				),
			)
			.returning({ id: characterCreationRolls.id });
		return updated.length > 0;
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
			.select({
				id: characters.id,
				name: characters.name,
				ruleId: characters.ruleId,
				sheetJson: characters.sheetJson,
				sheetVersion: characters.sheetVersion,
			})
			.from(characters)
			.where(inArray(characters.id, characterIds));
		const nameById = new Map(characterRows.map((row) => [row.id, row.name]));
		const characterById = new Map(characterRows.map((row) => [row.id, row]));

		const inviteIds = [
			...new Set(
				rows
					.map((row) => row.inviteId)
					.filter((id): id is string => id !== null),
			),
		];
		const rollByKey = new Map<string, CharacterCreationRollRecord>();
		if (inviteIds.length > 0) {
			const rollRows = await this.db
				.select()
				.from(characterCreationRolls)
				.where(inArray(characterCreationRolls.inviteId, inviteIds));
			for (const roll of rollRows) {
				rollByKey.set(
					`${roll.inviteId}:${roll.userId}`,
					roll as CharacterCreationRollRecord,
				);
			}
		}

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

		return rows.map((row) => {
			const character = characterById.get(row.characterId);
			return {
				...(row as CharacterReviewRecord),
				characterName: nameById.get(row.characterId) ?? row.characterId,
				submittedByName: userById.get(row.submittedByUserId) ?? null,
				targetName: targetNames.get(`${row.scope}:${row.targetId}`) ?? null,
				ruleId: character?.ruleId ?? null,
				submittedSheetJson:
					character && character.sheetVersion === row.submittedSheetVersion
						? character.sheetJson
						: null,
				creationRoll: row.inviteId
					? (rollByKey.get(`${row.inviteId}:${row.submittedByUserId}`) ??
						null)
					: null,
			};
		});
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
			.orderBy(
				desc(characterReviews.createdAt),
				desc(sql`character_reviews.rowid`),
			)
			.limit(1);
		return (rows[0] as CharacterReviewRecord | undefined) ?? null;
	}

	async replacePendingReview(
		review: typeof characterReviews.$inferInsert,
		supersededAt: number,
	): Promise<void> {
		this.db.transaction(
			(tx) => {
				const existing = tx
					.select()
					.from(characterReviews)
					.where(
						and(
							eq(characterReviews.scope, review.scope),
							eq(characterReviews.targetId, review.targetId),
							eq(characterReviews.characterId, review.characterId),
							isNull(characterReviews.deletedAt),
						),
					)
					.orderBy(
						desc(characterReviews.createdAt),
						desc(sql`character_reviews.rowid`),
					)
					.limit(1)
					.get();

				if (
					existing &&
					(existing.submittedSheetVersion > review.submittedSheetVersion ||
						(existing.status !== "rejected" &&
							existing.submittedSheetVersion === review.submittedSheetVersion))
				) {
					throw new ReviewAlreadyDecidedError(
						"This character is already submitted for this target",
					);
				}

				tx.update(characterReviews)
					.set({ deletedAt: supersededAt })
					.where(
						and(
							eq(characterReviews.scope, review.scope),
							eq(characterReviews.targetId, review.targetId),
							eq(characterReviews.characterId, review.characterId),
							eq(characterReviews.status, "pending"),
							isNull(characterReviews.deletedAt),
						),
					)
					.run();

				tx.insert(characterReviews).values(review).run();
			},
			{ behavior: "immediate" },
		);
	}

	async findUserDisplayName(userId: string): Promise<string | null> {
		const rows = await this.db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return rows[0]?.username ?? null;
	}

	async listCharacterSessionCompanions(
		characterId: string,
	): Promise<CharacterSheetContextCompanionRow[]> {
		const memberships = await this.db
			.select({
				sessionId: sessionCharacters.sessionId,
				sessionName: sessionsTable.name,
				moduleName: modules.name,
			})
			.from(sessionCharacters)
			.innerJoin(
				sessionsTable,
				eq(sessionCharacters.sessionId, sessionsTable.id),
			)
			.innerJoin(modules, eq(sessionsTable.moduleId, modules.id))
			.where(
				and(
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
					isNull(sessionsTable.deletedAt),
				),
			);
		if (memberships.length === 0) {
			return [];
		}
		const sessionNames = new Map(
			memberships.map((row) => [
				row.sessionId,
				row.sessionName?.trim() || row.moduleName,
			]),
		);
		const sessionIds = memberships.map((row) => row.sessionId);
		const rows = await this.db
			.select({
				characterId: characters.id,
				name: characters.name,
				sessionId: sessionCharacters.sessionId,
				ruleId: characters.ruleId,
				sheetJson: characters.sheetJson,
			})
			.from(sessionCharacters)
			.innerJoin(characters, eq(sessionCharacters.characterId, characters.id))
			.where(
				and(
					inArray(sessionCharacters.sessionId, sessionIds),
					eq(sessionCharacters.kind, "pc"),
					isNull(sessionCharacters.deletedAt),
					isNull(characters.deletedAt),
				),
			)
			.orderBy(asc(characters.name));
		const seen = new Set<string>();
		const result: CharacterSheetContextCompanionRow[] = [];
		for (const row of rows) {
			if (row.characterId === characterId) {
				continue;
			}
			const key = `${row.sessionId}:${row.characterId}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			result.push({
				characterId: row.characterId,
				name: row.name,
				sessionId: row.sessionId,
				sessionName: sessionNames.get(row.sessionId) ?? "",
				ruleId: row.ruleId,
				sheetJson: row.sheetJson,
			});
		}
		return result;
	}

	async listCharacterSessionPhaseRecords(
		characterId: string,
	): Promise<CharacterSheetContextPhaseRow[]> {
		const memberships = await this.db
			.select({
				sessionId: sessionCharacters.sessionId,
				sessionName: sessionsTable.name,
				moduleName: modules.name,
			})
			.from(sessionCharacters)
			.innerJoin(
				sessionsTable,
				eq(sessionCharacters.sessionId, sessionsTable.id),
			)
			.innerJoin(modules, eq(sessionsTable.moduleId, modules.id))
			.where(
				and(
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
					isNull(sessionsTable.deletedAt),
				),
			);
		if (memberships.length === 0) {
			return [];
		}
		const sessionNames = new Map(
			memberships.map((row) => [
				row.sessionId,
				row.sessionName?.trim() || row.moduleName,
			]),
		);
		const rows = await this.db
			.select({
				eventId: sessionHistoryEvents.eventId,
				sessionId: sessionHistoryEvents.sessionId,
				payloadJson: sessionHistoryEvents.payloadJson,
				occurredAt: sessionHistoryEvents.occurredAt,
			})
			.from(sessionHistoryEvents)
			.where(
				and(
					inArray(
						sessionHistoryEvents.sessionId,
						memberships.map((row) => row.sessionId),
					),
					eq(sessionHistoryEvents.type, "session:phase-changed"),
					isNull(sessionHistoryEvents.archivedAt),
				),
			)
			.orderBy(desc(sessionHistoryEvents.occurredAt))
			.limit(40);
		const result: CharacterSheetContextPhaseRow[] = [];
		for (const row of rows) {
			let phase = "";
			try {
				const parsed = JSON.parse(row.payloadJson) as {
					phase?: unknown;
					to?: unknown;
				};
				if (typeof parsed.phase === "string") {
					phase = parsed.phase;
				} else if (typeof parsed.to === "string") {
					phase = parsed.to;
				}
			} catch {
				phase = "";
			}
			if (!phase) {
				continue;
			}
			result.push({
				eventId: row.eventId,
				sessionId: row.sessionId,
				sessionName: sessionNames.get(row.sessionId) ?? "",
				phase,
				occurredAt: row.occurredAt,
			});
		}
		return result;
	}
}

export { paginated };
