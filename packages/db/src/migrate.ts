import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function runMigrations() {
  const client = postgres(DATABASE_URL as string, { max: 1 });

  // Enable pgvector extension before running schema migrations
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension enabled");

  const db = drizzle(client);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./packages/db/drizzle" });
  console.log("Migrations complete");

  await client.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
