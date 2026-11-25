import { UpdateUiSettingsRequest } from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { AuthRequiredError } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { logger } from "@/platform/logging/logger";
import { assertTrustedOrigin } from "@/platform/security/origin";
import {
	GetUiSettingsUseCase,
	UpdateUiSettingsUseCase,
} from "../application/use-cases";

export function createUiSettingsRoutes(container: Container) {
	const { uiSettingsRepo: repo, authPlugin } = container;
	const getSettings = new GetUiSettingsUseCase(repo, container.themeRegistry);
	const updateSettings = new UpdateUiSettingsUseCase(
		repo,
		container.themeRegistry,
		container.clock,
	);

	return new Elysia()
		.get("/api/v1/public/ui-settings", async () => getSettings.execute())
		.use(authPlugin)
		.onBeforeHandle(({ actor }) => {
			if (actor?.type !== "user" || actor.role !== "admin") {
				throw new AuthRequiredError();
			}
		})
		.get("/api/v1/admin/ui-settings", async () => getSettings.execute())
		.put("/api/v1/admin/ui-settings", async ({ body, request }) => {
			const security = container.siteSettings.getSecurityConfig();
			assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
			const parsed = UpdateUiSettingsRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			const result = await updateSettings.execute(parsed.data);
			logger.audit("admin.ui-settings.update", { gmThemeId: result.gmThemeId });
			return result;
		});
}
