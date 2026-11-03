import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { DrizzleIdentityRepository, createAuthPlugin } from "@/modules/identity";
import {
  CreateUserUseCase,
  ResetUserPasswordUseCase,
  UpdateUserUseCase,
  AdminRequiredError,
  AuthRequiredError,
  UserNotFoundError,
} from "@/modules/identity";
import { CreateUserRequest, ResetUserPasswordRequest, UpdateUserRequest, type UserDto } from "@cogm/shared";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import { logger } from "@/platform/logging/logger";

function toUserDto(user: {
  id: string;
  username: string;
  role: string;
  disabledAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): UserDto {
  return {
    id: user.id,
    username: user.username,
    role: user.role as UserDto["role"],
    disabledAt: user.disabledAt,
    deletedAt: user.deletedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function createAdminRoutes(container: Container) {
  const repo = new DrizzleIdentityRepository(container.db);
  const allowedOrigins = corsOriginsFor(container.env);
  const createUser = new CreateUserUseCase(container.idGenerator, container.clock, repo);
  const updateUser = new UpdateUserUseCase(container.clock, repo, (userId) => {
    container.connectionRegistry.closeUserConnections(userId);
  });
  const resetPassword = new ResetUserPasswordUseCase(container.clock, repo, (userId) => {
    container.connectionRegistry.closeUserConnections(userId);
  });

  const authPlugin = createAuthPlugin(repo);

  const requireAdmin = (actor: { type: string; role?: string } | null) => {
    if (!actor) {
      throw new AuthRequiredError();
    }
    if (actor.type !== "user" || actor.role !== "admin") {
      throw new AdminRequiredError();
    }
    return actor as { type: "user"; userId: string; role: "admin" };
  };

  return new Elysia()
    .use(authPlugin)
    .get("/api/v1/admin/users", async ({ actor, query }) => {
      requireAdmin(actor);
      const includeDeleted = query?.includeDeleted === "true";
      const rows = await repo.listUsers(includeDeleted);
      return { items: rows.map(toUserDto) };
    })
    .post("/api/v1/admin/users", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      requireAdmin(actor);
      const parsed = CreateUserRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const user = await createUser.execute(parsed.data);
      logger.audit("admin.user.created", { role: user.role });
      return toUserDto(user);
    })
    .patch("/api/v1/admin/users/:id", async ({ actor, body, params, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      const admin = requireAdmin(actor);
      const parsed = UpdateUserRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const result = await updateUser.execute({
        userId: params.id,
        actorUserId: admin.userId,
        disabled: parsed.data.disabled,
        deleted: parsed.data.deleted,
        username: parsed.data.username,
      });
      logger.audit("admin.user.updated", { disabled: parsed.data.disabled, deleted: parsed.data.deleted });
      return { user: toUserDto(result.user), sessionsRevoked: result.revoked };
    })
    .post("/api/v1/admin/users/:id/password", async ({ actor, body, params, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      requireAdmin(actor);
      const parsed = ResetUserPasswordRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      await resetPassword.execute({ userId: params.id, password: parsed.data.password });
      logger.audit("admin.user.password.reset");
      return { success: true };
    })
    .get("/api/v1/admin/users/:id", async ({ actor, params }) => {
      requireAdmin(actor);
      const user = await repo.findUserById(params.id);
      if (!user) {
        throw new UserNotFoundError();
      }
      return toUserDto(user);
    });
}
