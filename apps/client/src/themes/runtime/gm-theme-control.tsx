import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import type { ThemeSummaryDto } from "@cogm/shared";
import { useGmSettingsStore } from "@/stores/gm-settings-store";
import { listThemes } from "@/themes/themes-api";
import { t } from "@/i18n";

export function GmThemeControl() {
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
  const [selection, setSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const gmThemeId = useGmSettingsStore((state) => state.gmThemeId);
  const error = useGmSettingsStore((state) => state.error);
  const setGmThemeId = useGmSettingsStore((state) => state.setGmThemeId);

  useEffect(() => {
    setSelection(gmThemeId ?? "");
  }, [gmThemeId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void listThemes()
      .then((items) => {
        if (!cancelled) {
          setThemes(items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function apply(): Promise<void> {
    setSaving(true);
    await setGmThemeId(selection || null);
    setSaving(false);
  }

  return (
    <div className="fixed right-4 bottom-4 z-[20000]">
      {open ? (
        <div className="mb-2 w-64 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-neutral-50 shadow-xl">
          <div className="mb-2 text-sm font-medium">{t("gm.themeControl.title")}</div>
          <select
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
            className="mb-2 w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-50"
          >
            <option value="">{t("gm.themeControl.default")}</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name} ({theme.version})
              </option>
            ))}
          </select>
          {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              {t("gm.themeControl.close")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void apply()}
              className="rounded-md bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-900 disabled:opacity-50"
            >
              {saving ? t("gm.themeControl.saving") : t("gm.themeControl.apply")}
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={t("gm.themeControl.aria")}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-50 shadow-lg hover:bg-neutral-800"
      >
        <Palette className="size-4" />
      </button>
    </div>
  );
}