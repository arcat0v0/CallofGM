import type { ThemeDefinition } from "@cogm/theme-sdk";

let defaultTheme: ThemeDefinition | null = null;

export function registerDefaultTheme(theme: ThemeDefinition): void {
  defaultTheme = theme;
}

export function getDefaultTheme(): ThemeDefinition | null {
  return defaultTheme;
}