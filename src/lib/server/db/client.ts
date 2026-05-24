import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

export type DbClient = ReturnType<typeof create_db>

export function create_db(file_path: string) {
	const sqlite = new Database(file_path, { create: true })

	// All PRAGMAs applied here, before drizzle wraps anything in a transaction.
	// `journal_mode = WAL` is the only one that persists on the DB file (idempotent
	// to set on every open); the rest are session-scoped and must be reapplied
	// on every connection. Setting WAL inside a drizzle migration transaction
	// errors with "cannot change into wal mode from within a transaction", so
	// PRAGMAs live in client.ts rather than as a migration.
	// See `.claude/rules/database.md` §PRAGMA handling.
	sqlite.exec("PRAGMA journal_mode = WAL;")
	sqlite.exec("PRAGMA foreign_keys = ON;")
	sqlite.exec("PRAGMA synchronous = NORMAL;")
	sqlite.exec("PRAGMA busy_timeout = 5000;")
	sqlite.exec("PRAGMA cache_size = -64000;")
	sqlite.exec("PRAGMA temp_store = MEMORY;")
	sqlite.exec("PRAGMA mmap_size = 268435456;")

	return drizzle(sqlite, { schema })
}
