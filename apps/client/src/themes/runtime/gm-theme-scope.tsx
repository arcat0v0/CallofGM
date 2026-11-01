import { useEffect, type ReactNode } from "react";
import { useGmSettingsStore } from "@/stores/gm-settings-store";
import { ThemeScope } from "./theme-scope";

export function GmThemeScope({ children }: { children: ReactNode }) {
  const load = useGmSettingsStore((state) => state.load);
  const gmThemeId = useGmSettingsStore((state) => state.gmThemeId);

  useEffect(() => {
    void load();
  }, [load]);

  return <ThemeScope themeId={gmThemeId}>{children}</ThemeScope>;
}