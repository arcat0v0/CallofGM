import {
	AdminSiteSettingsResponse,
	CleanupStorageProbeRequest,
	PublicRuntimeConfigDto,
	ResetSiteSettingsRequest,
	StorageMigrationStatusDto,
	TestStorageConnectionRequest,
	TestStorageConnectionResponse,
	UpdateSiteSettingsRequest,
} from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { AdminRequiredError, AuthRequiredError } from "@/modules/identity";
import { getServerBuildInfo } from "@/platform/build-info";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { diceAssetContentType } from "../application/dice-assets";

export function createSiteSettingsRoutes(
	container: Container,
	options: { serverBuildInfo?: ReturnType<typeof getServerBuildInfo> } = {},
) {
	const buildInfo = options.serverBuildInfo ?? getServerBuildInfo();

	const requireAdmin = (actor: { type: string; role?: string } | null) => {
		if (!actor) {
			throw new AuthRequiredError();
		}
		if (actor.type !== "user" || actor.role !== "admin") {
			throw new AdminRequiredError();
		}
	};

	const assertOrigin = (request: Request) => {
		const security = container.siteSettings.getSecurityConfig();
		assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
	};

	return new Elysia()
		.get("/api/v1/public/runtime-config", ({ set }) => {
			set.headers["Cache-Control"] = "no-store";
			return PublicRuntimeConfigDto.parse(
				container.siteSettings.getPublicRuntimeConfig(),
			);
		})
		.get("/api/v1/dice/*", async ({ params, set }) => {
			const relPath = params["*"] ?? "";
			const resolved = container.siteSettings.resolveDiceAsset(relPath);
			if (!resolved) {
				set.status = 404;
				return { code: "NOT_FOUND", message: "Not found" };
			}
			if (resolved.kind === "redirect") {
				return new Response(null, {
					status: 302,
					headers: {
						Location: resolved.url,
						"Cache-Control": resolved.cacheControl,
					},
				});
			}
			const file = Bun.file(resolved.filePath);
			if (!(await file.exists())) {
				set.status = 404;
				return { code: "NOT_FOUND", message: "Not found" };
			}
			return new Response(file, {
				headers: {
					"Content-Type": diceAssetContentType(relPath),
					"Cache-Control": "public, max-age=86400",
					"X-Content-Type-Options": "nosniff",
				},
			});
		})
		.use(container.authPlugin)
		.get("/api/v1/admin/settings", async ({ actor, set }) => {
			requireAdmin(actor);
			set.headers["Cache-Control"] = "no-store";
			const result = await container.siteSettings.getAdminSettings(buildInfo);
			return AdminSiteSettingsResponse.parse(result);
		})
		.put("/api/v1/admin/settings", async ({ actor, body, request }) => {
			requireAdmin(actor);
			assertOrigin(request);
			const parsed = UpdateSiteSettingsRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			const result = await container.siteSettings.updateSettings(
				parsed.data,
				request,
				buildInfo,
			);
			return AdminSiteSettingsResponse.parse(result);
		})
		.post("/api/v1/admin/settings/reset", async ({ actor, body, request }) => {
			requireAdmin(actor);
			assertOrigin(request);
			const parsed = ResetSiteSettingsRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			const result = await container.siteSettings.resetSettings(
				parsed.data.section,
				request,
				buildInfo,
			);
			return AdminSiteSettingsResponse.parse(result);
		})
		.post(
			"/api/v1/admin/settings/storage/test",
			async ({ actor, body, request }) => {
				requireAdmin(actor);
				assertOrigin(request);
				const parsed = TestStorageConnectionRequest.safeParse(body ?? {});
				if (!parsed.success) {
					throw validationFailed(parsed.error);
				}
				const result = await container.siteSettings.testStorageConnection(
					parsed.data,
				);
				return TestStorageConnectionResponse.parse(result);
			},
		)
		.post(
			"/api/v1/admin/settings/storage/test-cleanup",
			async ({ actor, body, request }) => {
				requireAdmin(actor);
				assertOrigin(request);
				const parsed = CleanupStorageProbeRequest.safeParse(body);
				if (!parsed.success) {
					throw validationFailed(parsed.error);
				}
				await container.siteSettings.cleanupBrowserProbe(
					parsed.data.probeToken,
				);
				return { success: true };
			},
		)
		.get("/api/v1/admin/settings/storage/migrate", ({ actor, set }) => {
			requireAdmin(actor);
			set.headers["Cache-Control"] = "no-store";
			return StorageMigrationStatusDto.parse(
				container.storageMigration.getStatus(),
			);
		})
		.post(
			"/api/v1/admin/settings/storage/migrate",
			async ({ actor, request }) => {
				requireAdmin(actor);
				assertOrigin(request);
				const result = await container.storageMigration.startMigration();
				return StorageMigrationStatusDto.parse(result);
			},
		);
}
