-- Schema-derived migration from src/lib/server/db/schema.ts.
--
-- POST-GENERATION PATCHES (Drizzle-kit doesn't emit these):
--   1. STRICT keyword added to every CREATE TABLE.
--   2. COLLATE NOCASE on slug + tag text columns
--      (images.source_slug, subscriptions.source_slug, source_credentials.source_slug,
--       devices.slug, image_user_tags.tag).
--   3. `DEFAULT true` rewritten to `DEFAULT 1` for clarity (SQLite stores either as 1).
--
-- See `.claude/rules/database.md` §SQLite conventions. When regenerating this
-- file from schema changes, re-apply these three patches.

CREATE TABLE `device_images` (
	`device_id` text NOT NULL,
	`image_id` text NOT NULL,
	`on_disk_path` text NOT NULL,
	`linked_at` integer NOT NULL,
	PRIMARY KEY(`device_id`, `image_id`),
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_devimg_reverse` ON `device_images` (`image_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `device_subscriptions` (
	`device_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`device_id`, `subscription_id`),
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_devsub_reverse` ON `device_subscriptions` (`subscription_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL COLLATE NOCASE,
	`name` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`filter_criteria` text NOT NULL,
	`created_at` integer NOT NULL
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_slug_unique` ON `devices` (`slug`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`image_id` text PRIMARY KEY NOT NULL,
	`favorited_at` integer NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE TABLE `image_user_tags` (
	`image_id` text NOT NULL,
	`tag` text NOT NULL COLLATE NOCASE,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`image_id`, `tag`),
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_imgtag_reverse` ON `image_user_tags` (`tag`,`image_id`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`source_slug` text NOT NULL COLLATE NOCASE,
	`source_id` text NOT NULL,
	`source_url` text NOT NULL,
	`image_url` text NOT NULL,
	`title` text NOT NULL,
	`filename` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`file_size` integer NOT NULL,
	`format` text NOT NULL,
	`nsfw` text NOT NULL,
	`tags_source` text NOT NULL,
	`search_text` text,
	`created_at_source` integer,
	`ingested_at` integer NOT NULL,
	`deleted_at` integer,
	`blacklisted_at` integer,
	`aspect_ratio` real GENERATED ALWAYS AS (CAST("width" AS REAL) / "height") VIRTUAL,
	CONSTRAINT "images_format_check" CHECK("images"."format" IN ('jpg','png','webp','avif')),
	CONSTRAINT "images_nsfw_check" CHECK("images"."nsfw" IN ('sfw','nsfw','unknown'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `images_sha256_unique` ON `images` (`sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `images_source_url_unique` ON `images` (`source_url`);--> statement-breakpoint
CREATE INDEX `idx_images_source_slug` ON `images` (`source_slug`);--> statement-breakpoint
CREATE INDEX `idx_images_ingested_at` ON `images` (`ingested_at`);--> statement-breakpoint
CREATE INDEX `idx_images_deleted_partial` ON `images` (`id`) WHERE "images"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_images_blacklisted_partial` ON `images` (`id`) WHERE "images"."blacklisted_at" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `run_history` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer GENERATED ALWAYS AS ("ended_at" - "started_at") VIRTUAL,
	`status` text NOT NULL,
	`error` text,
	`stop_reason` text,
	`input_params_snapshot` text NOT NULL,
	`items_seen` integer DEFAULT 0 NOT NULL,
	`items_new` integer DEFAULT 0 NOT NULL,
	`items_failed_download` integer DEFAULT 0 NOT NULL,
	`device_adds` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "runs_status_check" CHECK("run_history"."status" IN ('running','success','failed')),
	CONSTRAINT "runs_stop_reason_check" CHECK("run_history"."stop_reason" IS NULL OR "run_history"."stop_reason" IN ('max_items_inspected','source_exhausted','error','daemon_crash'))
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_runs_sub_started` ON `run_history` (`subscription_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_runs_status` ON `run_history` (`status`);--> statement-breakpoint
CREATE TABLE `source_credentials` (
	`source_slug` text PRIMARY KEY NOT NULL COLLATE NOCASE,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
) STRICT;
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_slug` text NOT NULL COLLATE NOCASE,
	`name` text NOT NULL,
	`input_params` text NOT NULL,
	`cron` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`max_items_inspected` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer
) STRICT;
--> statement-breakpoint
CREATE INDEX `idx_subs_active` ON `subscriptions` (`enabled`,`source_slug`) WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_subs_deleted_partial` ON `subscriptions` (`id`) WHERE "subscriptions"."deleted_at" IS NOT NULL;
