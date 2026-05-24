import { sql } from "drizzle-orm"
import {
	check,
	customType,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"

// Typed JSON column. Services NEVER call JSON.parse / JSON.stringify directly
// — always go through this customType. See `.claude/rules/database.md` §SQLite
// conventions #4.
export const jsonCol = <T>(name: string) =>
	customType<{ data: T; driverData: string }>({
		dataType: () => "text",
		toDriver: (v) => JSON.stringify(v),
		fromDriver: (v) => JSON.parse(v) as T,
	})(name)

// Boolean stored as 0/1 INTEGER. We expose JS bool on read, INT on write.
export const boolCol = (name: string) =>
	customType<{ data: boolean; driverData: number }>({
		dataType: () => "integer",
		toDriver: (v) => (v ? 1 : 0),
		fromDriver: (v) => v === 1,
	})(name)

/* ============================================================================
 * Domain types backing the typed JSON columns. Mirror per-domain schemas in
 * `$lib/schemas/<domain>/`. Defined here as TS types so Drizzle gets full
 * inference at the call site.
 * ========================================================================== */

export type DeviceFilterCriteria = {
	min_width?: number
	max_width?: number
	min_height?: number
	max_height?: number
	aspect_ratio?: { target: number; tolerance: number }
	min_bytes?: number
	max_bytes?: number
	formats?: Array<"jpg" | "png" | "webp" | "avif">
	tags_include?: string[]
	tags_exclude?: string[]
	nsfw: "all" | "sfw_only" | "nsfw_only"
}

export type SourceCredentialPayload = Record<string, unknown>

export type InputParamsSnapshot = Record<string, unknown>

export type DeviceAdds = Record<string, number>

/* ============================================================================
 * images
 * ========================================================================== */

export const images = sqliteTable(
	"images",
	{
		id: text("id").primaryKey(),
		sha256: text("sha256").notNull(),
		source_slug: text("source_slug").notNull(),
		source_id: text("source_id").notNull(),
		source_url: text("source_url").notNull(),
		image_url: text("image_url").notNull(),
		title: text("title").notNull(),
		filename: text("filename").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		file_size: integer("file_size").notNull(),
		format: text("format").notNull(),
		nsfw: text("nsfw").notNull(),
		tags_source: jsonCol<string[]>("tags_source").notNull(),
		search_text: text("search_text"),
		created_at_source: integer("created_at_source"),
		ingested_at: integer("ingested_at").notNull(),
		deleted_at: integer("deleted_at"),
		blacklisted_at: integer("blacklisted_at"),
		aspect_ratio: real("aspect_ratio").generatedAlwaysAs(
			sql`CAST("width" AS REAL) / "height"`,
			{ mode: "virtual" },
		),
	},
	(t) => [
		uniqueIndex("images_sha256_unique").on(t.sha256),
		uniqueIndex("images_source_url_unique").on(t.source_url),
		index("idx_images_source_slug").on(t.source_slug),
		index("idx_images_ingested_at").on(t.ingested_at),
		index("idx_images_deleted_partial")
			.on(t.id)
			.where(sql`${t.deleted_at} IS NOT NULL`),
		index("idx_images_blacklisted_partial")
			.on(t.id)
			.where(sql`${t.blacklisted_at} IS NOT NULL`),
		check("images_format_check", sql`${t.format} IN ('jpg','png','webp','avif')`),
		check("images_nsfw_check", sql`${t.nsfw} IN ('sfw','nsfw','unknown')`),
	],
)

/* ============================================================================
 * image_user_tags (junction)
 * ========================================================================== */

export const image_user_tags = sqliteTable(
	"image_user_tags",
	{
		image_id: text("image_id")
			.notNull()
			.references(() => images.id, { onDelete: "no action" }),
		tag: text("tag").notNull(),
		created_at: integer("created_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.image_id, t.tag] }),
		// Reverse composite for "images with tag X" lookups.
		index("idx_imgtag_reverse").on(t.tag, t.image_id),
	],
)

/* ============================================================================
 * favorites
 * ========================================================================== */

export const favorites = sqliteTable("favorites", {
	image_id: text("image_id")
		.primaryKey()
		.references(() => images.id, { onDelete: "no action" }),
	favorited_at: integer("favorited_at").notNull(),
})

/* ============================================================================
 * subscriptions
 * ========================================================================== */

export const subscriptions = sqliteTable(
	"subscriptions",
	{
		id: text("id").primaryKey(),
		source_slug: text("source_slug").notNull(),
		name: text("name").notNull(),
		input_params: jsonCol<Record<string, unknown>>("input_params").notNull(),
		cron: text("cron").notNull(),
		enabled: boolCol("enabled").notNull().default(true),
		max_items_inspected: integer("max_items_inspected"),
		created_at: integer("created_at").notNull(),
		deleted_at: integer("deleted_at"),
	},
	(t) => [
		index("idx_subs_active")
			.on(t.enabled, t.source_slug)
			.where(sql`${t.deleted_at} IS NULL`),
		index("idx_subs_deleted_partial")
			.on(t.id)
			.where(sql`${t.deleted_at} IS NOT NULL`),
	],
)

/* ============================================================================
 * source_credentials (one row per source slug)
 * ========================================================================== */

export const source_credentials = sqliteTable("source_credentials", {
	source_slug: text("source_slug").primaryKey(),
	payload: jsonCol<SourceCredentialPayload>("payload").notNull(),
	updated_at: integer("updated_at").notNull(),
})

/* ============================================================================
 * devices
 * ========================================================================== */

export const devices = sqliteTable(
	"devices",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		enabled: boolCol("enabled").notNull().default(true),
		filter_criteria: jsonCol<DeviceFilterCriteria>("filter_criteria").notNull(),
		created_at: integer("created_at").notNull(),
	},
	(t) => [uniqueIndex("devices_slug_unique").on(t.slug)],
)

/* ============================================================================
 * device_subscriptions (junction)
 * ========================================================================== */

export const device_subscriptions = sqliteTable(
	"device_subscriptions",
	{
		device_id: text("device_id")
			.notNull()
			.references(() => devices.id, { onDelete: "cascade" }),
		subscription_id: text("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "no action" }),
		created_at: integer("created_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.device_id, t.subscription_id] }),
		index("idx_devsub_reverse").on(t.subscription_id, t.device_id),
	],
)

/* ============================================================================
 * device_images (junction; tracks per-device fan-out)
 * ========================================================================== */

export const device_images = sqliteTable(
	"device_images",
	{
		device_id: text("device_id")
			.notNull()
			.references(() => devices.id, { onDelete: "cascade" }),
		image_id: text("image_id")
			.notNull()
			.references(() => images.id, { onDelete: "no action" }),
		on_disk_path: text("on_disk_path").notNull(),
		linked_at: integer("linked_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.device_id, t.image_id] }),
		index("idx_devimg_reverse").on(t.image_id, t.device_id),
	],
)

/* ============================================================================
 * run_history
 * ========================================================================== */

export const run_history = sqliteTable(
	"run_history",
	{
		id: text("id").primaryKey(),
		subscription_id: text("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "no action" }),
		started_at: integer("started_at").notNull(),
		ended_at: integer("ended_at"),
		duration_ms: integer("duration_ms").generatedAlwaysAs(sql`"ended_at" - "started_at"`, {
			mode: "virtual",
		}),
		status: text("status").notNull(),
		error: text("error"),
		stop_reason: text("stop_reason"),
		input_params_snapshot: jsonCol<InputParamsSnapshot>("input_params_snapshot").notNull(),
		items_seen: integer("items_seen").notNull().default(0),
		items_new: integer("items_new").notNull().default(0),
		items_failed_download: integer("items_failed_download").notNull().default(0),
		items_skipped_no_device: integer("items_skipped_no_device").notNull().default(0),
		device_adds: jsonCol<DeviceAdds>("device_adds").notNull().default({}),
	},
	(t) => [
		index("idx_runs_sub_started").on(t.subscription_id, t.started_at),
		index("idx_runs_status").on(t.status),
		check("runs_status_check", sql`${t.status} IN ('running','success','failed')`),
		check(
			"runs_stop_reason_check",
			sql`${t.stop_reason} IS NULL OR ${t.stop_reason} IN ('max_items_inspected','source_exhausted','error','daemon_crash')`,
		),
	],
)

/* ============================================================================
 * Inferred row types — services and routes use these via DTOs.
 * ========================================================================== */

export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
export type RunHistoryRow = typeof run_history.$inferSelect
export type NewRunHistoryRow = typeof run_history.$inferInsert
