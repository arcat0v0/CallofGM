import { z } from "zod";
import { RuleId } from "./rules/rule-id";
import { CharacterRole } from "./session";

export const CharacterOwnerKind = z.enum(["gm", "pl"]);
export type CharacterOwnerKind = z.infer<typeof CharacterOwnerKind>;

export const CreateCharacterRequest = z.object({
	name: z.string().trim().min(1).max(100),
	kind: CharacterRole,
	ruleId: RuleId,
	background: z.string().max(4000).optional(),
	sheetData: z.unknown().optional(),
});
export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequest>;

export const CreatePlCharacterRequest = CreateCharacterRequest.omit({
	kind: true,
});
export type CreatePlCharacterRequest = z.infer<typeof CreatePlCharacterRequest>;

export const UpdateCharacterRequest = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	background: z.string().max(4000).optional(),
	kind: CharacterRole.optional(),
	sheetData: z.unknown().optional(),
	expectedVersion: z.number().int().positive().optional(),
});
export type UpdateCharacterRequest = z.infer<typeof UpdateCharacterRequest>;

export const AssignCharacterOwnerRequest = z.object({
	ownerId: z.string().min(1),
});
export type AssignCharacterOwnerRequest = z.infer<
	typeof AssignCharacterOwnerRequest
>;

export const ImportConfirmRequest = z.object({
	importToken: z.string().min(1),
	kind: CharacterRole,
	ruleId: RuleId.optional(),
	moduleId: z.string().min(1).optional(),
	characterId: z.string().min(1).optional(),
	expectedVersion: z.number().int().positive().optional(),
});
export type ImportConfirmRequest = z.infer<typeof ImportConfirmRequest>;

export const AddPortraitRequest = z.object({
	expressionKey: z.string().trim().min(1).max(64).optional(),
	label: z.string().trim().max(64).optional(),
	portraitAssetId: z.string().min(1),
	isDefault: z.boolean().default(false),
	sortOrder: z.number().int().min(0).optional(),
});
export type AddPortraitRequest = z.infer<typeof AddPortraitRequest>;

export const UpdatePortraitRequest = z.object({
	label: z.string().trim().max(64).optional(),
	isDefault: z.boolean().optional(),
	sortOrder: z.number().int().min(0).optional(),
	portraitAssetId: z.string().min(1).optional(),
});
export type UpdatePortraitRequest = z.infer<typeof UpdatePortraitRequest>;

export const CharacterDto = z.object({
	id: z.string(),
	ownerId: z.string(),
	ownerKind: CharacterOwnerKind,
	name: z.string(),
	background: z.string(),
	kind: CharacterRole,
	ruleId: RuleId,
	sheetJson: z.string(),
	sheetVersion: z.number().int(),
	profileVersion: z.number().int(),
	version: z.number().int(),
	originType: z.string().nullable(),
	originRefId: z.string().nullable(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});
export type CharacterDto = z.infer<typeof CharacterDto>;

export const CharacterPortraitDto = z.object({
	id: z.string(),
	characterId: z.string(),
	expressionKey: z.string(),
	label: z.string().nullable(),
	portraitAssetId: z.string(),
	isDefault: z.number().int().min(0).max(1),
	sortOrder: z.number().int(),
	createdAt: z.number().int(),
});
export type CharacterPortraitDto = z.infer<typeof CharacterPortraitDto>;

export const CharacterDetailDto = CharacterDto.extend({
	portraits: z.array(CharacterPortraitDto),
});
export type CharacterDetailDto = z.infer<typeof CharacterDetailDto>;

export const CharacterImportErrorDto = z.object({
	cell: z.string(),
	message: z.string(),
});
export type CharacterImportErrorDto = z.infer<typeof CharacterImportErrorDto>;

export const CharacterImportPreviewResponse = z.object({
	importToken: z.string(),
	preview: z.object({
		characterName: z.string(),
		sheetData: z.unknown(),
		errors: z.array(CharacterImportErrorDto),
		warnings: z.array(CharacterImportErrorDto).default([]),
		providedFields: z.array(z.string()).default([]),
	}),
});
export type CharacterImportPreviewResponse = z.infer<
	typeof CharacterImportPreviewResponse
>;

export const CharacterVersionDto = z.object({
	id: z.string(),
	characterId: z.string(),
	version: z.number().int(),
	sheetVersion: z.number().int(),
	name: z.string(),
	background: z.string(),
	sheetJson: z.string(),
	actorUserId: z.string().nullable(),
	reason: z.string(),
	createdAt: z.number().int(),
});
export type CharacterVersionDto = z.infer<typeof CharacterVersionDto>;

export const CharacterGrowthEntryDto = z.object({
	id: z.string(),
	characterId: z.string(),
	sessionId: z.string().nullable(),
	skillKey: z.string(),
	oldValue: z.number().int(),
	newValue: z.number().int(),
	actorUserId: z.string().nullable(),
	reason: z.string(),
	createdAt: z.number().int(),
});
export type CharacterGrowthEntryDto = z.infer<typeof CharacterGrowthEntryDto>;

export const CharacterAuditDto = z.object({
	id: z.string(),
	characterId: z.string(),
	sessionId: z.string().nullable(),
	gmUserId: z.string().nullable(),
	field: z.string(),
	oldValue: z.string(),
	newValue: z.string(),
	reason: z.string().nullable(),
	createdAt: z.number().int(),
});
export type CharacterAuditDto = z.infer<typeof CharacterAuditDto>;

export const CharacterHistoryResponse = z.object({
	versions: z.array(CharacterVersionDto),
	growth: z.array(CharacterGrowthEntryDto),
	audits: z.array(CharacterAuditDto),
});
export type CharacterHistoryResponse = z.infer<typeof CharacterHistoryResponse>;

export const GmPermanentFieldEditRequest = z.object({
	field: z.string().min(1).max(64),
	value: z.number().int(),
	sessionId: z.string().min(1).optional(),
	reason: z.string().max(500).optional(),
	expectedVersion: z.number().int().positive().optional(),
});
export type GmPermanentFieldEditRequest = z.infer<
	typeof GmPermanentFieldEditRequest
>;

export const CharacterInviteScope = z.enum(["module", "session"]);
export type CharacterInviteScope = z.infer<typeof CharacterInviteScope>;

export const CharacterCompanionDto = z.object({
	characterId: z.string(),
	name: z.string(),
	sessionId: z.string(),
	sessionName: z.string(),
	linkedToMe: z.boolean().default(false),
});
export type CharacterCompanionDto = z.infer<typeof CharacterCompanionDto>;

export const CharacterSessionPhaseRecordDto = z.object({
	eventId: z.number().int(),
	sessionId: z.string(),
	sessionName: z.string(),
	phase: z.string(),
	occurredAt: z.number().int(),
});
export type CharacterSessionPhaseRecordDto = z.infer<
	typeof CharacterSessionPhaseRecordDto
>;

export const CharacterSheetContextResponse = z.object({
	companions: z.array(CharacterCompanionDto),
	phaseRecords: z.array(CharacterSessionPhaseRecordDto),
	growthRecords: z.array(CharacterGrowthEntryDto),
});
export type CharacterSheetContextResponse = z.infer<
	typeof CharacterSheetContextResponse
>;

export const CreateCharacterInviteRequest = z.object({
	scope: CharacterInviteScope,
	targetId: z.string().min(1),
	expiresInDays: z.number().int().min(1).max(90).default(7),
	/** 规则专属的车卡属性生成方式（如 CoC 7e 天命/购点），由服务端按规则系统校验；缺省为手填 */
	creationOptions: z.unknown().optional(),
});
export type CreateCharacterInviteRequest = z.infer<
	typeof CreateCharacterInviteRequest
>;

export const CharacterInviteDto = z.object({
	id: z.string(),
	scope: CharacterInviteScope,
	targetId: z.string(),
	targetName: z.string().nullable(),
	token: z.string().nullable(),
	creationOptions: z.unknown().nullable().default(null),
	expiresAt: z.number().int(),
	revokedAt: z.number().int().nullable(),
	createdAt: z.number().int(),
});
export type CharacterInviteDto = z.infer<typeof CharacterInviteDto>;

/**
 * 车卡属性生成记录：每位 PL 在每条提交链接上只能掷一次，结果由服务端生成并保存。
 * result 为规则专属结构；chosenIndex 为玩家当前选定的一项（规则不需要选择时为 0，
 * 天命可改购点时最后一个候选项为改购点）。提交人物前可改选，lockedAt 写入后锁定。
 */
export const CharacterCreationRollDto = z.object({
	id: z.string(),
	ruleId: RuleId,
	options: z.unknown(),
	result: z.unknown(),
	chosenIndex: z.number().int().min(0).nullable(),
	createdAt: z.number().int(),
	chosenAt: z.number().int().nullable(),
	lockedAt: z.number().int().nullable().default(null),
});
export type CharacterCreationRollDto = z.infer<typeof CharacterCreationRollDto>;

export const ChooseCreationRollRequest = z.object({
	index: z.number().int().min(0),
});
export type ChooseCreationRollRequest = z.infer<
	typeof ChooseCreationRollRequest
>;

export const CharacterInviteInfoResponse = z.object({
	scope: CharacterInviteScope,
	targetId: z.string(),
	targetName: z.string(),
	ruleId: RuleId,
	expiresAt: z.number().int(),
	creationOptions: z.unknown().nullable().default(null),
	creationRoll: CharacterCreationRollDto.nullable().default(null),
	ownedCharacters: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			ruleId: RuleId,
			sheetVersion: z.number().int().nullable(),
			alreadySubmitted: z.boolean(),
		}),
	),
});
export type CharacterInviteInfoResponse = z.infer<
	typeof CharacterInviteInfoResponse
>;

export const SubmitCharacterRequest = z.object({
	mode: z.enum(["new", "existing"]),
	characterId: z.string().min(1).optional(),
	name: z.string().trim().min(1).max(100).optional(),
	background: z.string().max(4000).optional(),
	sheetData: z.unknown().optional(),
});
export type SubmitCharacterRequest = z.infer<typeof SubmitCharacterRequest>;

export const CharacterReviewStatus = z.enum([
	"pending",
	"approved",
	"rejected",
]);
export type CharacterReviewStatus = z.infer<typeof CharacterReviewStatus>;

export const CharacterReviewDto = z.object({
	id: z.string(),
	inviteId: z.string().nullable(),
	scope: CharacterInviteScope,
	targetId: z.string(),
	targetName: z.string().nullable(),
	characterId: z.string(),
	characterName: z.string(),
	submittedByUserId: z.string(),
	submittedByName: z.string().nullable(),
	submittedSheetVersion: z.number().int(),
	status: CharacterReviewStatus,
	decisionReason: z.string().nullable(),
	decidedByUserId: z.string().nullable(),
	decidedAt: z.number().int().nullable(),
	createdAt: z.number().int(),
	ruleId: RuleId.nullable().default(null),
	/** 提交时人物卡（仅当人物当前版本仍为提交版本时给出），供规则比对车卡掷骰结果 */
	submittedSheet: z.unknown().nullable().default(null),
	/** 该提交者在这条链接上的车卡掷骰记录；链接未设定生成方式或未掷时为 null */
	creationRoll: CharacterCreationRollDto.nullable().default(null),
});
export type CharacterReviewDto = z.infer<typeof CharacterReviewDto>;

export const DecideReviewRequest = z.object({
	approve: z.boolean(),
	reason: z.string().max(500).optional(),
});
export type DecideReviewRequest = z.infer<typeof DecideReviewRequest>;

export const CharacterSyncField = z.enum(["name", "background", "sheet"]);
export type CharacterSyncField = z.infer<typeof CharacterSyncField>;

export const SyncStatePreviewDto = z.object({
	current: z.record(z.string(), z.number().int()),
	next: z.record(z.string(), z.number().int()),
});

export const CharacterSyncDiffDto = z.object({
	characterId: z.string(),
	sessionId: z.string(),
	sessionName: z.string(),
	currentName: z.string(),
	currentBackground: z.string(),
	currentSheetJson: z.string(),
	baseName: z.string(),
	baseBackground: z.string(),
	baseSheetJson: z.string(),
	currentVersion: z.number().int(),
	baseVersion: z.number().int(),
	staleReview: z.boolean(),
	statePreview: SyncStatePreviewDto.optional(),
});
export type CharacterSyncDiffDto = z.infer<typeof CharacterSyncDiffDto>;

export const ApplyCharacterSyncRequest = z.object({
	fields: z.array(CharacterSyncField).min(1),
	expectedVersion: z.number().int().positive(),
});
export type ApplyCharacterSyncRequest = z.infer<
	typeof ApplyCharacterSyncRequest
>;

export const ConfirmGrowthRequest = z.object({
	gains: z
		.array(
			z.object({
				skillKey: z.string().min(1),
				delta: z.number().int().min(0).max(99),
			}),
		)
		.min(1),
});
export type ConfirmGrowthRequest = z.infer<typeof ConfirmGrowthRequest>;

/** GM 人物库：按规则浏览的轻量列表（不含人物卡 JSON，规则无关） */
export const GmCharacterLibrarySort = z.enum(["updated", "name", "portrait"]);
export type GmCharacterLibrarySort = z.infer<typeof GmCharacterLibrarySort>;

export const GmCharacterLibraryQuery = z.object({
	ruleId: RuleId,
	kind: CharacterRole.optional(),
	ownerKind: CharacterOwnerKind.optional(),
	/** 模组 ID；`none` 表示未关联任何本人模组的人物 */
	moduleId: z.string().trim().min(1).max(64).optional(),
	q: z.string().trim().max(100).optional(),
	sort: GmCharacterLibrarySort.default("updated"),
	limit: z.coerce.number().int().min(1).max(200).default(100),
	/** 不透明游标（当前实现为偏移量） */
	cursor: z.string().regex(/^\d+$/).optional(),
});
export type GmCharacterLibraryQuery = z.infer<typeof GmCharacterLibraryQuery>;

export const GmCharacterLibraryModuleRef = z.object({
	id: z.string(),
	name: z.string(),
});
export type GmCharacterLibraryModuleRef = z.infer<
	typeof GmCharacterLibraryModuleRef
>;

export const GmCharacterLibraryItemDto = z.object({
	id: z.string(),
	name: z.string(),
	kind: CharacterRole,
	ruleId: RuleId,
	ownerKind: CharacterOwnerKind,
	/** 是否由当前 GM 持有；否则为玩家持有，只读 */
	ownedByMe: z.boolean(),
	/** 玩家持有时的玩家用户名 */
	ownerName: z.string().nullable(),
	modules: z.array(GmCharacterLibraryModuleRef),
	portraitAssetId: z.string().nullable(),
	expressionCount: z.number().int().min(0),
	updatedAt: z.number().int(),
});
export type GmCharacterLibraryItemDto = z.infer<
	typeof GmCharacterLibraryItemDto
>;

export const GmCharacterLibraryFacetCount = z.object({
	id: z.string(),
	name: z.string(),
	count: z.number().int().min(0),
});

/** 分面计数：每个维度的计数按“其余已选条件”计算 */
export const GmCharacterLibraryFacets = z.object({
	rules: z.array(z.object({ ruleId: RuleId, count: z.number().int() })),
	all: z.number().int(),
	kinds: z.object({ pc: z.number().int(), npc: z.number().int() }),
	owners: z.object({ gm: z.number().int(), pl: z.number().int() }),
	modules: z.array(GmCharacterLibraryFacetCount),
	unlinked: z.number().int(),
});
export type GmCharacterLibraryFacets = z.infer<typeof GmCharacterLibraryFacets>;

export const GmCharacterLibraryResponse = z.object({
	items: z.array(GmCharacterLibraryItemDto),
	nextCursor: z.string().nullable(),
	total: z.number().int().min(0),
	facets: GmCharacterLibraryFacets,
});
export type GmCharacterLibraryResponse = z.infer<
	typeof GmCharacterLibraryResponse
>;
