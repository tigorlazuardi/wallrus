import { defineConfig } from "drizzle-kit"

// Schema source-of-truth → derived migrations.
// Run schema-derived migrations with a descriptive --name flag, per
// `.claude/rules/database.md` §Stable migration filenames:
//   bunx drizzle-kit generate --name <descriptive_snake_case>
//
// For PRAGMAs / FTS5 / triggers / views that Drizzle can't express:
//   bunx drizzle-kit generate --custom --name <descriptive_snake_case>
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/lib/server/db/schema.ts",
	out: "./drizzle/migrations",
	dbCredentials: {
		// Sentinel only — actual DB path is resolved at runtime from WALLRUS_DATA_DIR.
		// drizzle-kit only needs a path for `studio` / `push` operations.
		url: "file:./drizzle/dev.db",
	},
	strict: true,
	verbose: true,
})
