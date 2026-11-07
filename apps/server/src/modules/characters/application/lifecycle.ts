import { ModuleNotFoundError } from "@/modules/catalog";
import { coc7e } from "@cogm/shared";
import { hashToken, issueOpaqueToken } from "@/modules/identity";
import { SessionNotFoundError } from "@/modules/sessions";
import type { Clock, IdGenerator } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import {
	CharacterNotFoundError,
	CharacterNotOwnedError,
	CharacterVersionConflictError,
	InviteExpiredError,
	InviteNotFoundError,
	PermanentFieldNotEditableError,
	ReviewAlreadyDecidedError,
	ReviewNotFoundError,
	ReviewSheetVersionConflictError,
} from "../domain/errors";
import type { CharactersRepository } from "./ports";

const INVITE_DEFAULT_DAYS = 7;

export class CreateCharacterInviteUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		scope: "module" | "session";
		targetId: string;
		expiresInDays?: number;
	}) {
		if (input.scope === "module") {
			const module = await this.repo.findModule(input.targetId);
			if (!module || module.ownerId !== input.ownerId) {
				throw new ModuleNotFoundError();
			}
		} else {
			const session = await this.repo.findSession(input.targetId);
			if (!session || session.ownerId !== input.ownerId) {
				throw new SessionNotFoundError();
			}
		}

		const issued = issueOpaqueToken();
		const now = this.clock.nowEpochMs();
		const days = input.expiresInDays ?? INVITE_DEFAULT_DAYS;
		const id = this.idGenerator.nextId();

		await this.repo.saveInvite({
			id,
			ownerId: input.ownerId,
			scope: input.scope,
			targetId: input.targetId,
			tokenHash: issued.tokenHash,
			expiresAt: now + days * 24 * 60 * 60 * 1000,
			revokedAt: null,
			deletedAt: null,
			createdAt: now,
		});

		return {
			id,
			token: issued.token,
			expiresAt: now + days * 24 * 60 * 60 * 1000,
		};
	}
}

export class ListCharacterInvitesUseCase {
	constructor(private readonly repo: CharactersRepository) {}

	async execute(input: { ownerId: string }) {
		const invites = await this.repo.listInvites(input.ownerId);
		const detailed = await Promise.all(
			invites.map(async (invite) => {
				const target =
					invite.scope === "module"
						? await this.repo.findModule(invite.targetId)
						: await this.repo.findSession(invite.targetId);
				return {
					id: invite.id,
					scope: invite.scope as "module" | "session",
					targetId: invite.targetId,
					targetName: target
						? (("name" in target ? target.name : null) ?? invite.targetId)
						: null,
					token: null,
					expiresAt: invite.expiresAt,
					revokedAt: invite.revokedAt,
					createdAt: invite.createdAt,
				};
			}),
		);
		return { items: detailed };
	}
}

export class RevokeCharacterInviteUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
	) {}

	async execute(input: { ownerId: string; inviteId: string }) {
		const invite = await this.repo.findInviteById(input.inviteId);
		if (!invite || invite.ownerId !== input.ownerId) {
			throw new InviteNotFoundError();
		}
		await this.repo.revokeInvite(invite.id, this.clock.nowEpochMs());
		return { success: true };
	}
}

export class GetInviteInfoUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
		private readonly tokenHasher: (token: string) => string = hashToken,
	) {}

	async execute(input: { token: string; userId: string }) {
		const invite = await this.repo.findInviteByTokenHash(
			this.tokenHasher(input.token),
		);
		if (!invite) {
			throw new InviteNotFoundError();
		}
		if (
			invite.revokedAt !== null ||
			invite.expiresAt < this.clock.nowEpochMs()
		) {
			throw new InviteExpiredError();
		}

		const ruleId =
			invite.scope === "module"
				? (await this.repo.findModule(invite.targetId))?.ruleId
				: (await this.repo.findSession(invite.targetId))?.ruleId;
		if (!ruleId) {
			throw new InviteExpiredError();
		}

		const owned = await this.repo.listCharacters(input.userId, { limit: 100 });
		const eligible = [];
		for (const character of owned.items) {
			if (character.ruleId !== ruleId || character.kind !== "pc") {
				continue;
			}
			const review = await this.repo.findReviewForCharacter(
				invite.scope,
				invite.targetId,
				character.id,
			);
			eligible.push({
				id: character.id,
				name: character.name,
				ruleId: character.ruleId,
				sheetVersion: character.sheetVersion,
				alreadySubmitted: review !== null && review.status !== "rejected",
			});
		}

		const targetName =
			invite.scope === "module"
				? ((await this.repo.findModule(invite.targetId))?.name ??
					invite.targetId)
				: ((await this.repo.findSession(invite.targetId))?.name ??
					invite.targetId);

		return {
			scope: invite.scope as "module" | "session",
			targetId: invite.targetId,
			targetName,
			ruleId,
			expiresAt: invite.expiresAt,
			ownedCharacters: eligible,
		};
	}
}

export class SubmitCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly tokenHasher: (token: string) => string = hashToken,
	) {}

	async execute(input: {
		token: string;
		userId: string;
		mode: "new" | "existing";
		characterId?: string;
		name?: string;
		background?: string;
		sheetData?: unknown;
	}) {
		const invite = await this.repo.findInviteByTokenHash(
			this.tokenHasher(input.token),
		);
		if (!invite) {
			throw new InviteNotFoundError();
		}
		if (
			invite.revokedAt !== null ||
			invite.expiresAt < this.clock.nowEpochMs()
		) {
			throw new InviteExpiredError();
		}

		const target =
			invite.scope === "module"
				? await this.repo.findModule(invite.targetId)
				: await this.repo.findSession(invite.targetId);
		if (!target) {
			throw new InviteExpiredError();
		}
		const targetRuleId = target.ruleId;
		const now = this.clock.nowEpochMs();

		let characterId: string;
		if (input.mode === "existing") {
			if (!input.characterId) {
				throw new CharacterNotFoundError();
			}
			const character = await this.repo.findCharacterById(input.characterId);
			if (
				!character ||
				character.deletedAt !== null ||
				character.ownerId !== input.userId
			) {
				throw new CharacterNotFoundError();
			}
			if (character.ruleId !== targetRuleId || character.kind !== "pc") {
				throw new CharacterNotOwnedError(
					"Character rule does not match this invite",
				);
			}
			characterId = character.id;
		} else {
			const ruleSystem = this.ruleRegistry.get(targetRuleId);
			const sheet = ruleSystem.characterSheetSchema.parse(
				input.sheetData ?? ruleSystem.createEmptySheet(),
			);
			const sheetJson = JSON.stringify(sheet);
			characterId = this.idGenerator.nextId();
			await this.repo.saveCharacter({
				id: characterId,
				ownerId: input.userId,
				ownerKind: "pl",
				name: input.name ?? "未命名调查员",
				background: input.background ?? "",
				kind: "pc",
				ruleId: targetRuleId,
				sheetJson,
				sheetVersion: 1,
				profileVersion: 1,
				version: 1,
				originType: null,
				originRefId: null,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			});
			await this.repo.appendVersion({
				id: this.idGenerator.nextId(),
				characterId,
				version: 1,
				sheetVersion: 1,
				name: input.name ?? "未命名调查员",
				background: input.background ?? "",
				sheetJson,
				actorUserId: input.userId,
				reason: "submitted",
				createdAt: now,
			});
		}

		const character = await this.repo.findCharacterById(characterId);
		if (!character) {
			throw new CharacterNotFoundError();
		}

		const existing = await this.repo.findReviewForCharacter(
			invite.scope,
			invite.targetId,
			characterId,
		);
		if (existing && existing.status !== "rejected") {
			throw new ReviewAlreadyDecidedError(
				"This character is already submitted for this target",
			);
		}

		const reviewId = this.idGenerator.nextId();
		await this.repo.saveReview({
			id: reviewId,
			inviteId: invite.id,
			scope: invite.scope,
			targetId: invite.targetId,
			ownerId: invite.ownerId,
			characterId,
			submittedByUserId: input.userId,
			submittedSheetVersion: character.sheetVersion,
			status: "pending",
			decisionReason: null,
			decidedByUserId: null,
			decidedAt: null,
			deletedAt: null,
			createdAt: now,
		});

		return { reviewId, characterId };
	}
}

export class ListReviewsUseCase {
	constructor(private readonly repo: CharactersRepository) {}

	async execute(input: { ownerId: string; userId: string; status?: string }) {
		const [pending, mine] = await Promise.all([
			this.repo.listReviewsForOwner(input.ownerId, input.status),
			this.repo.listReviewsForSubmitter(input.userId),
		]);
		return { pending, mine };
	}
}

export class DecideReviewUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		reviewId: string;
		approve: boolean;
		reason?: string;
	}) {
		const review = await this.repo.findReviewById(input.reviewId);
		if (
			!review ||
			review.ownerId !== input.ownerId ||
			review.deletedAt !== null
		) {
			throw new ReviewNotFoundError();
		}
		if (review.status !== "pending") {
			throw new ReviewAlreadyDecidedError();
		}

		const character = await this.repo.findCharacterById(review.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (character.sheetVersion !== review.submittedSheetVersion) {
			throw new ReviewSheetVersionConflictError(
				"Sheet has been modified since submission; re-submit the latest version",
			);
		}

		const now = this.clock.nowEpochMs();
		await this.repo.decideReview({
			id: review.id,
			status: input.approve ? "approved" : "rejected",
			decidedByUserId: input.ownerId,
			decidedAt: now,
			decisionReason: input.reason ?? null,
		});

		if (!input.approve) {
			return {
				approved: false,
				scope: review.scope as "module" | "session",
				targetId: review.targetId,
				characterIds: [] as string[],
			};
		}

		if (review.scope === "module") {
			const existingLink = await this.repo.findModuleCharacterLink(
				review.targetId,
				review.characterId,
			);
			if (existingLink) {
				await this.repo.restoreModuleCharacterLink(
					review.targetId,
					review.characterId,
				);
			} else {
				await this.repo.linkCharacterToModule({
					id: this.idGenerator.nextId(),
					moduleId: review.targetId,
					characterId: review.characterId,
					createdAt: now,
				});
			}
		}

		return {
			approved: true,
			scope: review.scope as "module" | "session",
			targetId: review.targetId,
			characterIds: [review.characterId],
		};
	}
}

export class GmEditPermanentFieldUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		characterId: string;
		field: string;
		value: number;
		sessionId?: string;
		reason?: string;
		expectedVersion?: number;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (input.expectedVersion !== undefined && input.expectedVersion !== character.version) {
			throw new CharacterVersionConflictError();
		}

		const ruleSystem = this.ruleRegistry.get(character.ruleId);
		const allowed = ruleSystem.metadata.permanentSheetFields;
		if (!allowed.includes(input.field)) {
			throw new PermanentFieldNotEditableError(
				`${input.field} is not a permanent field of ${character.ruleId}`,
			);
		}

		const sheet = ruleSystem.characterSheetSchema.parse(
			JSON.parse(character.sheetJson),
		);
		const before = ruleSystem.readPermanentFields(sheet);
		const nextSheet = ruleSystem.applyPermanentFieldEdit(sheet, {
			field: input.field,
			value: input.value,
		});
		const after = ruleSystem.readPermanentFields(nextSheet);

		const now = this.clock.nowEpochMs();
		const nextSheetJson = JSON.stringify(nextSheet);
		await this.repo.updateCharacter(character.id, {
			sheetJson: nextSheetJson,
			sheetVersion: character.sheetVersion + 1,
			version: character.version + 1,
			updatedAt: now,
		}, character.version);

		await this.repo.appendAudit({
			id: this.idGenerator.nextId(),
			characterId: character.id,
			sessionId: input.sessionId ?? null,
			gmUserId: input.ownerId,
			field: input.field,
			oldValue: String(before[input.field] ?? ""),
			newValue: String(after[input.field] ?? ""),
			reason: input.reason ?? null,
			createdAt: now,
		});

		await this.repo.appendVersion({
			id: this.idGenerator.nextId(),
			characterId: character.id,
			version: character.version + 1,
			sheetVersion: character.sheetVersion + 1,
			name: character.name,
			background: character.background,
			sheetJson: nextSheetJson,
			actorUserId: input.ownerId,
			reason: `permanent_field:${input.field}`,
			createdAt: now,
		});

		const updated = await this.repo.findCharacterById(character.id);
		if (!updated) {
			throw new CharacterNotFoundError();
		}
		return updated;
	}
}

export class ConfirmGrowthUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		characterId: string;
		sessionId: string;
		gains: Array<{ skillKey: string; delta: number }>;
		expectedVersion?: number;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (input.expectedVersion !== undefined && input.expectedVersion !== character.version) {
			throw new CharacterVersionConflictError();
		}

		const ruleSystem = this.ruleRegistry.get(character.ruleId);
		const now = this.clock.nowEpochMs();
		let sheet = ruleSystem.characterSheetSchema.parse(
			JSON.parse(character.sheetJson),
		);
		const entries: Array<{
			skillKey: string;
			oldValue: number;
			newValue: number;
		}> = [];

		for (const gain of input.gains) {
			const canonical = coc7e.canonicalizeCoc7eSkillKey(gain.skillKey) ?? gain.skillKey;
			if (canonical === "信用评级" || canonical === "克苏鲁神话") {
				continue;
			}
			const before = ruleSystem.getSkillTargetValue(sheet, gain.skillKey) ?? 0;
			const next = ruleSystem.applySkillGrowth(
				sheet,
				gain.skillKey,
				gain.delta,
			);
			const after =
				ruleSystem.getSkillTargetValue(next, gain.skillKey) ?? before;
			if (after !== before) {
				entries.push({
					skillKey: gain.skillKey,
					oldValue: before,
					newValue: after,
				});
			}
			sheet = next;
		}

		const nextSheetJson = JSON.stringify(sheet);
		await this.repo.updateCharacter(character.id, {
			sheetJson: nextSheetJson,
			sheetVersion: character.sheetVersion + 1,
			version: character.version + 1,
			updatedAt: now,
		}, character.version);

		for (const entry of entries) {
			await this.repo.appendGrowth({
				id: this.idGenerator.nextId(),
				characterId: character.id,
				sessionId: input.sessionId,
				skillKey: entry.skillKey,
				oldValue: entry.oldValue,
				newValue: entry.newValue,
				actorUserId: input.ownerId,
				reason: "session_growth",
				createdAt: now,
			});
		}

		await this.repo.appendVersion({
			id: this.idGenerator.nextId(),
			characterId: character.id,
			version: character.version + 1,
			sheetVersion: character.sheetVersion + 1,
			name: character.name,
			background: character.background,
			sheetJson: nextSheetJson,
			actorUserId: input.ownerId,
			reason: "growth_confirmed",
			createdAt: now,
		});

		return { applied: entries };
	}
}
