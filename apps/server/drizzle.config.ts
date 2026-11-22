import { defineConfig } from "drizzle-kit";
import { loadConfig } from "./src/config/app-config";

const config = loadConfig();

export default defineConfig({
  out: "./migrations",
  schema: "./src/platform/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: config.databaseUrl,
  },
});
