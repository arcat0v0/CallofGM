import {
	CreateUserRequest,
	ResetUserPasswordRequest,
	UpdateUserRequest,
	UserDto,
} from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import {
	AdminRequiredError,
	AuthRequiredError,
	CreateUserUseCase,
	InvalidPasswordError,
	isPasswordFieldFailure,
	ResetUserPasswordUseCase,
	UpdateUserUseCase,
	UserNotFoundError,
} from "@/modules/identity";
import { validationFailed } from "@/platform/errors/validation";
import { logger } from "@/platform/logging/logger";
import { assertTrustedOrigin } from "@/platform/security/origin";

export function createAdminRoutes(container: Container) {
	const { identityRepo: repo, authPlugin } = container;
	const assertOrigin = (request: Request) => {
		const security = container.siteSettings.getSecurityConfig();
		assertTrustedOrigin(request, security.corsOrigins, security.trustProxy);
	};
	const createUser = new CreateUserUseCase(
		container.idGenerator,
		container.clock,
		repo,
	);
	const updateUser = new UpdateUserUseCase(container.clock, repo, (userId) => {
		container.connectionRegistry.closeUserConnections(userId);
	});
	const resetPassword = new ResetUserPasswordUseCase(
		container.clock,
		repo,
		(userId) => {
			container.connectionRegistry.closeUserConnections(userId);
		},
	);

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
			return { items: rows.map((user) => UserDto.parse(user)) };
		})
		.post("/api/v1/admin/users", async ({ actor, body, request }) => {
			assertOrigin(request);
			requireAdmin(actor);
			const parsed = CreateUserRequest.safeParse(body);
			if (!parsed.success) {
				if (isPasswordFieldFailure(parsed.error, "password")) {
					throw new InvalidPasswordError();
				}
				throw validationFailed(parsed.error);
			}
			const user = await createUser.execute(parsed.data);
			logger.audit("admin.user.created", { role: user.role });
			return UserDto.parse(user);
		})
		.patch(
			"/api/v1/admin/users/:id",
			async ({ actor, body, params, request }) => {
				assertOrigin(request);
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
				logger.audit("admin.user.updated", {
					disabled: parsed.data.disabled,
					deleted: parsed.data.deleted,
				});
				return {
					user: UserDto.parse(result.user),
					sessionsRevoked: result.revoked,
				};
			},
		)
		.post(
			"/api/v1/admin/users/:id/password",
			async ({ actor, body, params, request }) => {
				assertOrigin(request);
				requireAdmin(actor);
				const parsed = ResetUserPasswordRequest.safeParse(body);
				if (!parsed.success) {
					if (isPasswordFieldFailure(parsed.error, "password")) {
						throw new InvalidPasswordError();
					}
					throw validationFailed(parsed.error);
				}
				await resetPassword.execute({
					userId: params.id,
					password: parsed.data.password,
				});
				logger.audit("admin.user.password.reset");
				return { success: true };
			},
		)
		.get("/api/v1/admin/users/:id", async ({ actor, params }) => {
			requireAdmin(actor);
			const user = await repo.findUserById(params.id);
			if (!user) {
				throw new UserNotFoundError();
			}
			return UserDto.parse(user);
		});
}
