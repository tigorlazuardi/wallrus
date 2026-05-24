-- Covering index for the prune trigger subquery. The existing
-- idx_runs_sub_started only covers (subscription_id, started_at); the trigger
-- uses ORDER BY started_at DESC, id DESC so we need id in the index too.
CREATE INDEX IF NOT EXISTS `idx_runs_sub_started_id` ON `run_history` (`subscription_id`,`started_at` DESC,`id` DESC);--> statement-breakpoint

-- Prune trigger: after each insert, delete rows for that subscription beyond
-- the 100 most-recent (ordered by started_at DESC, id DESC as tie-breaker).
CREATE TRIGGER IF NOT EXISTS `run_history_prune_after_insert`
  AFTER INSERT ON `run_history`
BEGIN
  DELETE FROM `run_history`
  WHERE `subscription_id` = NEW.`subscription_id`
    AND `id` NOT IN (
      SELECT `id` FROM `run_history`
      WHERE `subscription_id` = NEW.`subscription_id`
      ORDER BY `started_at` DESC, `id` DESC
      LIMIT 100
    );
END;
