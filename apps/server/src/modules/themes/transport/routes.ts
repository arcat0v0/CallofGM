import { ThemeSummaryDto } from "@cogm/shared";
import { Elysia, t } from "elysia";
import type { Container } from "@/bootstrap/container";
import { ForbiddenError } from "@/modules/identity";
import { logger } from "@/platform/logging/logger";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { clientIp } from "@/platform/security/request-ip";
import {
	DeleteThemeUseCase,
	InstallThemeUseCase,
	ListThemesUseCase,
	RescanThemesUseCase,
} from "../application/use-cases";
import { ThemeNotFoundError, ThemeTooLargeError } from "../domain/errors";
import { ThemeRegistry } from "../infrastructure/theme-registry";

export function createThemeRoutes(container: Container) {
	const { themeRegistry: registry, themeUsageRepo, authPlugin } = container;
	const requireAdmin = (
		actor: { type: string; role?: string } | null,
	): void => {
		if (!actor || actor.type !== "user" || actor.role !== "admin") {
			throw new ForbiddenError("Administrators only");
		}
	};
	const listThemes = new ListThemesUseCase(registry, themeUsageRepo);
	const installTheme = new InstallThemeUseCase(registry, themeUsageRepo);
	const deleteTheme = new DeleteThemeUseCase(registry, themeUsageRepo);
	const rescanThemes = new RescanThemesUseCase(registry, themeUsageRepo);

	return new Elysia()
		.get("/api/v1/themes/:id/manifest", async ({ params, set }) => {
			await registry.ready();
			const manifest = registry.resolveManifest(params.id);
			if (!manifest) {
				throw new ThemeNotFoundError();
			}
			set.headers["Cache-Control"] = "no-cache";
			return manifest;
		})
		.get("/api/v1/themes/:id/versions/:version/*", async ({ params, set }) => {
			const relativePath = params["*"] ?? "";
			const resolved = await registry.resolveAsset(
				params.id,
				params.version,
				relativePath,
			);
			if (!resolved) {
				throw new ThemeNotFoundError();
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
			set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
			set.headers["X-Content-Type-Options"] = "nosniff";
			return new Response(Bun.file(resolved.filePath), {
				headers: {
					"Content-Type": ThemeRegistry.contentType(resolved.filePath),
				},
			});
		})
		.use(authPlugin)
		.get("/api/v1/admin/themes", async ({ actor }) => {
			requireAdmin(actor);
			return { items: await listThemes.execute() };
		})
		.post(
			"/api/v1/admin/themes",
			async ({ actor, body, request, server }) => {
				requireAdmin(actor);
				const security = container.siteSettings.getSecurityConfig();
				assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
				container.httpLimits.uploadRateLimiter.assert(
					clientIp(request, server, security.trustProxy),
				);
				const file = body.file as Blob;
				if (file.size > registry.getMaxArchiveBytes()) {
					throw new ThemeTooLargeError();
				}
				const archive = new Uint8Array(await file.arrayBuffer());
				const installed = await installTheme.execute(archive);
				logger.audit("theme.upload", {
					themeId: installed.id,
					version: installed.version,
				});
				return ThemeSummaryDto.parse(installed);
			},
			{
				body: t.Object({
					file: t.File(),
				}),
			},
		)
		.delete("/api/v1/admin/themes/:id", async ({ actor, params, request }) => {
			requireAdmin(actor);
			const security = container.siteSettings.getSecurityConfig();
			assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
			if (params.id === "default") {
				throw new ForbiddenError("默认主题不可删除");
			}
			await deleteTheme.execute(params.id);
			return { success: true };
		})
		.post("/api/v1/admin/themes/rescan", async ({ actor, request }) => {
			requireAdmin(actor);
			const security = container.siteSettings.getSecurityConfig();
			assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
			return { items: await rescanThemes.execute() };
		});
}
