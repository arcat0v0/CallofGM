import { ModuleNotFoundError } from "@/modules/catalog";
import { hashToken, issueOpaqueToken } from "@/modules/identity";
import { SessionNotFoundError } from "@/modules/sessions";
import { AppError } from "@/platform/errors/app-error";
import type { Clock, IdGenerator, RandomSource } from "@/platform/ports";
import {
	findCharacterCreationCapability,
	requireSkillGrowthCapability,
} from "@/rules/capabilities";
import type { RuleRegistry } from "@/rules/registry";
import {
	CharacterNotFoundError,
	CharacterNotOwnedError,
	CharacterVersionConflictError,
	CreationMethodUnsupportedError,
	CreationRollInvalidChoiceError,
	CreationRollLockedError,
	CreationRollNotAvailableError,
	CreationRollNotFoundError,
	CreationRollRequiredError,
	InviteExpiredError,
	InviteNotFoundError,
	PermanentFieldNotEditableError,
	ReviewAlreadyDecidedError,
	ReviewNotFoundError,
	ReviewSheetVersionConflictError,
} from "../domain/errors";
import type {
	CharacterCreationRollRecord,
	CharacterInviteRecord,
	CharactersRepository,
} from "./ports";

const INVITE_DEFAULT_DAYS = 7;

function parseJsonOrNull(json: string | null): unknown {
	return json === null ? null : (JSON.parse(json) as unknown);
}

export function toCreationRollDto(record: CharacterCreationRollRecord) {
	return {
		id: record.id,
		ruleId: record.ruleId,
		options: JSON.parse(record.optionsJson) as unknown,
		result: JSON.parse(record.resultJson) as unknown,
		chosenIndex: record.chosenIndex,
		createdAt: record.createdAt,
		chosenAt: record.chosenAt,
		lockedAt: record.lockedAt,
	};
}

/** 按 token 取仍有效的提交链接及其目标规则 */
async function resolveActiveInvite(
	repo: CharactersRepository,
	clock: Clock,
	tokenHasher: (token: string) => string,
	token: string,
): Promise<{
	invite: CharacterInviteRecord;
	ruleId: string;
	targetName: string;
}> {
	const invite = await repo.findInviteByTokenHash(tokenHasher(token));
	if (!invite) {
		throw new InviteNotFoundError();
	}
	if (invite.revokedAt !== null || invite.expiresAt < clock.nowEpochMs()) {
		throw new InviteExpiredError();
	}
	const target =
		invite.scope === "module"
			? await repo.findModule(invite.targetId)
			: await repo.findSession(invite.targetId);
	if (!target) {
		throw new InviteExpiredError();
	}
	return {
		invite,
		ruleId: target.ruleId,
		targetName: target.name ?? invite.targetId,
	};
}

export class CreateCharacterInviteUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		scope: "module" | "session";
		targetId: string;
		expiresInDays?: number;
		creationOptions?: unknown;
	}) {
		let ruleId: string;
		if (input.scope === "module") {
			const module = await this.repo.findModule(input.targetId);
			if (!module || module.ownerId !== input.ownerId) {
				throw new ModuleNotFoundError();
			}
			ruleId = module.ruleId;
		} else {
			const session = await this.repo.findSession(input.targetId);
			if (!session || session.ownerId !== input.ownerId) {
				throw new SessionNotFoundError();
			}
			ruleId = session.ruleId;
		}

		let creationOptions: unknown = null;
		if (input.creationOptions !== undefined && input.creationOptions !== null) {
			const capability = findCharacterCreationCapability(
				this.ruleRegistry.get(ruleId),
			);
			if (!capability) {
				throw new CreationMethodUnsupportedError();
			}
			creationOptions = capability.parseCreationOptions(input.creationOptions);
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
			creationOptionsJson:
				creationOptions === null ? null : JSON.stringify(creationOptions),
			expiresAt: now + days * 24 * 60 * 60 * 1000,
			revokedAt: null,
			deletedAt: null,
			createdAt: now,
		});

		return {
			id,
			token: issued.token,
			creationOptions,
			expiresAt: now + days * 24 * 60 * 60 * 1000,
			createdAt: now,
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
					creationOptions: parseJsonOrNull(invite.creationOptionsJson),
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
		const { invite, ruleId, targetName } = await resolveActiveInvite(
			this.repo,
			this.clock,
			this.tokenHasher,
			input.token,
		);

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
				alreadySubmitted:
					review !== null &&
					review.status !== "rejected" &&
					review.submittedSheetVersion === character.sheetVersion,
			});
		}

		const roll = await this.repo.findCreationRoll(invite.id, input.userId);

		return {
			scope: invite.scope as "module" | "session",
			targetId: invite.targetId,
			targetName,
			ruleId,
			expiresAt: invite.expiresAt,
			creationOptions: parseJsonOrNull(invite.creationOptionsJson),
			creationRoll: roll ? toCreationRollDto(roll) : null,
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
		const { invite, ruleId: targetRuleId } = await resolveActiveInvite(
			this.repo,
			this.clock,
			this.tokenHasher,
			input.token,
		);
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
			const trimmedName = (input.name ?? "").trim();
			const trimmedBackground = (input.background ?? "").trim();
			if (!trimmedName || !trimmedBackground) {
				throw new AppError(
					"VALIDATION_FAILED",
					"Character name and detailed background are required",
					400,
				);
			}
			const ruleSystem = this.ruleRegistry.get(targetRuleId);
			const sheet = ruleSystem.characterSheetSchema.parse(
				input.sheetData ?? ruleSystem.createEmptySheet(),
			);
			const sheetJson = JSON.stringify(sheet);
			if (invite.creationOptionsJson !== null) {
				const roll = await this.repo.findCreationRoll(invite.id, input.userId);
				if (!roll || roll.chosenIndex === null) {
					throw new CreationRollRequiredError();
				}
				await this.repo.lockCreationRoll(roll.id, now);
			}
			characterId = this.idGenerator.nextId();
			await this.repo.saveCharacter({
				id: characterId,
				ownerId: input.userId,
				ownerKind: "pl",
				name: trimmedName,
				background: trimmedBackground,
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
				name: trimmedName,
				background: trimmedBackground,
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

		const reviewId = this.idGenerator.nextId();
		await this.repo.replacePendingReview(
			{
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
			},
			now,
		);

		return { reviewId, characterId };
	}
}

/** PL 在提交链接上进行车卡属性生成：每人每条链接只掷一次，重复调用返回已有结果 */
export class RollCreationUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly random: RandomSource,
		private readonly tokenHasher: (token: string) => string = hashToken,
	) {}

	async execute(input: { token: string; userId: string }) {
		const { invite, ruleId } = await resolveActiveInvite(
			this.repo,
			this.clock,
			this.tokenHasher,
			input.token,
		);
		if (invite.creationOptionsJson === null) {
			throw new CreationRollNotAvailableError();
		}
		const existing = await this.repo.findCreationRoll(invite.id, input.userId);
		if (existing) {
			return toCreationRollDto(existing);
		}
		const capability = findCharacterCreationCapability(
			this.ruleRegistry.get(ruleId),
		);
		if (!capability) {
			throw new CreationMethodUnsupportedError();
		}
		const options = capability.parseCreationOptions(
			JSON.parse(invite.creationOptionsJson),
		);
		const result = capability.rollCreation(options, this.random);
		const now = this.clock.nowEpochMs();
		const singleChoice = capability.creationChoiceCount(result) === 1;
		const stored = await this.repo.saveCreationRollOnce({
			id: this.idGenerator.nextId(),
			inviteId: invite.id,
			userId: input.userId,
			ruleId,
			optionsJson: JSON.stringify(options),
			resultJson: JSON.stringify(result),
			chosenIndex: singleChoice ? 0 : null,
			chosenAt: singleChoice ? now : null,
			lockedAt: null,
			createdAt: now,
		});
		return toCreationRollDto(stored);
	}
}

/** PL 在提交人物前可反复改选天命套数或改购点；提交后锁定 */
export class ChooseCreationRollUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly clock: Clock,
		private readonly tokenHasher: (token: string) => string = hashToken,
	) {}

	async execute(input: { token: string; userId: string; index: number }) {
		const { invite, ruleId } = await resolveActiveInvite(
			this.repo,
			this.clock,
			this.tokenHasher,
			input.token,
		);
		const roll = await this.repo.findCreationRoll(invite.id, input.userId);
		if (!roll) {
			throw new CreationRollNotFoundError();
		}
		if (roll.lockedAt !== null) {
			throw new CreationRollLockedError();
		}
		const capability = findCharacterCreationCapability(
			this.ruleRegistry.get(ruleId),
		);
		if (!capability) {
			throw new CreationMethodUnsupportedError();
		}
		const count = capability.creationChoiceCount(JSON.parse(roll.resultJson));
		if (input.index < 0 || input.index >= count) {
			throw new CreationRollInvalidChoiceError();
		}
		const chosenAt = this.clock.nowEpochMs();
		if (!(await this.repo.chooseCreationRoll(roll.id, input.index, chosenAt))) {
			throw new CreationRollLockedError();
		}
		return toCreationRollDto({ ...roll, chosenIndex: input.index, chosenAt });
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
		if (
			input.expectedVersion !== undefined &&
			input.expectedVersion !== character.version
		) {
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
		await this.repo.updateCharacter(
			character.id,
			{
				sheetJson: nextSheetJson,
				sheetVersion: character.sheetVersion + 1,
				version: character.version + 1,
				updatedAt: now,
			},
			character.version,
		);

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
		if (
			input.expectedVersion !== undefined &&
			input.expectedVersion !== character.version
		) {
			throw new CharacterVersionConflictError();
		}

		const ruleSystem = this.ruleRegistry.get(character.ruleId);
		const now = this.clock.nowEpochMs();
		const currentSheet = ruleSystem.characterSheetSchema.parse(
			JSON.parse(character.sheetJson),
		);
		const { sheet, applied } = requireSkillGrowthCapability(
			ruleSystem,
		).applySkillGrowthBatch(currentSheet, input.gains);

		const nextSheetJson = JSON.stringify(sheet);
		await this.repo.updateCharacter(
			character.id,
			{
				sheetJson: nextSheetJson,
				sheetVersion: character.sheetVersion + 1,
				version: character.version + 1,
				updatedAt: now,
			},
			character.version,
		);

		for (const entry of applied) {
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

		return { applied };
	}
}
