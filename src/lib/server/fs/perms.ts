import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Enforce 0750 on the data dir (owner + group, never world) and 0600 on the DB
// file plus its WAL/SHM sidecars. The data dir is group-readable so an operator
// group (PGID) can serve images over Samba/syncthing; the DB stays owner-only
// because source credentials live there in plaintext. See `.claude/rules/api.md`
// §Credentials.

const MODE_DIR = 0o750
const MODE_FILE = 0o600

export function ensure_data_dir(base_dir: string) {
	if (!existsSync(base_dir)) {
		mkdirSync(base_dir, { recursive: true, mode: MODE_DIR })
	}
	chmodSync(base_dir, MODE_DIR)
	assert_mode(base_dir, MODE_DIR)
}

export function ensure_db_perms(db_file: string) {
	// db_file plus SQLite's WAL/SHM sidecars. Skip any that don't exist yet
	// (first boot — drizzle creates the db; WAL/SHM appear on first write).
	for (const file of [db_file, `${db_file}-wal`, `${db_file}-shm`]) {
		if (!existsSync(file)) continue
		chmodSync(file, MODE_FILE)
		assert_mode(file, MODE_FILE)
	}
}

function assert_mode(path: string, expected: number) {
	const actual = statSync(path).mode & 0o777
	if ((actual | expected) !== expected) {
		throw new Error(
			`wallrus refuses to run: ${path} has mode ${actual.toString(8)}; ` +
				`required mode ${expected.toString(8)}. Fix with: chmod ${expected.toString(8)} ${path}`,
		)
	}
}

export function db_file_path(base_dir: string) {
	return join(base_dir, "wallrus.db")
}
