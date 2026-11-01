import type { Clock } from "@/platform/ports";
import type { ThemeRegistry } from "@/modules/themes";
import { ThemeNotFoundError } from "@/modules/themes";
import type { UiSettingsRepository } from "./ports";

export class GetUiSettingsUseCase {
  constructor(
    private readonly repo: UiSettingsRepository,
    private readonly registry: ThemeRegistry,
  ) {}

  async execute(): Promise<{ gmThemeId: string | null }> {
    await this.registry.ready();
    const stored = await this.repo.get();
    if (!stored?.gmThemeId || !this.registry.has(stored.gmThemeId)) {
      return { gmThemeId: null };
    }
    return { gmThemeId: stored.gmThemeId };
  }
}

export class UpdateUiSettingsUseCase {
  constructor(
    private readonly repo: UiSettingsRepository,
    private readonly registry: ThemeRegistry,
    private readonly clock: Clock,
  ) {}

  async execute(input: { gmThemeId: string | null }): Promise<{ gmThemeId: string | null }> {
    if (input.gmThemeId !== null) {
      await this.registry.ready();
      if (!this.registry.has(input.gmThemeId)) {
        throw new ThemeNotFoundError();
      }
    }
    await this.repo.set(input.gmThemeId, this.clock.nowEpochMs());
    return { gmThemeId: input.gmThemeId };
  }
}