import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations always use the direct endpoint: DDL through a connection
    // pooler is asking for trouble, and it sidesteps the IPv6-only pooled
    // hostname described in db/index.ts.
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
  verbose: true,
  strict: true,
});
