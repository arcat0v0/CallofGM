import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

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