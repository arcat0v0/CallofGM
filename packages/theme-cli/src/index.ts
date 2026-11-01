#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import { zipSync } from "fflate";
import { THEME_API_VERSION, ThemeId, ThemeManifest } from "@cogm/shared";
import { THEME_SLOT_NAMES } from "@cogm/theme-sdk";

type ThemeConfig = {
  id: string;
  name: string;
  version: string;
  apiVersion: number;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  styles?: string[];
  defaultLocale?: string;
  locales?: string[];
  colorScheme?: "dark" | "light";
  themeColor?: string;
  icon?: string;
  slots?: string[];
};

const SDK_KEYS = ["defineTheme", "cn", "t", "assetUrl", "navigate", "useLocale"];

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

async function sdkShimPlugin(): Promise<Plugin> {
  const react = await import("react");
  const reactDom = await import("react-dom");
  const reactKeys = Object.keys(react).filter((key) => key !== "default" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key));
  const reactDomKeys = Object.keys(reactDom).filter(
    (key) => key !== "default" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key),
  );

  function shimFor(specifier: string): string {
    const global = "const sdk = globalThis.__COGM_THEME_SDK__;\n";
    if (specifier === "react") {
      return `${global}${reactKeys.map((key) => `export const ${key} = sdk.React.${key};`).join("\n")}\nexport default sdk.React;`;
    }
    if (specifier === "react/jsx-runtime") {
      return `${global}export const jsx = sdk.jsx;\nexport const jsxs = sdk.jsxs;\nexport const Fragment = sdk.Fragment;\n`;
    }
    if (specifier === "react/jsx-dev-runtime") {
      return `${global}export const jsxDEV = sdk.jsx;\nexport const Fragment = sdk.Fragment;\n`;
    }
    if (specifier === "react-dom") {
      return `${global}${reactDomKeys.map((key) => `export const ${key} = sdk.ReactDOM.${key};`).join("\n")}\nexport default sdk.ReactDOM;`;
    }
    if (specifier === "react-dom/client") {
      return `${global}export const createRoot = sdk.ReactDOMClient.createRoot;\nexport const hydrateRoot = sdk.ReactDOMClient.hydrateRoot;\n`;
    }
    return `${global}${SDK_KEYS.map((key) => `export const ${key} = sdk.${key};`).join("\n")}\nexport const THEME_API_VERSION = ${THEME_API_VERSION};\nexport const THEME_SLOT_NAMES = ${JSON.stringify(THEME_SLOT_NAMES)};\nexport default sdk;`;
  }

  return {
    name: "cogm-theme-sdk-shim",
    setup(builder) {
      builder.onResolve(
        { filter: /^(?:react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|react-dom\/client|@cogm\/theme-sdk)$/ },
        (args) => ({ path: args.path, namespace: "cogm-theme-sdk" }),
      );
      builder.onLoad({ filter: /.*/, namespace: "cogm-theme-sdk" }, (args) => ({
        contents: shimFor(args.path),
        loader: "js",
      }));
    },
  };
}

async function readConfig(root: string): Promise<ThemeConfig> {
  const configPath = join(root, "theme.config.ts");
  const module = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)) as {
    default?: ThemeConfig;
  };
  if (!module.default) {
    throw new Error("theme.config.ts 缺少默认导出");
  }
  return module.default;
}

async function copyDirectory(source: string, target: string): Promise<void> {
  try {
    const info = await stat(source);
    if (!info.isDirectory()) {
      return;
    }
  } catch {
    return;
  }
  await cp(source, target, { recursive: true });
}

async function commandBuild(rootInput: string): Promise<void> {
  const root = resolve(rootInput);
  const config = await readConfig(root);
  const dist = join(root, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const entry = join(root, "src", "index.tsx");
  const plugin = await sdkShimPlugin();
  const result = await build({
    entryPoints: [entry],
    outfile: join(dist, "bundle.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "react",
    minify: true,
    sourcemap: false,
    write: true,
    plugins: [plugin],
    loader: {
      ".png": "file",
      ".jpg": "file",
      ".jpeg": "file",
      ".webp": "file",
      ".gif": "file",
      ".svg": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".otf": "file",
    },
    assetNames: "assets/[name]-[hash]",
    logLevel: "silent",
  });
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(error.text);
    }
    throw new Error("主题构建失败");
  }

  const bundle = await readFile(join(dist, "bundle.js"));
  const bundleHash = `sha256:${sha256(bundle)}`;

  const bundleCssPath = join(dist, "bundle.css");
  let hasBundleCss = await stat(bundleCssPath).then((info) => info.isFile()).catch(() => false);
  try {
    const sourceStyles = await readFile(join(root, "src", "styles.css"), "utf8");
    if (hasBundleCss) {
      const emittedStyles = await readFile(bundleCssPath, "utf8");
      const normalize = (value: string) => value.replace(/\s+/g, "");
      if (!normalize(emittedStyles).includes(normalize(sourceStyles))) {
        await writeFile(bundleCssPath, `${emittedStyles}\n${sourceStyles}`);
      }
    } else {
      await writeFile(bundleCssPath, sourceStyles);
      hasBundleCss = true;
    }
  } catch {
    hasBundleCss = await stat(bundleCssPath).then((info) => info.isFile()).catch(() => false);
  }

  let styles = config.styles;
  if (hasBundleCss && !styles?.includes("bundle.css")) {
    styles = [...(styles ?? []), "bundle.css"];
  } else if (!hasBundleCss && !styles) {
    styles = [];
  }

  await copyDirectory(join(root, "assets"), join(dist, "assets"));
  for (const optional of ["preview.png", "README.md"]) {
    try {
      await cp(join(root, optional), join(dist, optional));
    } catch {
      continue;
    }
  }

  const manifest = ThemeManifest.parse({
    ...config,
    formatVersion: 1,
    entry: "bundle.js",
    styles,
    bundleHash,
    signature: null,
  });
  await writeFile(join(dist, "theme.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`built ${manifest.id}@${manifest.version} -> ${relative(process.cwd(), dist)}`);
}

async function listFiles(root: string, prefix = ""): Promise<Array<{ path: string; data: Uint8Array }>> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: Array<{ path: string; data: Uint8Array }> = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, path)));
    } else if (entry.isFile()) {
      files.push({ path, data: new Uint8Array(await readFile(full)) });
    }
  }
  return files;
}

async function commandPack(rootInput: string, outputInput?: string): Promise<void> {
  const root = resolve(rootInput);
  const dist = join(root, "dist");
  const manifest = ThemeManifest.parse(JSON.parse(await readFile(join(dist, "theme.json"), "utf8")));
  const files: Record<string, Uint8Array> = {};
  for (const file of await listFiles(dist)) {
    files[file.path] = file.data;
  }
  const archive = zipSync(files, { level: 9 });
  const output = resolve(outputInput ?? join(root, `${manifest.id}-${manifest.version}.cogmtheme`));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, archive);
  console.log(`packed ${manifest.id}@${manifest.version} -> ${relative(process.cwd(), output)}`);
}

const SCAFFOLD_INDEX = `import { defineTheme } from "@cogm/theme-sdk";
import type { PlayDialogueCtx } from "@cogm/theme-sdk";

function PlayDialogue({ speaker, text, roleLabel }: PlayDialogueCtx) {
  return (
    <div className="cogm-dialogue">
      <div className="cogm-dialogue__name">{speaker}</div>
      {roleLabel ? <div className="cogm-dialogue__role">{roleLabel}</div> : null}
      <p className="cogm-dialogue__text">{text}</p>
    </div>
  );
}

export default defineTheme({
  slots: {
    "play.dialogue": PlayDialogue,
  },
});
`;

const SCAFFOLD_STYLES = `.cogm-dialogue {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: 1.75rem;
  background: color-mix(in srgb, var(--color-md-surface-container-high) 95%, transparent);
  padding: 1.5rem 1.75rem;
  color: var(--color-md-on-surface);
  box-shadow: var(--shadow-dialogue);
  backdrop-filter: blur(16px);
}

.cogm-dialogue__name {
  font-family: var(--font-serif);
  font-weight: 700;
  color: var(--color-md-primary);
}

.cogm-dialogue__role {
  font-size: 0.75rem;
  color: var(--color-md-on-surface-variant);
}

.cogm-dialogue__text {
  margin: 0;
  line-height: 1.6;
}
`;

async function commandInit(idInput: string, dirInput?: string): Promise<void> {
  if (!ThemeId.safeParse(idInput).success) {
    throw new Error("主题 id 必须为 author.theme 形式");
  }
  const root = resolve(dirInput ?? idInput);
  const cliEntry = join(import.meta.dir, "index.ts");
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  const config = `export default {
  id: "${idInput}",
  name: "${basename(root)}",
  version: "1.0.0",
  apiVersion: 1,
  description: "自定义主题",
  defaultLocale: "zh-CN",
  styles: ["bundle.css"],
};
`;
  await writeFile(join(root, "theme.config.ts"), config);
  await writeFile(join(root, "src", "index.tsx"), SCAFFOLD_INDEX);
  await writeFile(join(root, "src", "styles.css"), SCAFFOLD_STYLES);
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: idInput,
        private: true,
        type: "module",
        scripts: {
          build: `bun ${JSON.stringify(cliEntry)} build .`,
          pack: `bun ${JSON.stringify(cliEntry)} pack .`,
        },
        dependencies: {
          "@cogm/theme-sdk": "^0.0.0",
          react: "^19.2.7",
          "react-dom": "^19.2.7",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(root, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
        },
        include: ["src", "theme.config.ts"],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(root, "README.md"),
    `# ${basename(root)}\n\n用 \`bun run build\` 构建，用 \`bun run pack\` 打包，然后在 CoGM 后台安装。\n`,
  );
  console.log(`created theme scaffold at ${relative(process.cwd(), root)}`);
}

async function main(): Promise<void> {
  const [command, ...args] = Bun.argv.slice(2);
  try {
    if (command === "build") {
      await commandBuild(args[0] ?? ".");
      return;
    }
    if (command === "pack") {
      await commandPack(args[0] ?? ".");
      return;
    }
    if (command === "init") {
      const id = args[0];
      if (!id) {
        throw new Error("用法: cogm-theme init <author.theme> [dir]");
      }
      await commandInit(id, args[1]);
      return;
    }
    console.log("用法:");
    console.log("  cogm-theme init <author.theme> [dir]");
    console.log("  cogm-theme build [dir]");
    console.log("  cogm-theme pack [dir] [output]");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();