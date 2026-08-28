import type { Clock, IdGenerator } from "@/platform/ports";
import type { IdentityRepository, GmLoginSession } from "./ports";
import { GmPasswordNotConfiguredError, InvalidCredentialsError } from "../domain/errors";
import { issueOpaqueToken } from "./token";

export class GmLoginUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(password: string): Promise<{ sessionToken: string; expiresAt: number }> {
    const gmPasswordHash = await this.repo.findGmPasswordHash();
    if (!gmPasswordHash) {
      throw new GmPasswordNotConfiguredError();
    }
    const isValid = await Bun.password.verify(password, gmPasswordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const issued = issueOpaqueToken();
    const sessionToken = issued.token;
    const sessionTokenHash = issued.tokenHash;
    const id = this.idGenerator.nextId();
    const now = this.clock.nowEpochMs();
    const expiresAt = now + 24 * 60 * 60 * 1000;

    const session: GmLoginSession = {
      id,
      sessionTokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: now,
    };

    await this.repo.saveGmSession(session);

    return { sessionToken, expiresAt };
  }
}
