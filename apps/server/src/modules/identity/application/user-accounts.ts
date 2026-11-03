import type { Clock, IdGenerator } from "@/platform/ports";
import type { IdentityRepository, UserRecord } from "./ports";
import {
  AccountDisabledError,
  InvalidCredentialsError,
  InvalidCurrentPasswordError,
  LastAdminError,
  UserNotFoundError,
  UsernameTakenError,
} from "../domain/errors";
import { issueOpaqueToken } from "./token";
import { normalizeUsername } from "./username";
import type { UserRole } from "../domain/actor";

export const USER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface LoginResult {
  sessionToken: string;
  expiresAt: number;
  user: UserRecord;
  replacedSessionIds: string[];
}

export class LoginUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(username: string, password: string): Promise<LoginResult> {
    const user = await this.repo.findUserByUsernameNormalized(normalizeUsername(username));
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
    const replacedSessionIds = previous.filter((s) => s.revokedAt === null).map((s) => s.id);

    const issued = issueOpaqueToken();
    const newSessionId = this.idGenerator.nextId();
    const expiresAt = now + USER_SESSION_TTL_MS;

    await this.repo.createUserSession({
      id: newSessionId,
      userId: user.id,
      sessionTokenHash: issued.tokenHash,
      expiresAt,
      revokedAt: null,
      replacedBySessionId: null,
      createdAt: now,
    });

    for (const previousId of replacedSessionIds) {
      await this.repo.revokeSession(previousId, now, newSessionId);
    }

    return { sessionToken: issued.token, expiresAt, user, replacedSessionIds };
  }
}

export class LogoutUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(sessionId: string): Promise<void> {
    await this.repo.revokeSession(sessionId, this.clock.nowEpochMs());
  }
}

export class ChangeOwnPasswordUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(input: { userId: string; currentSessionId: string; currentPassword: string; newPassword: string }): Promise<void> {
    const user = await this.repo.findUserById(input.userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    const valid = await Bun.password.verify(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new InvalidCurrentPasswordError();
    }
    const now = this.clock.nowEpochMs();
    await this.repo.updateUser(user.id, { passwordHash: await Bun.password.hash(input.newPassword), updatedAt: now });
    await this.repo.revokeAllUserSessions(user.id, now, input.currentSessionId);
  }
}

export class CreateUserUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(input: { username: string; password: string; role: UserRole }): Promise<UserRecord> {
    const normalized = normalizeUsername(input.username);
    const existing = await this.repo.findUserByUsernameNormalized(normalized);
    if (existing) {
      throw new UsernameTakenError();
    }
    const now = this.clock.nowEpochMs();
    const user: UserRecord = {
      id: this.idGenerator.nextId(),
      username: input.username.trim(),
      usernameNormalized: normalized,
      passwordHash: await Bun.password.hash(input.password),
      role: input.role,
      disabledAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.createUser(user);
    return user;
  }
}

export class UpdateUserUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly repo: IdentityRepository,
    private readonly onSessionsRevoked?: (userId: string) => void
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
    const patch: Parameters<IdentityRepository["updateUser"]>[1] = { updatedAt: now };

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
      patch.disabledAt = input.disabled ? user.disabledAt ?? now : null;
    }
    if (input.deleted !== undefined) {
      patch.deletedAt = input.deleted ? user.deletedAt ?? now : null;
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
    private readonly onSessionsRevoked?: (userId: string) => void
  ) {}

  async execute(input: { userId: string; password: string }): Promise<void> {
    const user = await this.repo.findUserById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    const now = this.clock.nowEpochMs();
    await this.repo.updateUser(user.id, { passwordHash: await Bun.password.hash(input.password), updatedAt: now });
    await this.repo.revokeAllUserSessions(user.id, now);
    this.onSessionsRevoked?.(user.id);
  }
}
