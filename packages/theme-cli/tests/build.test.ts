import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";

const cli = resolve(import.meta.dir, "../src/index.ts");
const roots: string[] = [];

async function makeTheme(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "cogm-theme-build-"));
  roots.push(root);
  await writeFile(
    join(root, "theme.config.ts"),
    `export default {
  id: "test.theme",
  name: "Test Theme",
  version: "1.0.0",
  apiVersion: 1,
  author: "tester",
};
`,
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "src", "index.tsx"),
    `import "./styles.css";
import { THEME_API_VERSION, THEME_SLOT_NAMES, defineTheme } from "@cogm/theme-sdk";

export default defineTheme({
  slots: {
    "join.header": () => <div>{THEME_API_VERSION}:{THEME_SLOT_NAMES.length}</div>,
  },
});
`,
  );
  await writeFile(join(root, "src", "styles.css"), ".test-theme { color: red; }\n");
  return root;
}

function run(...args: string[]): void {
  const result = Bun.spawnSync(["bun", cli, ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("theme CLI", () => {
  test("builds a bundle with shared SDK globals, styles and a valid manifest", async () => {
    const root = await makeTheme();
    run("build", root);

    const manifest = JSON.parse(await readFile(join(root, "dist", "theme.json"), "utf8")) as {
      id: string;
      version: string;
      styles: string[];
      bundleHash: string;
    };
    expect(manifest.id).toBe("test.theme");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.styles).toContain("bundle.css");
    expect(manifest.bundleHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const bundle = await readFile(join(root, "dist", "bundle.js"), "utf8");
    expect(bundle).toContain("__COGM_THEME_SDK__");
    expect(bundle).not.toContain('from "react"');

    const styles = await readFile(join(root, "dist", "bundle.css"), "utf8");
    expect(styles).toContain(".test-theme");
  });

  test("packs the build output into a .cogmtheme archive", async () => {
    const root = await makeTheme();
    run("build", root);
    run("pack", root);

    const archive = await readFile(join(root, "test.theme-1.0.0.cogmtheme"));
    const files = unzipSync(archive);
    expect(Object.keys(files).sort()).toEqual(["bundle.css", "bundle.js", "theme.json"]);
  });
});