export interface UiSettings {
  gmThemeId: string | null;
  updatedAt: number;
}

export interface UiSettingsRepository {
  get(): Promise<UiSettings | null>;
  set(gmThemeId: string | null, updatedAt: number): Promise<void>;
}