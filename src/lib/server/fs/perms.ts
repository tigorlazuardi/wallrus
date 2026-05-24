import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Enforce 0700 on the data dir and 0600 on the DB file. Wallrus refuses to
// start if either is world/group readable — credentials live in plaintext
// per the source-credentials decision. See `.claude/rules/api.md` §Credentials.

const MODE_DIR = 0o700
const MODE_FILE = 0o600

export function ensure_data_dir(base_dir: string) {
	if (!existsSync(base_dir)) {
		mkdirSync(base_dir, { recursive: true, mode: MODE_DIR })
	}
	chmodSync(base_dir, MODE_DIR)
	assert_mode(base_dir, MODE_DIR)
}

export function ensure_db_perms(db_file: string) {
	if (!existsSync(db_file)) return // first boot — drizzle-kit will create it
	chmodSync(db_file, MODE_FILE)
	assert_mode(db_file, MODE_FILE)
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
