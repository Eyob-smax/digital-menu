import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Prefer the pooled URL, fall back to the direct one.
 *
 * Neon's `-pooler` hostname resolves to IPv6-only addresses in some regions.
 * On a network without IPv6 routing — which includes plenty of home and
 * office connections — every query fails with an opaque "fetch failed".
 * Setting DATABASE_URL_UNPOOLED_ONLY=1 forces the direct endpoint on such a
 * network; in production on a dual-stack host, the pooled URL is the right
 * default and is used automatically.
 */
const connectionString =
  process.env.DATABASE_URL_UNPOOLED_ONLY === "1"
    ? (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)
    : (process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED);

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Run `neon link` to pull it, or copy .env.example to .env.local and paste your Neon connection string.",
  );
}

/**
 * Neon's HTTP driver: one fetch per query, no pool to exhaust. That suits
 * serverless request handlers, where a long-lived TCP pool is a liability.
 *
 * Trade-off worth knowing: neon-http does not support interactive
 * transactions. Multi-statement work that must be atomic (placing an order)
 * uses `db.batch([...])`, which Neon runs as a single transaction.
 */
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export * from "./schema";
