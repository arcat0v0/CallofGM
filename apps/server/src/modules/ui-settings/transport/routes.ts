import { Elysia } from "elysia";
import { UpdateUiSettingsRequest } from "@cogm/shared";
import type { Container } from "@/bootstrap/container";
import { DrizzleIdentityRepository, AuthRequiredError, createAuthPlugin } from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { logger } from "@/platform/logging/logger";
import { DrizzleUiSettingsRepository } from "../infrastructure/drizzle-ui-settings-repository";
import { GetUiSettingsUseCase, UpdateUiSettingsUseCase } from "../application/use-cases";

export function createUiSettingsRoutes(container: Container) {
  const repo = new DrizzleUiSettingsRepository(container.db);
  const authPlugin = createAuthPlugin(new DrizzleIdentityRepository(container.db));
  const getSettings = new GetUiSettingsUseCase(repo, container.themeRegistry);
  const updateSettings = new UpdateUiSettingsUseCase(repo, container.themeRegistry, container.clock);

  return new Elysia({ prefix: "/api/v1/gm/ui-settings" })
    .use(authPlugin)
    .onBeforeHandle(({ actor }) => {
      if (!actor || actor.type !== "gm") {
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
      logger.audit("gm.ui-settings.update", { gmThemeId: result.gmThemeId });
      return result;
    });
}