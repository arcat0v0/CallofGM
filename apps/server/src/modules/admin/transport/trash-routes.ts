import { Elysia } from "elysia";
import { z } from "zod";
import type { Container } from "@/bootstrap/container";
import { TrashRepository, TrashItemNotFoundError } from "../application/trash-repository";
import {
  AuthRequiredError,
  AdminRequiredError,
  ForbiddenError,
  UserNotFoundError,
  DrizzleIdentityRepository,
  createAuthPlugin,
} from "@/modules/identity";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import { validationFailed } from "@/platform/errors/validation";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logging/logger";
import { TrashEntityType } from "@cogm/shared";

const RestoreRequest = z.object({
  entityType: TrashEntityType,
  id: z.string().min(1),
});

export function createTrashRoutes(container: Container) {
  const repo = new TrashRepository(container.db);
  const authPlugin = createAuthPlugin(new DrizzleIdentityRepository(container.db));
  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia()
    .use(authPlugin)
    .get("/api/v1/trash", async ({ actor }) => {
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type === "player") {
        throw new ForbiddenError("Anonymous players have no trash");
      }
      const items = actor.role === "admin" ? await repo.listAdmin() : await repo.listOwned(actor.userId);
      return { items };
    })
    .post("/api/v1/trash/restore", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor) {
        throw new AuthRequiredError();
      }
      if (actor.type === "player") {
        throw new ForbiddenError("Anonymous players have no trash");
      }
      const parsed = RestoreRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const { entityType, id } = parsed.data;

      if (entityType === "user") {
        if (actor.role !== "admin") {
          throw new AdminRequiredError();
        }
        const restored = await repo.restoreOwnedUser(id);
        if (!restored) {
          throw new UserNotFoundError();
        }
        logger.audit("admin.user.restored");
        return { restored: true };
      }

      if (actor.role === "admin") {
        throw new AdminRequiredError();
      }

      const { parentDeleted } = await repo.findParentState(entityType, id);
      if (parentDeleted) {
        throw new AppError("PARENT_DELETED", "Restore the parent resource first", 409);
      }

      const restored = await repo.restoreOwned(actor.userId, entityType, id);
      if (!restored) {
        throw new TrashItemNotFoundError();
      }
      return { restored: true };
    });
}
