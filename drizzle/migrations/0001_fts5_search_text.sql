-- FTS5 full-text search over images.search_text. External-content table
-- mirroring `images`, kept in sync via triggers. See
-- `.claude/rules/database.md` §FTS5 and `docs/ARCHITECTURE.md` §DB schema.
--
-- This is a --custom migration because Drizzle doesn't model virtual tables
-- or triggers.

CREATE VIRTUAL TABLE `images_fts` USING fts5(
	search_text,
	content='images',
	content_rowid='rowid',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `images_ai` AFTER INSERT ON `images` BEGIN
	INSERT INTO images_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER `images_ad` AFTER DELETE ON `images` BEGIN
	INSERT INTO images_fts(images_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER `images_au` AFTER UPDATE ON `images` BEGIN
	INSERT INTO images_fts(images_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
	INSERT INTO images_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
