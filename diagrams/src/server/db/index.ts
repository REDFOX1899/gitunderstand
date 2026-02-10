import * as schema from "./schema";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { config } from "dotenv";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

config({ path: ".env" });

// Define a type that can be either Neon or Postgres database
type DrizzleDatabase =
  | NeonHttpDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

// Check if we're using Neon/Vercel (production) or local Postgres
const isNeonConnection = process.env.POSTGRES_URL?.includes("neon.tech");

function createPostgresClient() {
  const connUrl = process.env.POSTGRES_URL!;

  // Cloud SQL Unix socket: extract ?host=/cloudsql/... and pass separately
  // because postgres.js uses new URL() which ignores the host query param
  try {
    const parsed = new URL(connUrl);
    const socketPath = parsed.searchParams.get("host");
    if (socketPath) {
      parsed.searchParams.delete("host");
      return postgres(parsed.toString(), { host: socketPath });
    }
  } catch {
    // URL parsing failed, use as-is
  }

  return postgres(connUrl);
}

let db: DrizzleDatabase;
if (isNeonConnection) {
  // Production: Use Neon HTTP connection
  const sql = neon(process.env.POSTGRES_URL!);
  db = drizzleNeon(sql, { schema });
} else {
  // Local/Cloud SQL: Use standard Postgres connection
  const client = createPostgresClient();
  db = drizzlePostgres(client, { schema });
}

export { db };
