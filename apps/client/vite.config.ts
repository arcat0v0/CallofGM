import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

function clientBuildInfo() {
  const root = path.resolve(import.meta.dirname, "../..");
  const packageJson = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { version?: string };
  const commit =
    process.env.COGM_COMMIT?.trim() || readGitCommit(root) || "unknown";
  return {
    version: packageJson.version ?? "unknown",
    commit,
    buildTime: process.env.COGM_BUILD_TIME?.trim() || new Date().toISOString(),
    component: "client",
  };
}

function readGitCommit(root: string): string | null {
  const dotGit = path.join(root, ".git");
  let gitDir = dotGit;
  try {
    if (statSync(dotGit).isFile()) {
      const pointer = readFileSync(dotGit, "utf8").trim();
      if (!pointer.startsWith("gitdir:")) {
        return null;
      }
      gitDir = path.resolve(root, pointer.slice("gitdir:".length).trim());
    }
  } catch {
    return null;
  }
  let commonDir = gitDir;
  try {
    const common = readFileSync(path.join(gitDir, "commondir"), "utf8").trim();
    commonDir = path.resolve(gitDir, common);
  } catch {
    commonDir = gitDir;
  }
  try {
    const head = readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref:")) {
      return normalizeCommit(head);
    }
    const ref = head.slice("ref:".length).trim();
    try {
      return normalizeCommit(
        readFileSync(path.join(commonDir, ref), "utf8").trim(),
      );
    } catch {
      const packed = readFileSync(path.join(commonDir, "packed-refs"), "utf8");
      for (const line of packed.split("\n")) {
        if (!line || line.startsWith("#") || line.startsWith("^")) {
          continue;
        }
        const [commit, name] = line.split(" ");
        if (name === ref) {
          return normalizeCommit(commit ?? "");
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeCommit(value: string): string | null {
  return /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
}

function devDesignSystemEntry(): Plugin {
  return {
    name: "cogm-dev-design-system-entry",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.split("?")[0] === "/design-system") {
          request.url = "/design-system.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __COGM_CLIENT_BUILD__: JSON.stringify(clientBuildInfo()),
  },
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss(), devDesignSystemEntry()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 15633,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:15632",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
