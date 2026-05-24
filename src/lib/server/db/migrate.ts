import { migrate as drizzle_migrate } from "drizzle-orm/bun-sqlite/migrator"
import type { DbClient } from "./client"

// Run all pending migrations from `drizzle/migrations`. Idempotent: drizzle
// records applied migrations in a metadata table, so re-running is a no-op
// when up to date. Wallrus auto-migrates on every `serve` boot — homelab
// single-machine assumption per `.claude/rules/database.md` §Migration strategy.
export function run_migrations(db: DbClient) {
	drizzle_migrate(db, { migrationsFolder: "./drizzle/migrations" })
}
