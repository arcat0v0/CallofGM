import { createHash } from "crypto";
import type { Clock, IdGenerator } from "@/platform/ports";
import type { IdentityRepository, GmLoginSession } from "./ports";
import { InvalidCredentialsError } from "../domain/errors";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class GmLoginUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly repo: IdentityRepository,
    private readonly gmPasswordHash: string
  ) {}

  async execute(password: string): Promise<{ sessionToken: string; expiresAt: number }> {
    const isValid = await Bun.password.verify(password, this.gmPasswordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const sessionToken = crypto.randomUUID() + crypto.randomUUID();
    const sessionTokenHash = hashToken(sessionToken);
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
