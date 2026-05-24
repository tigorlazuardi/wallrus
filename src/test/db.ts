/**
 * In-memory SQLite test helper.
 *
 * Creates a fresh `:memory:` SQLite database, applies all session PRAGMAs,
 * and runs all pending migrations. Returns a ready-to-use Drizzle handle.
 *
 * Use once per test file (or once per test if isolation is needed):
 *
 *   const db = create_test_db()
 *   const svc = new DeviceService({ db })
 */
import { create_db, type DbClient } from "$lib/server/db/client"
import { run_migrations } from "$lib/server/db/migrate"

export function create_test_db(): DbClient {
	const db = create_db(":memory:")
	run_migrations(db)
	return db
}
