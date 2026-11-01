import type { ThemeManifest } from "@cogm/shared";
import { themeFileUrl } from "./loader";

type Baseline = {
  themeColor: string | null;
  iconHref: string | null;
};

let baseline: Baseline | null = null;
let appliedTokens: string[] = [];
let appliedLinks: HTMLLinkElement[] = [];
let appliedIcon: HTMLLinkElement | null = null;
let appliedThemeColor: HTMLMetaElement | null = null;

function captureBaseline(): Baseline {
  if (baseline) {
    return baseline;
  }
  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const iconLink = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  baseline = {
    themeColor: themeColorMeta?.content ?? null,
    iconHref: iconLink?.href ?? null,
  };
  return baseline;
}

export function resetThemeDom(): void {
  const root = document.documentElement;
  for (const name of appliedTokens) {
    root.style.removeProperty(name);
  }
  appliedTokens = [];
  root.removeAttribute("data-cogm-theme");
  root.style.removeProperty("color-scheme");
  for (const link of appliedLinks) {
    link.remove();
  }
  appliedLinks = [];
  const hadIcon = appliedIcon !== null;
  const hadThemeColor = appliedThemeColor !== null;
  appliedIcon?.remove();
  appliedIcon = null;
  appliedThemeColor?.remove();
  appliedThemeColor = null;
  if (!hadIcon && !hadThemeColor) {
    return;
  }
  const base = captureBaseline();
  if (hadIcon && base.iconHref) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = base.iconHref;
    document.head.append(link);
    appliedIcon = link;
  }
  if (hadThemeColor && base.themeColor) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = base.themeColor;
    document.head.append(meta);
    appliedThemeColor = meta;
  }
}

export function applyThemeDom(manifest: ThemeManifest): void {
  resetThemeDom();
  captureBaseline();
  const root = document.documentElement;
  root.setAttribute("data-cogm-theme", manifest.id);

  if (manifest.tokens) {
    for (const [token, value] of Object.entries(manifest.tokens)) {
      const name = `--color-${token}`;
      root.style.setProperty(name, value);
      appliedTokens.push(name);
    }
  }
  if (manifest.colorScheme) {
    root.style.colorScheme = manifest.colorScheme;
  }

  for (const stylePath of manifest.styles) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = themeFileUrl(manifest.id, manifest.version, stylePath);
    link.dataset.cogmThemeStyle = manifest.id;
    document.head.append(link);
    appliedLinks.push(link);
  }

  if (manifest.icon) {
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    existing?.remove();
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = themeFileUrl(manifest.id, manifest.version, manifest.icon);
    document.head.append(link);
    appliedIcon = link;
  }

  if (manifest.themeColor) {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? document.createElement("meta");
    meta.name = "theme-color";
    meta.content = manifest.themeColor;
    if (!meta.isConnected) {
      document.head.append(meta);
    }
    appliedThemeColor = meta;
  }
}