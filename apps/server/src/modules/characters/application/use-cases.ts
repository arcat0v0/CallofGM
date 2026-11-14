import { ModuleNotFoundError } from "@/modules/catalog";
import { AppError } from "@/platform/errors/app-error";
import type { Clock, IdGenerator, RandomSource } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import {
	CharacterNotFoundError,
	CharacterNotOwnedError,
	CharacterVersionConflictError,
	InvalidKindError,
	ModuleCharacterAlreadyLinkedError,
	PermanentFieldNotEditableError,
	StagingConsumedError,
	StagingExpiredError,
	StagingHasErrorsError,
	StagingOwnerMismatchError,
	StagingRecordNotFoundError,
} from "../domain/errors";
import type { CharactersRepository, CursorPageOptions } from "./ports";

const STAGING_TTL_MS = 30 * 60 * 1000;
const DEFAULT_OWNER_KIND = "gm";

function assertKind(kind: string): asserts kind is "pc" | "npc" {
	if (kind !== "pc" && kind !== "npc") {
		throw new InvalidKindError();
	}
}

function parseStagingErrors(errorsJson: string): unknown[] {
	try {
		const parsed: unknown = JSON.parse(errorsJson);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export class CreateCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		ownerKind?: "gm" | "pl";
		name: string;
		kind: string;
		ruleId: string;
		background?: string;
		sheetData?: unknown;
	}) {
		assertKind(input.kind);
		const ruleSystem = this.ruleRegistry.get(input.ruleId);
		const ownerKind = input.ownerKind ?? DEFAULT_OWNER_KIND;
		if (input.kind === "npc" && ownerKind !== "gm") {
			throw new InvalidKindError("NPCs must be owned by a game master");
		}
		if (input.kind === "pc" && ownerKind !== "pl" && ownerKind !== "gm") {
			throw new InvalidKindError("Invalid owner kind for PC");
		}

		const sheet = ruleSystem.characterSheetSchema.parse(
			input.sheetData ?? ruleSystem.createEmptySheet(),
		);
		const now = this.clock.nowEpochMs();
		const id = this.idGenerator.nextId();
		const sheetJson = JSON.stringify(sheet);

		await this.repo.saveCharacter({
			id,
			ownerId: input.ownerId,
			ownerKind,
			name: input.name,
			background: input.background ?? "",
			kind: input.kind,
			ruleId: input.ruleId,
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
			characterId: id,
			version: 1,
			sheetVersion: 1,
			name: input.name,
			background: input.background ?? "",
			sheetJson,
			actorUserId: input.ownerId,
			reason: "created",
			createdAt: now,
		});

		const created = await this.repo.findCharacterById(id);
		if (!created) {
			throw new CharacterNotFoundError();
		}
		return created;
	}
}

export class UpdateCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		name?: string;
		background?: string;
		kind?: string;
		sheetData?: unknown;
		expectedVersion?: number;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}

		const isOwner = character.ownerId === input.actorUserId;
		const sheetChanged = input.sheetData !== undefined;
		const statsChanged = sheetChanged && !isOwner;
		if (statsChanged) {
			throw new CharacterNotOwnedError("Only the owner may edit rule values");
		}
		if (!isOwner && !sheetChanged) {
			throw new CharacterNotOwnedError();
		}

		if (
			input.expectedVersion !== undefined &&
			input.expectedVersion !== character.version
		) {
			throw new CharacterVersionConflictError();
		}

		const now = this.clock.nowEpochMs();
		const patch: Parameters<CharactersRepository["updateCharacter"]>[1] = {
			updatedAt: now,
			version: character.version + 1,
		};

		let profileTouched = false;
		if (input.name !== undefined && input.name !== character.name) {
			patch.name = input.name;
			profileTouched = true;
		}
		if (
			input.background !== undefined &&
			input.background !== character.background
		) {
			patch.background = input.background;
			profileTouched = true;
		}
		if (input.kind !== undefined) {
			assertKind(input.kind);
			patch.kind = input.kind;
		}

		let sheetTouched = false;
		let nextSheetJson = character.sheetJson;
		let nextSheetVersion = character.sheetVersion;
		if (sheetChanged) {
			const ruleSystem = this.ruleRegistry.get(character.ruleId);
			const parsed = ruleSystem.characterSheetSchema.parse(input.sheetData);
			nextSheetJson = JSON.stringify(parsed);
			if (nextSheetJson !== character.sheetJson) {
				sheetTouched = true;
				nextSheetVersion = character.sheetVersion + 1;
				patch.sheetJson = nextSheetJson;
				patch.sheetVersion = nextSheetVersion;
			}
		}

		if (profileTouched) {
			patch.profileVersion = character.profileVersion + 1;
		}

		const updated = await this.repo.updateCharacter(
			character.id,
			patch,
			character.version,
		);

		if (sheetTouched || profileTouched) {
			await this.repo.appendVersion({
				id: this.idGenerator.nextId(),
				characterId: character.id,
				version: updated.version,
				sheetVersion: updated.sheetVersion,
				name: updated.name,
				background: updated.background,
				sheetJson: updated.sheetJson,
				actorUserId: input.actorUserId,
				reason: sheetTouched ? "sheet_updated" : "profile_updated",
				createdAt: now,
			});
		}

		return updated;
	}
}

export class DeleteCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		allowAnyOwner?: boolean;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (!input.allowAnyOwner && character.ownerId !== input.actorUserId) {
			throw new CharacterNotOwnedError();
		}
		await this.repo.softDeleteCharacter(character.id, this.clock.nowEpochMs());
		return { success: true };
	}
}

export class GetCharacterUseCase {
	constructor(private readonly repo: CharactersRepository) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		allowAnyOwner?: boolean;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (!input.allowAnyOwner && character.ownerId !== input.actorUserId) {
			throw new CharacterNotFoundError();
		}
		const portraits = await this.repo.listPortraitsByCharacterId(character.id);
		return { ...character, portraits };
	}
}

export class ListCharactersUseCase {
	constructor(private readonly repo: CharactersRepository) {}
	async execute(
		ownerId: string,
		options: CursorPageOptions & { kind?: string },
	) {
		return await this.repo.listCharacters(ownerId, options);
	}
}

export class GetCharacterHistoryUseCase {
	constructor(private readonly repo: CharactersRepository) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		allowAnyOwner?: boolean;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (!input.allowAnyOwner && character.ownerId !== input.actorUserId) {
			throw new CharacterNotFoundError();
		}
		const [versions, growth, audits] = await Promise.all([
			this.repo.listVersions(character.id),
			this.repo.listGrowth(character.id),
			this.repo.listAudits(character.id),
		]);
		return { versions, growth, audits };
	}
}

export class GetCharacterSheetContextUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
	) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		allowAnyOwner?: boolean;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (!input.allowAnyOwner && character.ownerId !== input.actorUserId) {
			throw new CharacterNotFoundError();
		}
		const [companionRows, phaseRecords, growthRecords] = await Promise.all([
			this.repo.listCharacterSessionCompanions(character.id),
			this.repo.listCharacterSessionPhaseRecords(character.id),
			this.repo.listGrowth(character.id),
		]);
		const companions = companionRows.map((row) => {
			let linkedToMe = false;
			try {
				const rule = this.ruleRegistry.get(row.ruleId);
				if (rule.readPartnerCharacterId) {
					const parsed = rule.characterSheetSchema.parse(
						JSON.parse(row.sheetJson),
					);
					linkedToMe = rule.readPartnerCharacterId(parsed) === character.id;
				}
			} catch {
				linkedToMe = false;
			}
			return {
				characterId: row.characterId,
				name: row.name,
				sessionId: row.sessionId,
				sessionName: row.sessionName,
				linkedToMe,
			};
		});
		return { companions, phaseRecords, growthRecords };
	}
}

export class AssignCharacterOwnerUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		characterId: string;
		targetUserId: string;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (character.ownerId !== input.ownerId) {
			throw new CharacterNotFoundError();
		}
		if (character.kind !== "pc") {
			throw new InvalidKindError(
				"Only pre-built PCs can be assigned to a player",
			);
		}
		return await this.repo.updateCharacter(character.id, {
			ownerId: input.targetUserId,
			ownerKind: "pl",
			version: character.version + 1,
			updatedAt: this.clock.nowEpochMs(),
		});
	}
}

export class AddPortraitUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly idGenerator: IdGenerator,
		private readonly randomSource: RandomSource,
		private readonly clock: Clock,
	) {}

	private async generateExpressionKey(characterId: string): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt++) {
			let key = "expr_";
			for (let i = 0; i < 10; i++) {
				key += this.randomSource.randomInt(0, 15).toString(16);
			}
			const collision = await this.repo.findPortraitByExpression(
				characterId,
				key,
			);
			if (!collision) {
				return key;
			}
		}
		throw new AppError(
			"EXPRESSION_KEY_EXHAUSTED",
			"Failed to generate a unique expression key",
			500,
		);
	}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		expressionKey?: string;
		label?: string;
		portraitAssetId: string;
		isDefault: boolean;
		sortOrder?: number;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (character.ownerId !== input.actorUserId) {
			throw new CharacterNotOwnedError();
		}

		const asset = await this.repo.findMediaAsset(input.portraitAssetId);
		if (!asset || asset.purpose !== "portrait") {
			throw new AppError("MEDIA_INVALID", "Media asset is not a portrait", 400);
		}

		const now = this.clock.nowEpochMs();
		const expressionKey =
			input.expressionKey ?? (await this.generateExpressionKey(character.id));
		const existing = await this.repo.findPortraitByExpression(
			character.id,
			expressionKey,
		);
		if (input.isDefault) {
			await this.repo.unsetDefaultPortraits(character.id);
		}

		if (existing) {
			await this.repo.updatePortrait(existing.id, {
				label: input.label ?? existing.label,
				isDefault: input.isDefault ? 1 : existing.isDefault,
				sortOrder: input.sortOrder ?? existing.sortOrder,
				deletedAt: null,
			});
			const refreshed = await this.repo.findPortraitById(existing.id);
			return refreshed ?? existing;
		}

		const portraits = await this.repo.listPortraitsByCharacterId(character.id);
		const nextSort =
			portraits.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
		const id = this.idGenerator.nextId();
		await this.repo.savePortrait({
			id,
			characterId: character.id,
			expressionKey,
			label: input.label ?? null,
			portraitAssetId: input.portraitAssetId,
			isDefault: input.isDefault ? 1 : 0,
			sortOrder: input.sortOrder ?? nextSort,
			deletedAt: null,
			createdAt: now,
		});
		const created = await this.repo.findPortraitById(id);
		if (!created) {
			throw new CharacterNotFoundError();
		}
		return created;
	}
}

export class UpdatePortraitUseCase {
	constructor(private readonly repo: CharactersRepository) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		portraitId: string;
		label?: string;
		isDefault?: boolean;
		sortOrder?: number;
		portraitAssetId?: string;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (
			!character ||
			character.deletedAt !== null ||
			character.ownerId !== input.actorUserId
		) {
			throw new CharacterNotFoundError();
		}
		const portrait = await this.repo.findPortraitById(input.portraitId);
		if (!portrait || portrait.characterId !== character.id) {
			throw new CharacterNotFoundError();
		}
		if (input.portraitAssetId !== undefined) {
			const asset = await this.repo.findMediaAsset(input.portraitAssetId);
			if (!asset || asset.purpose !== "portrait") {
				throw new AppError(
					"MEDIA_INVALID",
					"Media asset is not a portrait",
					400,
				);
			}
		}
		const patch: Parameters<CharactersRepository["updatePortrait"]>[1] = {};
		if (input.label !== undefined) patch.label = input.label;
		if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
		if (input.portraitAssetId !== undefined) {
			patch.portraitAssetId = input.portraitAssetId;
		}
		if (input.isDefault !== undefined) {
			if (input.isDefault) {
				await this.repo.unsetDefaultPortraits(character.id);
			}
			patch.isDefault = input.isDefault ? 1 : 0;
		}
		await this.repo.updatePortrait(portrait.id, patch);
		return await this.repo.findPortraitById(portrait.id);
	}
}

export class DeletePortraitUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		actorUserId: string;
		characterId: string;
		portraitId: string;
	}) {
		const character = await this.repo.findCharacterById(input.characterId);
		if (
			!character ||
			character.deletedAt !== null ||
			character.ownerId !== input.actorUserId
		) {
			throw new CharacterNotFoundError();
		}
		const portrait = await this.repo.findPortraitById(input.portraitId);
		if (!portrait || portrait.characterId !== character.id) {
			throw new CharacterNotFoundError();
		}
		const portraits = await this.repo.listPortraitsByCharacterId(character.id);
		const fallback =
			portraits.find((p) => p.isDefault === 1 && p.id !== portrait.id)
				?.expressionKey ?? null;
		await this.repo.updatePortrait(portrait.id, {
			deletedAt: this.clock.nowEpochMs(),
		});
		await this.repo.resetSessionCharacterExpression(
			character.id,
			portrait.expressionKey,
			fallback,
		);
		return { success: true };
	}
}

export class ImportPreviewUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		ruleId: string;
		file: ArrayBuffer;
		characterId?: string;
	}) {
		const ruleSystem = this.ruleRegistry.get(input.ruleId);
		if (!ruleSystem.parseCharacterSheet) {
			throw new AppError(
				"RULE_ACTION_UNSUPPORTED",
				"This rule does not support character sheet import",
				400,
			);
		}
		if (input.characterId) {
			const existing = await this.repo.findCharacterById(input.characterId);
			if (
				!existing ||
				existing.deletedAt !== null ||
				existing.ownerId !== input.ownerId
			) {
				throw new CharacterNotFoundError();
			}
			if (existing.ruleId !== input.ruleId) {
				throw new AppError(
					"CHARACTER_RULE_MISMATCH",
					"Character rule does not match import rule",
					400,
				);
			}
		}
		const preview = await ruleSystem.parseCharacterSheet(input.file, {
			partial: input.characterId !== undefined,
		});
		const now = this.clock.nowEpochMs();
		const importToken = this.idGenerator.nextId();

		await this.repo.saveStaging({
			id: importToken,
			ownerId: input.ownerId,
			characterName:
				preview.nameProvided === false ? "" : preview.characterName,
			sheetJson: JSON.stringify(preview.sheetData),
			patchJson: JSON.stringify(preview.patch ?? preview.sheetData),
			ruleId: input.ruleId,
			errorsJson: JSON.stringify(preview.errors ?? []),
			expiresAt: now + STAGING_TTL_MS,
			consumedAt: null,
			createdAt: now,
		});

		return {
			importToken,
			preview: {
				characterName: preview.characterName,
				sheetData: preview.sheetData,
				errors: preview.errors ?? [],
				warnings: preview.warnings ?? [],
				providedFields: preview.providedFields ?? [],
			},
		};
	}
}

export class ImportConfirmUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly ruleRegistry: RuleRegistry,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		importToken: string;
		kind: string;
		moduleId?: string;
		characterId?: string;
		expectedVersion?: number;
		ownerKind?: "gm" | "pl";
	}) {
		const staging = await this.repo.findStagingById(input.importToken);
		if (!staging) {
			throw new StagingRecordNotFoundError();
		}
		if (staging.ownerId !== input.ownerId) {
			throw new StagingOwnerMismatchError();
		}
		if (staging.consumedAt !== null) {
			throw new StagingConsumedError();
		}
		if (staging.expiresAt < this.clock.nowEpochMs()) {
			throw new StagingExpiredError();
		}
		if (parseStagingErrors(staging.errorsJson).length > 0) {
			throw new StagingHasErrorsError();
		}

		assertKind(input.kind);
		const now = this.clock.nowEpochMs();

		let characterId = input.characterId;
		if (characterId) {
			const existing = await this.repo.findCharacterById(characterId);
			if (
				!existing ||
				existing.deletedAt !== null ||
				existing.ownerId !== input.ownerId
			) {
				throw new CharacterNotFoundError();
			}
			if (existing.ruleId !== staging.ruleId) {
				throw new AppError(
					"CHARACTER_RULE_MISMATCH",
					"Character rule does not match import rule",
					400,
				);
			}
			if (
				input.expectedVersion !== undefined &&
				input.expectedVersion !== existing.version
			) {
				throw new CharacterVersionConflictError();
			}
			const ruleSystem = this.ruleRegistry.get(existing.ruleId);
			const existingSheet = ruleSystem.characterSheetSchema.parse(
				JSON.parse(existing.sheetJson),
			);
			const importedSheet = JSON.parse(staging.sheetJson);
			const importedPatch = staging.patchJson
				? JSON.parse(staging.patchJson)
				: importedSheet;
			const mergedSheet = ruleSystem.mergeSheetPatch(
				existingSheet,
				importedPatch,
			);
			const mergedJson = JSON.stringify(mergedSheet);
			await this.repo.updateCharacter(
				existing.id,
				{
					name: staging.characterName || existing.name,
					kind: input.kind,
					sheetJson: mergedJson,
					sheetVersion: existing.sheetVersion + 1,
					version: existing.version + 1,
					updatedAt: now,
				},
				existing.version,
			);
			const refreshed = await this.repo.findCharacterById(existing.id);
			await this.repo.appendVersion({
				id: this.idGenerator.nextId(),
				characterId: existing.id,
				version: refreshed?.version ?? existing.version + 1,
				sheetVersion: refreshed?.sheetVersion ?? existing.sheetVersion + 1,
				name: refreshed?.name ?? staging.characterName ?? existing.name,
				background: refreshed?.background ?? "",
				sheetJson: mergedJson,
				actorUserId: input.ownerId,
				reason: "imported",
				createdAt: now,
			});
		} else {
			const ruleSystem = this.ruleRegistry.get(staging.ruleId);
			const sheetData = ruleSystem.characterSheetSchema.parse(
				JSON.parse(staging.sheetJson),
			);
			const sheetJson = JSON.stringify(sheetData);
			characterId = this.idGenerator.nextId();
			await this.repo.saveCharacter({
				id: characterId,
				ownerId: input.ownerId,
				ownerKind: input.ownerKind ?? "gm",
				name: staging.characterName || "无名氏",
				background: "",
				kind: input.kind,
				ruleId: staging.ruleId,
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
				name: staging.characterName || "无名氏",
				background: "",
				sheetJson,
				actorUserId: input.ownerId,
				reason: "imported",
				createdAt: now,
			});
		}

		if (input.moduleId) {
			const module = await this.repo.findModule(input.moduleId);
			if (!module || module.ownerId !== input.ownerId) {
				throw new ModuleNotFoundError();
			}
			if (module.ruleId !== staging.ruleId) {
				throw new AppError(
					"CHARACTER_RULE_MISMATCH",
					"Character rule does not match module rule",
					400,
				);
			}
			const existingLink = await this.repo.findModuleCharacterLink(
				input.moduleId,
				characterId,
			);
			if (existingLink) {
				await this.repo.restoreModuleCharacterLink(input.moduleId, characterId);
			} else {
				await this.repo.linkCharacterToModule({
					id: this.idGenerator.nextId(),
					moduleId: input.moduleId,
					characterId,
					createdAt: now,
				});
			}
		}

		await this.repo.consumeStaging(staging.id, now);
		return await this.repo.findCharacterById(characterId);
	}
}

export class ListModuleCharactersUseCase {
	constructor(private readonly repo: CharactersRepository) {}
	async execute(moduleId: string, options: CursorPageOptions) {
		return await this.repo.listModuleCharacters(moduleId, options);
	}
}

export class LinkModuleCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		moduleId: string;
		characterId: string;
	}) {
		const module = await this.repo.findModule(input.moduleId);
		if (!module || module.ownerId !== input.ownerId) {
			throw new ModuleNotFoundError();
		}
		const character = await this.repo.findCharacterById(input.characterId);
		if (!character || character.deletedAt !== null) {
			throw new CharacterNotFoundError();
		}
		if (character.ruleId !== module.ruleId) {
			throw new AppError(
				"CHARACTER_RULE_MISMATCH",
				"Character rule does not match module rule",
				400,
			);
		}
		const existing = await this.repo.findModuleCharacterLink(
			input.moduleId,
			input.characterId,
		);
		if (existing) {
			await this.repo.restoreModuleCharacterLink(
				input.moduleId,
				input.characterId,
			);
		} else {
			await this.repo.linkCharacterToModule({
				id: this.idGenerator.nextId(),
				moduleId: input.moduleId,
				characterId: input.characterId,
				createdAt: this.clock.nowEpochMs(),
			});
		}
		return { success: true };
	}
}

export class UnlinkModuleCharacterUseCase {
	constructor(
		private readonly repo: CharactersRepository,
		private readonly clock: Clock,
	) {}

	async execute(input: {
		ownerId: string;
		moduleId: string;
		characterId: string;
	}) {
		const module = await this.repo.findModule(input.moduleId);
		if (!module || module.ownerId !== input.ownerId) {
			throw new ModuleNotFoundError();
		}
		await this.repo.unlinkModuleCharacter(
			input.moduleId,
			input.characterId,
			this.clock.nowEpochMs(),
		);
		return { success: true };
	}
}

export {
	ConfirmGrowthUseCase,
	CreateCharacterInviteUseCase,
	DecideReviewUseCase,
	GetInviteInfoUseCase,
	GmEditPermanentFieldUseCase,
	ListCharacterInvitesUseCase,
	ListReviewsUseCase,
	RevokeCharacterInviteUseCase,
	SubmitCharacterUseCase,
} from "./lifecycle";
export { ApplyCharacterSyncUseCase, PreviewCharacterSyncUseCase } from "./sync";
export { ModuleCharacterAlreadyLinkedError, PermanentFieldNotEditableError };
