import { ThemeSummaryDto } from "@cogm/shared";
import { Elysia, t } from "elysia";
import type { Container } from "@/bootstrap/container";
import { corsOriginsFor } from "@/config/env";
import {
	AuthRequiredError,
	createAuthPlugin,
	DrizzleIdentityRepository,
	ForbiddenError,
} from "@/modules/identity";
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
	const registry = container.themeRegistry;
	const authPlugin = createAuthPlugin(
		new DrizzleIdentityRepository(container.db),
	);
	const listThemes = new ListThemesUseCase(registry, container.db);
	const installTheme = new InstallThemeUseCase(registry, container.db);
	const deleteTheme = new DeleteThemeUseCase(registry, container.db);
	const rescanThemes = new RescanThemesUseCase(registry, container.db);
	const allowedOrigins = corsOriginsFor(container.env);

	return new Elysia()
		.get("/api/v1/themes/:id/manifest", async ({ params, set }) => {
			await registry.ready();
			const theme = registry.get(params.id);
			if (!theme) {
				throw new ThemeNotFoundError();
			}
			set.headers["Cache-Control"] = "no-cache";
			return theme.manifest;
		})
		.get("/api/v1/themes/:id/versions/:version/*", async ({ params, set }) => {
			const relativePath = params["*"] ?? "";
			const filePath = await registry.filePath(
				params.id,
				params.version,
				relativePath,
			);
			if (!filePath) {
				throw new ThemeNotFoundError();
			}
			set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
			set.headers["X-Content-Type-Options"] = "nosniff";
			return new Response(Bun.file(filePath), {
				headers: { "Content-Type": ThemeRegistry.contentType(filePath) },
			});
		})
		.use(authPlugin)
		.get("/api/v1/gm/themes", async ({ actor }) => {
			if (!actor || actor.type !== "user" || actor.role !== "gm") {
				throw new AuthRequiredError();
			}
			return { items: await listThemes.execute() };
		})
		.post(
			"/api/v1/gm/themes",
			async ({ actor, body, request, server }) => {
				if (!actor || actor.type !== "user" || actor.role !== "gm") {
					throw new AuthRequiredError();
				}
				assertTrustedOrigin(request, allowedOrigins);
				container.httpLimits.uploadRateLimiter.assert(
					clientIp(request, server, container.env.TRUST_PROXY),
				);
				const file = body.file as Blob;
				if (file.size > 50 * 1024 * 1024) {
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
		.delete("/api/v1/gm/themes/:id", async ({ actor, params }) => {
			if (!actor || actor.type !== "user" || actor.role !== "gm") {
				throw new AuthRequiredError();
			}
			if (params.id === "default") {
				throw new ForbiddenError("默认主题不可删除");
			}
			await deleteTheme.execute(params.id);
			return { success: true };
		})
		.post("/api/v1/gm/themes/rescan", async ({ actor }) => {
			if (!actor || actor.type !== "user" || actor.role !== "gm") {
				throw new AuthRequiredError();
			}
			return { items: await rescanThemes.execute() };
		});
}
