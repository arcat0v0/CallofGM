import type { CreatePlayerAccountRequest } from "@cogm/shared";
import type { Clock, IdGenerator } from "@/platform/ports";
import type { UserRole } from "../domain/actor";
import {
	AccountDisabledError,
	InvalidCredentialsError,
	InvalidCurrentPasswordError,
	LastAdminError,
	UserNotFoundError,
	UsernameTakenError,
} from "../domain/errors";
import type {
	IdentityRepository,
	UserRecord,
	UserSessionRecord,
} from "./ports";
import { issueOpaqueToken } from "./token";
import { normalizeUsername } from "./username";

export const USER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface LoginResult {
	sessionToken: string;
	expiresAt: number;
	user: UserRecord;
	replacedSessionIds: string[];
}

function issueUserSession(id: string, userId: string, now: number) {
	const issued = issueOpaqueToken();
	const session: UserSessionRecord = {
		id,
		userId,
		sessionTokenHash: issued.tokenHash,
		expiresAt: now + USER_SESSION_TTL_MS,
		revokedAt: null,
		replacedBySessionId: null,
		createdAt: now,
	};
	return { token: issued.token, session };
}

export class LoginUseCase {
	constructor(
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
	) {}

	async execute(username: string, password: string): Promise<LoginResult> {
		const user = await this.repo.findUserByUsernameNormalized(
			normalizeUsername(username),
		);
		if (!user) {
			throw new InvalidCredentialsError();
		}
		const valid = await Bun.password.verify(password, user.passwordHash);
		if (!valid) {
			throw new InvalidCredentialsError();
		}
		if (user.deletedAt !== null || user.disabledAt !== null) {
			throw new AccountDisabledError();
		}

		const now = this.clock.nowEpochMs();
		const previous = await this.repo.listSessionsByUser(user.id);
		const replacedSessionIds = previous
			.filter((s) => s.revokedAt === null)
			.map((s) => s.id);

		const { token, session } = issueUserSession(
			this.idGenerator.nextId(),
			user.id,
			now,
		);
		await this.repo.createUserSession(session);

		for (const previousId of replacedSessionIds) {
			await this.repo.revokeSession(previousId, now, session.id);
		}

		return {
			sessionToken: token,
			expiresAt: session.expiresAt,
			user,
			replacedSessionIds,
		};
	}
}

export class ChangeOwnPasswordUseCase {
	constructor(
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
	) {}

	async execute(input: {
		userId: string;
		currentSessionId: string;
		currentPassword: string;
		newPassword: string;
	}): Promise<void> {
		const user = await this.repo.findUserById(input.userId);
		if (!user) {
			throw new InvalidCredentialsError();
		}
		const valid = await Bun.password.verify(
			input.currentPassword,
			user.passwordHash,
		);
		if (!valid) {
			throw new InvalidCurrentPasswordError();
		}
		const now = this.clock.nowEpochMs();
		await this.repo.updateUser(user.id, {
			passwordHash: await Bun.password.hash(input.newPassword),
			updatedAt: now,
		});
		await this.repo.revokeAllUserSessions(user.id, now, input.currentSessionId);
	}
}

export class CreateUserUseCase {
	constructor(
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
	) {}

	async execute(
		input: CreatePlayerAccountRequest &
			(
				| { role: UserRole; createdUnderGmId?: never }
				| { role: "pl"; createdUnderGmId: string }
			),
	): Promise<UserRecord> {
		const user = await this.prepare(input, input.role);
		if (input.createdUnderGmId) {
			user.createdUnderGmId = input.createdUnderGmId;
			user.creationSource = "gm";
		}
		await this.repo.createUser(user);
		return user;
	}

	async registerInvitedPlayer(
		input: CreatePlayerAccountRequest,
		resolveGmId: () => Promise<string>,
	): Promise<LoginResult> {
		const user = await this.prepare(input, "pl");
		user.createdUnderGmId = await resolveGmId();
		user.creationSource = "invite";
		const { token, session } = issueUserSession(
			this.idGenerator.nextId(),
			user.id,
			this.clock.nowEpochMs(),
		);
		await this.repo.createUser(user, session);
		return {
			sessionToken: token,
			expiresAt: session.expiresAt,
			user,
			replacedSessionIds: [],
		};
	}

	private async prepare(
		input: CreatePlayerAccountRequest,
		role: UserRole,
	): Promise<UserRecord> {
		const normalized = normalizeUsername(input.username);
		const existing = await this.repo.findUserByUsernameNormalized(normalized);
		if (existing) {
			throw new UsernameTakenError();
		}
		const passwordHash = await Bun.password.hash(input.password);
		const now = this.clock.nowEpochMs();
		return {
			id: this.idGenerator.nextId(),
			username: input.username.trim(),
			usernameNormalized: normalized,
			passwordHash,
			role,
			createdUnderGmId: null,
			creationSource: null,
			disabledAt: null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}
}

export class UpdateUserUseCase {
	constructor(
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
		private readonly onSessionsRevoked?: (userId: string) => void,
	) {}

	async execute(input: {
		userId: string;
		actorUserId: string;
		disabled?: boolean;
		deleted?: boolean;
		username?: string;
	}): Promise<{ user: UserRecord; revoked: boolean }> {
		const user = await this.repo.findUserById(input.userId);
		if (!user) {
			throw new UserNotFoundError();
		}

		const willLoseAccess =
			(input.disabled === true && user.disabledAt === null) ||
			(input.deleted === true && user.deletedAt === null);
		if (willLoseAccess && user.role === "admin") {
			const remaining = await this.repo.countActiveAdmins(user.id);
			if (remaining < 1) {
				throw new LastAdminError();
			}
		}

		const now = this.clock.nowEpochMs();
		const patch: Parameters<IdentityRepository["updateUser"]>[1] = {
			updatedAt: now,
		};

		if (input.username !== undefined) {
			const normalized = normalizeUsername(input.username);
			const clash = await this.repo.findUserByUsernameNormalized(normalized);
			if (clash && clash.id !== user.id) {
				throw new UsernameTakenError();
			}
			patch.username = input.username.trim();
			patch.usernameNormalized = normalized;
		}
		if (input.disabled !== undefined) {
			patch.disabledAt = input.disabled ? (user.disabledAt ?? now) : null;
		}
		if (input.deleted !== undefined) {
			patch.deletedAt = input.deleted ? (user.deletedAt ?? now) : null;
		}

		await this.repo.updateUser(user.id, patch);

		let revoked = false;
		if (patch.disabledAt || patch.deletedAt) {
			await this.repo.revokeAllUserSessions(user.id, now);
			revoked = true;
			this.onSessionsRevoked?.(user.id);
		}

		const updated = await this.repo.findUserById(user.id);
		return { user: updated ?? user, revoked };
	}
}

export class ResetUserPasswordUseCase {
	constructor(
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
		private readonly onSessionsRevoked?: (userId: string) => void,
	) {}

	async execute(input: { userId: string; password: string }): Promise<void> {
		const user = await this.repo.findUserById(input.userId);
		if (!user) {
			throw new UserNotFoundError();
		}
		const now = this.clock.nowEpochMs();
		await this.repo.updateUser(user.id, {
			passwordHash: await Bun.password.hash(input.password),
			updatedAt: now,
		});
		await this.repo.revokeAllUserSessions(user.id, now);
		this.onSessionsRevoked?.(user.id);
	}
}
