import { UpdateUiSettingsRequest } from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { AuthRequiredError } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { logger } from "@/platform/logging/logger";
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

	return new Elysia({ prefix: "/api/v1/admin/ui-settings" })
		.get("/api/v1/public/ui-settings", async () => getSettings.execute())
		.use(authPlugin)
		.onBeforeHandle(({ actor }) => {
			if (!actor || actor.type !== "user" || actor.role !== "admin") {
				throw new AuthRequiredError();
			}
		})
		.get("/", async () => getSettings.execute())
		.put("/", async ({ body }) => {
			const parsed = UpdateUiSettingsRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			const result = await updateSettings.execute(parsed.data);
			logger.audit("admin.ui-settings.update", { gmThemeId: result.gmThemeId });
			return result;
		});
}
