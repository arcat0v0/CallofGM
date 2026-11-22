import {
	CatalogHandoutDto,
	CreateHandoutRequest,
	CreateModuleRequest,
	CreateSceneRequest,
	CreateTrackRequest,
	CursorPageQuery,
	CursorPageResponse,
	ModuleDto,
	ModuleSummaryDto,
	SceneDto,
	GmTrackLibraryItemDto,
	TrackDto,
	UpdateHandoutRequest,
	UpdateModuleRequest,
	UpdateSceneRequest,
	UpdateTrackRequest,
} from "@cogm/shared";
import { Elysia } from "elysia";
import { z } from "zod";
import type { Container } from "@/bootstrap/container";
import { corsOriginsFor } from "@/config/env";
import { AuthRequiredError, requireGm } from "@/modules/identity";
import { ThemeNotFoundError } from "@/modules/themes";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import {
	CreateHandoutUseCase,
	CreateModuleUseCase,
	CreateSceneUseCase,
	CreateTrackUseCase,
	DeleteModuleUseCase,
	ListHandoutsUseCase,
	ListScenesUseCase,
	UpdateHandoutUseCase,
	UpdateSceneUseCase,
	UpdateTrackUseCase,
} from "../application/use-cases";
import { ModuleNotFoundError, TrackNotFoundError } from "../domain/errors";

function parsePageQuery(query: unknown) {
	const parsed = CursorPageQuery.safeParse(query ?? {});
	if (!parsed.success) {
		throw validationFailed(parsed.error);
	}
	return parsed.data;
}

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

async function requireTheme(
	container: Container,
	themeId: string | null | undefined,
): Promise<void> {
	if (!themeId) {
		return;
	}
	await container.themeRegistry.ready();
	if (!container.themeRegistry.has(themeId)) {
		throw new ThemeNotFoundError();
	}
}

export function createCatalogRoutes(container: Container) {
	const repo = container.catalogRepo;

	const createModule = new CreateModuleUseCase(
		repo,
		container.idGenerator,
		container.clock,
	);
	const deleteModule = new DeleteModuleUseCase(repo, container.clock);

	const createScene = new CreateSceneUseCase(
		repo,
		container.idGenerator,
		container.clock,
	);
	const updateScene = new UpdateSceneUseCase(repo);
	const listScenes = new ListScenesUseCase(repo);

	const createTrack = new CreateTrackUseCase(
		repo,
		container.idGenerator,
		container.clock,
		container.musicService,
	);
	const updateTrack = new UpdateTrackUseCase(repo);

	const createHandout = new CreateHandoutUseCase(
		repo,
		container.idGenerator,
		container.clock,
	);
	const updateHandout = new UpdateHandoutUseCase(repo);
	const listHandouts = new ListHandoutsUseCase(repo);

	const allowedOrigins = corsOriginsFor(container.env);

	const requireOwnedModule = async (moduleId: string, ownerId: string) => {
		const record = await repo.findModuleById(moduleId);
		if (!record || record.ownerId !== ownerId) {
			throw new ModuleNotFoundError();
		}
		return record;
	};

	const requireOwnedTrack = async (trackId: string, ownerId: string) => {
		const track = await repo.findTrackById(trackId);
		if (!track) {
			throw new TrackNotFoundError();
		}
		await requireOwnedModule(track.moduleId, ownerId);
		return track;
	};

	return new Elysia({ prefix: "/api/v1/gm/modules" })
		.use(container.authPlugin)
		.onBeforeHandle(({ actor, request }) => {
			if (!actor || actor.type !== "user" || actor.role !== "gm") {
				throw new AuthRequiredError();
			}
			if (request.method !== "GET" && request.method !== "HEAD") {
				assertTrustedOrigin(request, allowedOrigins);
			}
		})
		.post("/", async ({ body, actor }) => {
			const parsed = parseBody(CreateModuleRequest, body);
			await requireTheme(container, parsed.themeId);
			return ModuleDto.parse(
				await createModule.execute({
					...parsed,
					ownerId: requireGm(actor).userId,
				}),
			);
		})
		.get("/", async ({ query, actor }) => {
			return CursorPageResponse(ModuleDto).parse(
				await repo.listModules({
					...parsePageQuery(query),
					ownerId: requireGm(actor).userId,
				}),
			);
		})
		.get("/summaries", async () => {
			return z.array(ModuleSummaryDto).parse(await repo.listModuleSummaries());
		})
		.get("/:id", async ({ params, actor }) => {
			return ModuleDto.parse(
				await requireOwnedModule(params.id, requireGm(actor).userId),
			);
		})
		.patch("/:id", async ({ params, body, actor }) => {
			await requireOwnedModule(params.id, requireGm(actor).userId);
			const parsed = parseBody(UpdateModuleRequest, body);
			await requireTheme(container, parsed.themeId);
			return ModuleDto.parse(await repo.updateModule(params.id, parsed));
		})
		.delete("/:id", async ({ params, actor }) => {
			await requireOwnedModule(params.id, requireGm(actor).userId);
			await deleteModule.execute(params.id);
			return { success: true };
		})
		.post("/:id/scenes", async ({ params, body }) => {
			const parsed = parseBody(CreateSceneRequest, body);
			return SceneDto.parse(
				await createScene.execute({
					moduleId: params.id,
					...parsed,
				}),
			);
		})
		.get("/:id/scenes", async ({ params, query }) => {
			return CursorPageResponse(SceneDto).parse(
				await listScenes.execute(params.id, parsePageQuery(query)),
			);
		})
		.patch("/scenes/:id", async ({ params, body }) => {
			return SceneDto.parse(
				await updateScene.execute(
					params.id,
					parseBody(UpdateSceneRequest, body),
				),
			);
		})
		.delete("/scenes/:id", async ({ params }) => {
			await repo.deleteScene(params.id);
			return { success: true };
		})
		.post("/:id/tracks", async ({ params, body, actor }) => {
			const module = await requireOwnedModule(
				params.id,
				requireGm(actor).userId,
			);
			const parsed = parseBody(CreateTrackRequest, body);
			return TrackDto.parse(await createTrack.execute(module, parsed));
		})
		.get("/:id/tracks", async ({ params, query, actor }) => {
			await requireOwnedModule(params.id, requireGm(actor).userId);
			return CursorPageResponse(TrackDto).parse(
				await repo.listTracksByModuleId(params.id, parsePageQuery(query)),
			);
		})
		.get("/tracks", async ({ query, actor }) =>
			CursorPageResponse(GmTrackLibraryItemDto).parse(
				await repo.listTracksByOwnerId(
					requireGm(actor).userId,
					parsePageQuery(query),
				),
			),
		)
		.patch("/tracks/:id", async ({ params, body, actor }) => {
			const track = await requireOwnedTrack(params.id, requireGm(actor).userId);
			return TrackDto.parse(
				await updateTrack.execute(track, parseBody(UpdateTrackRequest, body)),
			);
		})
		.delete("/tracks/:id", async ({ params, actor }) => {
			await requireOwnedTrack(params.id, requireGm(actor).userId);
			await repo.deleteTrack(params.id);
			return { success: true };
		})
		.post("/:id/handouts", async ({ params, body }) => {
			const parsed = parseBody(CreateHandoutRequest, body);
			return CatalogHandoutDto.parse(
				await createHandout.execute({
					moduleId: params.id,
					...parsed,
				}),
			);
		})
		.get("/:id/handouts", async ({ params, query }) => {
			return CursorPageResponse(CatalogHandoutDto).parse(
				await listHandouts.execute(params.id, parsePageQuery(query)),
			);
		})
		.patch("/handouts/:id", async ({ params, body }) => {
			return CatalogHandoutDto.parse(
				await updateHandout.execute(
					params.id,
					parseBody(UpdateHandoutRequest, body),
				),
			);
		})
		.delete("/handouts/:id", async ({ params }) => {
			await repo.deleteHandout(params.id);
			return { success: true };
		});
}
