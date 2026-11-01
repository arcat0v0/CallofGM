import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { ThemeDefinition } from "@cogm/theme-sdk";
import { ThemeContext } from "@/themes/runtime/theme-context";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import "@/themes/runtime/bootstrap";
import type { LoadedTheme } from "@/themes/runtime/loader";

const manifest = {
  formatVersion: 1 as const,
  id: "test.theme",
  name: "Test",
  version: "1.0.0",
  apiVersion: 1,
  entry: "bundle.js" as const,
  styles: [],
  defaultLocale: "zh-CN",
  locales: [],
  bundleHash: `sha256:${"0".repeat(64)}`,
};

function loaded(definition: ThemeDefinition): LoadedTheme {
  return {
    manifest,
    definition,
    baseUrl: "http://localhost/api/v1/themes/test.theme/versions/1.0.0/",
    version: "1.0.0",
    id: "test.theme",
  };
}

function renderSlot(theme: LoadedTheme | null, fallbackText = "fallback") {
  return render(
    <ThemeContext.Provider value={{ theme, error: null, loading: false }}>
      <ThemeSlot
        name="join.header"
        ctx={{ status: "waiting", moduleName: "默认页面", loading: false }}
        fallback={<span>{fallbackText}</span>}
      />
    </ThemeContext.Provider>,
  );
}

describe("ThemeSlot", () => {
  test("renders the default theme when no theme is active", () => {
    const view = renderSlot(null);
    expect(view.getByText("默认页面")).toBeTruthy();
  });

  test("renders a themed slot when the active theme provides it", () => {
    const view = renderSlot(
      loaded({
        slots: {
          "join.header": () => <span>主题页面</span>,
        },
      }),
    );
    expect(view.getByText("主题页面")).toBeTruthy();
  });

  test("falls back to the default implementation when the theme slot throws", () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const view = renderSlot(
        loaded({
          slots: {
            "join.header": () => {
              throw new Error("boom");
            },
          },
        }),
      );
      expect(view.getByText("默认页面")).toBeTruthy();
    } finally {
      console.error = original;
    }
  });
});