import {
	AddPortraitRequest,
	ApplyCharacterSyncRequest,
	AssignCharacterOwnerRequest,
	CharacterDetailDto,
	CharacterDto,
	CharacterHistoryResponse,
	CharacterImportPreviewResponse,
	CharacterCreationRollDto,
	CharacterInviteDto,
	CharacterInviteInfoResponse,
	CharacterPortraitDto,
	CharacterReviewDto,
	ChooseCreationRollRequest,
	CharacterSheetContextResponse,
	CharacterSyncDiffDto,
	CreateCharacterInviteRequest,
	CreateCharacterRequest,
	CreatePlCharacterRequest,
	CursorPageQuery,
	CursorPageResponse,
	DecideReviewRequest,
	GmCharacterLibraryQuery,
	GmCharacterLibraryResponse,
	GmPermanentFieldEditRequest,
	ImportConfirmRequest,
	LinkModuleCharacterRequest,
	ModuleCharacterLinkDto,
	RuleId,
	UpdateCharacterRequest,
	UpdatePortraitRequest,
} from "@cogm/shared";
import { Elysia, t } from "elysia";
import type { Container } from "@/bootstrap/container";
import { ModuleNotFoundError } from "@/modules/catalog";
import { AuthRequiredError, requireGm } from "@/modules/identity";
import { AddSessionCharacterUseCase } from "@/modules/sessions";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { assertXlsxUploadSize } from "@/platform/file-type";
import { assertTrustedOrigin } from "@/platform/security/origin";
import type { CharacterReviewDetail } from "../application/ports";
import {
	AddPortraitUseCase,
	ChooseCreationRollUseCase,
	ApplyCharacterSyncUseCase,
	AssignCharacterOwnerUseCase,
	CreateCharacterInviteUseCase,
	CreateCharacterUseCase,
	DecideReviewUseCase,
	DeleteCharacterUseCase,
	DeletePortraitUseCase,
	GetCharacterHistoryUseCase,
	GetCharacterSheetContextUseCase,
	GetCharacterUseCase,
	GetInviteInfoUseCase,
	GmEditPermanentFieldUseCase,
	ImportConfirmUseCase,
	ImportPreviewUseCase,
	LinkModuleCharacterUseCase,
	ListCharacterInvitesUseCase,
	ListCharacterLibraryUseCase,
	ListReviewsUseCase,
	PreviewCharacterSyncUseCase,
	RevokeCharacterInviteUseCase,
	RollCreationUseCase,
	SubmitCharacterUseCase,
	toCreationRollDto,
	UnlinkModuleCharacterUseCase,
	UpdateCharacterUseCase,
	UpdatePortraitUseCase,
} from "../application/use-cases";

function parseBody<T>(
	schema: {
		safeParse: (
			data: unknown,
		) => { success: true; data: T } | { success: false; error: unknown };
	},
	body: unknown,
): T {
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		throw validationFailed(parsed.error);
	}
	return parsed.data;
}

function parsePageQuery(query: unknown) {
	const parsed = CursorPageQuery.safeParse(query ?? {});
	if (!parsed.success) {
		throw validationFailed(parsed.error);
	}
	return parsed.data;
}

function toReviewDto(detail: CharacterReviewDetail) {
	const {
		submittedSheetJson,
		creationRoll,
		ownerId: _ownerId,
		...rest
	} = detail;
	return CharacterReviewDto.parse({
		...rest,
		submittedSheet:
			submittedSheetJson === null
				? null
				: (JSON.parse(submittedSheetJson) as unknown),
		creationRoll: creationRoll ? toCreationRollDto(creationRoll) : null,
	});
}

export function createCharactersRoutes(container: Container) {
	const { charactersRepo: repo, sessionsRepo, authPlugin } = container;

	const listLibrary = new ListCharacterLibraryUseCase(repo);
	const createCharacter = new CreateCharacterUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const updateCharacter = new UpdateCharacterUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const deleteCharacter = new DeleteCharacterUseCase(repo, container.clock);
	const getCharacter = new GetCharacterUseCase(repo);
	const getHistory = new GetCharacterHistoryUseCase(repo);
	const getSheetContext = new GetCharacterSheetContextUseCase(
		repo,
		container.ruleRegistry,
	);
	const assignOwner = new AssignCharacterOwnerUseCase(repo, container.clock);
	const addPortrait = new AddPortraitUseCase(
		repo,
		container.idGenerator,
		container.randomSource,
		container.clock,
	);
	const updatePortrait = new UpdatePortraitUseCase(repo);
	const deletePortrait = new DeletePortraitUseCase(repo, container.clock);
	const importPreview = new ImportPreviewUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const importConfirm = new ImportConfirmUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const linkModuleCharacter = new LinkModuleCharacterUseCase(
		repo,
		container.idGenerator,
		container.clock,
	);
	const unlinkModuleCharacter = new UnlinkModuleCharacterUseCase(
		repo,
		container.clock,
	);

	const createInvite = new CreateCharacterInviteUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const listInvites = new ListCharacterInvitesUseCase(repo);
	const revokeInvite = new RevokeCharacterInviteUseCase(repo, container.clock);
	const inviteInfo = new GetInviteInfoUseCase(repo, container.clock);
	const rollCreation = new RollCreationUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
		container.randomSource,
	);
	const chooseCreationRoll = new ChooseCreationRollUseCase(
		repo,
		container.ruleRegistry,
		container.clock,
	);
	const submitCharacter = new SubmitCharacterUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const listReviews = new ListReviewsUseCase(repo);
	const decideReview = new DecideReviewUseCase(
		repo,
		container.idGenerator,
		container.clock,
	);
	const addSessionCharacter = new AddSessionCharacterUseCase(
		sessionsRepo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const editPermanentField = new GmEditPermanentFieldUseCase(
		repo,
		container.ruleRegistry,
		container.idGenerator,
		container.clock,
	);
	const previewSync = new PreviewCharacterSyncUseCase(
		repo,
		sessionsRepo,
		container.ruleRegistry,
	);
	const applySync = new ApplyCharacterSyncUseCase(
		repo,
		sessionsRepo,
		container.ruleRegistry,
		container.clock,
	);

	const requireUser = (actor: { type: string } | null | undefined) => {
		if (!actor || actor.type !== "user") {
			throw new AuthRequiredError();
		}
		return actor as { type: "user"; userId: string; role: string };
	};

	const writeGuard = (request: Request) => {
		if (request.method !== "GET" && request.method !== "HEAD") {
			const security = container.siteSettings.getSecurityConfig();
			assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
		}
	};

	const gmCharacterRoutes = new Elysia({ prefix: "/api/v1/gm/characters" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireGm(actor);
			writeGuard(request);
		})
		.post("/", async ({ body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(CreateCharacterRequest, body);
			return CharacterDto.parse(
				await createCharacter.execute({
					ownerId: gm.userId,
					ownerKind: "gm",
					name: data.name,
					kind: data.kind,
					ruleId: data.ruleId,
					background: data.background,
					sheetData: data.sheetData,
				}),
			);
		})
		.get("/", async ({ query, actor }) => {
			const gm = requireGm(actor);
			return CursorPageResponse(CharacterDto).parse(
				await repo.listCharacters(gm.userId, parsePageQuery(query)),
			);
		})
		.get("/library", async ({ query, actor }) => {
			const gm = requireGm(actor);
			const parsed = parseBody(GmCharacterLibraryQuery, query ?? {});
			return GmCharacterLibraryResponse.parse(
				await listLibrary.execute({ gmUserId: gm.userId, query: parsed }),
			);
		})
		.get("/:id", async ({ params: { id }, actor }) => {
			const gm = requireGm(actor);
			return CharacterDetailDto.parse(
				await getCharacter.execute({
					actorUserId: gm.userId,
					characterId: id,
					gmReadAccess: true,
				}),
			);
		})
		.patch("/:id", async ({ params: { id }, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(UpdateCharacterRequest, body);
			return CharacterDto.parse(
				await updateCharacter.execute({
					actorUserId: gm.userId,
					characterId: id,
					name: data.name,
					background: data.background,
					kind: data.kind,
					sheetData: data.sheetData,
					expectedVersion: data.expectedVersion,
				}),
			);
		})
		.delete("/:id", async ({ params: { id }, actor }) => {
			const gm = requireGm(actor);
			await deleteCharacter.execute({
				actorUserId: gm.userId,
				characterId: id,
			});
			return { success: true };
		})
		.get("/:id/history", async ({ params: { id }, actor }) => {
			const gm = requireGm(actor);
			return CharacterHistoryResponse.parse(
				await getHistory.execute({
					actorUserId: gm.userId,
					characterId: id,
					gmReadAccess: true,
				}),
			);
		})
		.get("/:id/sheet-context", async ({ params: { id }, actor }) => {
			const gm = requireGm(actor);
			return CharacterSheetContextResponse.parse(
				await getSheetContext.execute({
					actorUserId: gm.userId,
					characterId: id,
					gmReadAccess: true,
				}),
			);
		})
		.post("/:id/owner", async ({ params: { id }, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(AssignCharacterOwnerRequest, body);
			return CharacterDto.parse(
				await assignOwner.execute({
					ownerId: gm.userId,
					characterId: id,
					targetUserId: data.ownerId,
				}),
			);
		})
		.post("/:id/permanent-field", async ({ params: { id }, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(GmPermanentFieldEditRequest, body);
			return CharacterDto.parse(
				await editPermanentField.execute({
					ownerId: gm.userId,
					characterId: id,
					field: data.field,
					value: data.value,
					sessionId: data.sessionId,
					reason: data.reason,
					expectedVersion: data.expectedVersion,
				}),
			);
		})
		.post(
			"/import/preview",
			async ({ body, actor, query }) => {
				const gm = requireGm(actor);
				const file = body.file as Blob;
				assertXlsxUploadSize(file.size);
				const parsedRuleId = RuleId.safeParse(body.ruleId);
				if (!parsedRuleId.success) {
					throw validationFailed(parsedRuleId.error);
				}
				const arrayBuffer = await file.arrayBuffer();
				return CharacterImportPreviewResponse.parse(
					await importPreview.execute({
						ownerId: gm.userId,
						ruleId: parsedRuleId.data,
						file: arrayBuffer,
						characterId:
							typeof query?.characterId === "string"
								? query.characterId
								: undefined,
					}),
				);
			},
			{
				body: t.Object({
					file: t.File(),
					ruleId: t.String(),
					characterId: t.Optional(t.String()),
				}),
			},
		)
		.post("/import/confirm", async ({ body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(ImportConfirmRequest, body);
			return CharacterDto.parse(
				await importConfirm.execute({
					ownerId: gm.userId,
					importToken: data.importToken,
					kind: data.kind,
					moduleId: data.moduleId,
					characterId: data.characterId,
					expectedVersion: data.expectedVersion,
					ownerKind: "gm",
				}),
			);
		})
		.post("/:id/portraits", async ({ params: { id }, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(AddPortraitRequest, body);
			return CharacterPortraitDto.parse(
				await addPortrait.execute({
					actorUserId: gm.userId,
					characterId: id,
					expressionKey: data.expressionKey,
					label: data.label,
					portraitAssetId: data.portraitAssetId,
					isDefault: data.isDefault,
					sortOrder: data.sortOrder,
				}),
			);
		})
		.patch("/:id/portraits/:portraitId", async ({ params, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(UpdatePortraitRequest, body);
			return CharacterPortraitDto.parse(
				await updatePortrait.execute({
					actorUserId: gm.userId,
					characterId: params.id,
					portraitId: params.portraitId,
					label: data.label,
					isDefault: data.isDefault,
					sortOrder: data.sortOrder,
					portraitAssetId: data.portraitAssetId,
				}),
			);
		})
		.delete("/:id/portraits/:portraitId", async ({ params, actor }) => {
			const gm = requireGm(actor);
			await deletePortrait.execute({
				actorUserId: gm.userId,
				characterId: params.id,
				portraitId: params.portraitId,
			});
			return { success: true };
		});

	const gmSessionSyncRoutes = new Elysia({ prefix: "/api/v1/gm/sessions" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireGm(actor);
			writeGuard(request);
		})
		.get(
			"/:id/characters/:characterId/sync-preview",
			async ({ params, actor }) => {
				const gm = requireGm(actor);
				return CharacterSyncDiffDto.parse(
					await previewSync.execute({
						ownerId: gm.userId,
						sessionId: params.id,
						characterId: params.characterId,
					}),
				);
			},
		)
		.post(
			"/:id/characters/:characterId/sync",
			async ({ params, body, actor }) => {
				const gm = requireGm(actor);
				const data = parseBody(ApplyCharacterSyncRequest, body);
				const result = await applySync.execute({
					ownerId: gm.userId,
					sessionId: params.id,
					characterId: params.characterId,
					fields: data.fields,
					expectedVersion: data.expectedVersion,
				});
				container.connectionRegistry.sendToSession(params.id, {
					type: "session:refresh",
					payload: {},
				});
				return result;
			},
		);

	const gmModuleCharacterRoutes = new Elysia({ prefix: "/api/v1/gm/modules" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireGm(actor);
			writeGuard(request);
		})
		.get("/:id/characters", async ({ params, query, actor }) => {
			const gm = requireGm(actor);
			const module = await repo.findModule(params.id);
			if (!module || module.ownerId !== gm.userId) {
				throw new ModuleNotFoundError();
			}
			return CursorPageResponse(CharacterDto).parse(
				await repo.listModuleCharacters(params.id, parsePageQuery(query)),
			);
		})
		.post("/:id/characters", async ({ params, body, actor }) => {
			const gm = requireGm(actor);
			const parsed = LinkModuleCharacterRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			await linkModuleCharacter.execute({
				ownerId: gm.userId,
				moduleId: params.id,
				characterId: parsed.data.characterId,
			});
			return ModuleCharacterLinkDto.parse({
				id: `${params.id}:${parsed.data.characterId}`,
				moduleId: params.id,
				characterId: parsed.data.characterId,
				createdAt: Date.now(),
			});
		})
		.delete("/:id/characters/:characterId", async ({ params, actor }) => {
			const gm = requireGm(actor);
			await unlinkModuleCharacter.execute({
				ownerId: gm.userId,
				moduleId: params.id,
				characterId: params.characterId,
			});
			return { success: true };
		});

	const gmInviteRoutes = new Elysia({ prefix: "/api/v1/gm/invites" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireGm(actor);
			writeGuard(request);
		})
		.post("/", async ({ body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(CreateCharacterInviteRequest, body);
			const created = await createInvite.execute({
				ownerId: gm.userId,
				scope: data.scope,
				targetId: data.targetId,
				expiresInDays: data.expiresInDays,
				creationOptions: data.creationOptions,
			});
			return CharacterInviteDto.parse({
				id: created.id,
				scope: data.scope,
				targetId: data.targetId,
				targetName: null,
				token: created.token,
				creationOptions: created.creationOptions,
				expiresAt: created.expiresAt,
				revokedAt: null,
				createdAt: created.createdAt,
			});
		})
		.get("/", async ({ actor }) => {
			const gm = requireGm(actor);
			return (await listInvites.execute({ ownerId: gm.userId })).items.map(
				(item) => CharacterInviteDto.parse(item),
			);
		})
		.delete("/:id", async ({ params, actor }) => {
			const gm = requireGm(actor);
			await revokeInvite.execute({ ownerId: gm.userId, inviteId: params.id });
			return { success: true };
		});

	const gmReviewRoutes = new Elysia({ prefix: "/api/v1/gm/reviews" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireGm(actor);
			writeGuard(request);
		})
		.get("/", async ({ actor, query }) => {
			const gm = requireGm(actor);
			const result = await listReviews.execute({
				ownerId: gm.userId,
				userId: gm.userId,
				status: typeof query?.status === "string" ? query.status : undefined,
			});
			return result.pending.map(toReviewDto);
		})
		.post("/:id/decide", async ({ params, body, actor }) => {
			const gm = requireGm(actor);
			const data = parseBody(DecideReviewRequest, body);
			const result = await decideReview.execute({
				ownerId: gm.userId,
				reviewId: params.id,
				approve: data.approve,
				reason: data.reason,
			});
			if (result.approved && result.scope === "session") {
				for (const characterId of result.characterIds) {
					await addSessionCharacter.execute({
						sessionId: result.targetId,
						characterId,
					});
				}
			}
			return result;
		});

	const plCharacterRoutes = new Elysia({ prefix: "/api/v1/pl/characters" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			if (actor && actor.type === "user" && actor.role === "admin") {
				throw new AppError(
					"FORBIDDEN",
					"Administrators do not manage characters",
					403,
				);
			}
			requireUser(actor);
			writeGuard(request);
		})
		.get("/", async ({ actor, query }) => {
			const user = requireUser(actor);
			return CursorPageResponse(CharacterDto).parse(
				await repo.listCharacters(user.userId, parsePageQuery(query)),
			);
		})
		.post("/", async ({ actor, body }) => {
			const user = requireUser(actor);
			const data = parseBody(CreatePlCharacterRequest, body);
			return CharacterDto.parse(
				await createCharacter.execute({
					ownerId: user.userId,
					ownerKind: "pl",
					name: data.name,
					kind: "pc",
					ruleId: data.ruleId,
					background: data.background,
					sheetData: data.sheetData,
				}),
			);
		})
		.get("/:id", async ({ actor, params }) => {
			const user = requireUser(actor);
			return CharacterDetailDto.parse(
				await getCharacter.execute({
					actorUserId: user.userId,
					characterId: params.id,
				}),
			);
		})
		.patch("/:id", async ({ actor, params, body }) => {
			const user = requireUser(actor);
			const data = parseBody(UpdateCharacterRequest, body);
			return CharacterDto.parse(
				await updateCharacter.execute({
					actorUserId: user.userId,
					characterId: params.id,
					name: data.name,
					background: data.background,
					sheetData: data.sheetData,
					expectedVersion: data.expectedVersion,
				}),
			);
		})
		.delete("/:id", async ({ actor, params }) => {
			const user = requireUser(actor);
			await deleteCharacter.execute({
				actorUserId: user.userId,
				characterId: params.id,
			});
			return { success: true };
		})
		.get("/:id/history", async ({ actor, params }) => {
			const user = requireUser(actor);
			return CharacterHistoryResponse.parse(
				await getHistory.execute({
					actorUserId: user.userId,
					characterId: params.id,
				}),
			);
		})
		.get("/:id/sheet-context", async ({ actor, params }) => {
			const user = requireUser(actor);
			return CharacterSheetContextResponse.parse(
				await getSheetContext.execute({
					actorUserId: user.userId,
					characterId: params.id,
				}),
			);
		})
		.post("/:id/portraits", async ({ actor, params, body }) => {
			const user = requireUser(actor);
			const data = parseBody(AddPortraitRequest, body);
			return CharacterPortraitDto.parse(
				await addPortrait.execute({
					actorUserId: user.userId,
					characterId: params.id,
					expressionKey: data.expressionKey,
					label: data.label,
					portraitAssetId: data.portraitAssetId,
					isDefault: data.isDefault,
					sortOrder: data.sortOrder,
				}),
			);
		})
		.patch("/:id/portraits/:portraitId", async ({ actor, params, body }) => {
			const user = requireUser(actor);
			const data = parseBody(UpdatePortraitRequest, body);
			return CharacterPortraitDto.parse(
				await updatePortrait.execute({
					actorUserId: user.userId,
					characterId: params.id,
					portraitId: params.portraitId,
					label: data.label,
					isDefault: data.isDefault,
					sortOrder: data.sortOrder,
					portraitAssetId: data.portraitAssetId,
				}),
			);
		})
		.delete("/:id/portraits/:portraitId", async ({ actor, params }) => {
			const user = requireUser(actor);
			await deletePortrait.execute({
				actorUserId: user.userId,
				characterId: params.id,
				portraitId: params.portraitId,
			});
			return { success: true };
		})
		.post(
			"/import/preview",
			async ({ actor, body, query }) => {
				const user = requireUser(actor);
				const file = body.file as Blob;
				assertXlsxUploadSize(file.size);
				const parsedRuleId = RuleId.safeParse(body.ruleId);
				if (!parsedRuleId.success) {
					throw validationFailed(parsedRuleId.error);
				}
				return CharacterImportPreviewResponse.parse(
					await importPreview.execute({
						ownerId: user.userId,
						ruleId: parsedRuleId.data,
						file: await file.arrayBuffer(),
						characterId:
							typeof query?.characterId === "string"
								? query.characterId
								: undefined,
					}),
				);
			},
			{
				body: t.Object({
					file: t.File(),
					ruleId: t.String(),
					characterId: t.Optional(t.String()),
				}),
			},
		)
		.post("/import/confirm", async ({ actor, body }) => {
			const user = requireUser(actor);
			const data = parseBody(ImportConfirmRequest, body);
			return CharacterDto.parse(
				await importConfirm.execute({
					ownerId: user.userId,
					importToken: data.importToken,
					kind: "pc",
					characterId: data.characterId,
					expectedVersion: data.expectedVersion,
					ownerKind: "pl",
				}),
			);
		});

	const plSubmitRoutes = new Elysia({ prefix: "/api/v1/pl" })
		.use(authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			requireUser(actor);
			writeGuard(request);
		})
		.get("/invites/:token", async ({ actor, params }) => {
			const user = requireUser(actor);
			return CharacterInviteInfoResponse.parse(
				await inviteInfo.execute({ token: params.token, userId: user.userId }),
			);
		})
		.post("/invites/:token/creation-roll", async ({ actor, params }) => {
			const user = requireUser(actor);
			return CharacterCreationRollDto.parse(
				await rollCreation.execute({
					token: params.token,
					userId: user.userId,
				}),
			);
		})
		.post(
			"/invites/:token/creation-roll/choice",
			async ({ actor, params, body }) => {
				const user = requireUser(actor);
				const data = parseBody(ChooseCreationRollRequest, body);
				return CharacterCreationRollDto.parse(
					await chooseCreationRoll.execute({
						token: params.token,
						userId: user.userId,
						index: data.index,
					}),
				);
			},
		)
		.post("/invites/:token/submissions", async ({ actor, params, body }) => {
			const user = requireUser(actor);
			const data = parseBody(
				{
					safeParse: (input: unknown) => {
						const value = input as Record<string, unknown> | null;
						if (!value || (value.mode !== "new" && value.mode !== "existing")) {
							return {
								success: false as const,
								error: new Error("mode must be new or existing"),
							};
						}
						return {
							success: true as const,
							data: value as {
								mode: "new" | "existing";
								characterId?: string;
								name?: string;
								background?: string;
								sheetData?: unknown;
							},
						};
					},
				},
				body,
			);
			return submitCharacter.execute({
				token: params.token,
				userId: user.userId,
				mode: data.mode,
				characterId: data.characterId,
				name: data.name,
				background: data.background,
				sheetData: data.sheetData,
			});
		})
		.get("/submissions", async ({ actor }) => {
			const user = requireUser(actor);
			const result = await listReviews.execute({
				ownerId: user.userId,
				userId: user.userId,
			});
			return result.mine.map(toReviewDto);
		});

	return new Elysia()
		.use(gmSessionSyncRoutes)
		.use(gmCharacterRoutes)
		.use(gmModuleCharacterRoutes)
		.use(gmInviteRoutes)
		.use(gmReviewRoutes)
		.use(plCharacterRoutes)
		.use(plSubmitRoutes);
}
