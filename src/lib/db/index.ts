import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { isDatabaseConfigured } from "@/lib/auth/env";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

export { isDatabaseConfigured };

/** Conexão preguiçosa. Sem DATABASE_URL o app segue no modo anônimo. */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!database) {
    client = postgres(url, { max: 1, prepare: false });
    database = drizzle(client, { schema });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 1 });
  client = null;
  database = null;
}
