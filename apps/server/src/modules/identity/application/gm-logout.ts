import { createHash } from "crypto";
import type { Clock } from "@/platform/ports";
import type { IdentityRepository } from "./ports";
import { AuthRequiredError } from "../domain/errors";

export class GmLogoutUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly repo: IdentityRepository
  ) {}

  async execute(sessionToken: string): Promise<void> {
    const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const session = await this.repo.findGmSessionByTokenHash(sessionTokenHash);
    if (!session || session.revokedAt !== null || session.expiresAt < this.clock.nowEpochMs()) {
      throw new AuthRequiredError();
    }

    await this.repo.revokeGmSession(session.id, this.clock.nowEpochMs());
  }
}
