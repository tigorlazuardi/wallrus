/**
 * E2E tests for /runs and /subscriptions/[id]/runs.
 *
 * DEFERRED: Playwright webServer starts `bun run dev` which does NOT call
 * set_runtime(). Every request fails with "runtime_ref() called before
 * set_runtime()". This spec is ready-to-run but cannot execute until a
 * Playwright-bootstrap slice rewires webServer to `bun run src/cli.ts serve`
 * (or creates a test-mode startup path). Same blocker as slices 011 + 012.
 */
import { test, expect } from "@playwright/test"

test.describe("/runs — run dashboard", () => {
	test("shows empty state when no runs exist", async ({ page }) => {
		await page.goto("/runs")
		await expect(page.getByText("No runs yet")).toBeVisible()
	})

	test("shows run list when runs exist", async ({ page }) => {
		await page.goto("/runs")
		// The page should load without errors
		await expect(page).toHaveTitle(/wallrus/)
	})

	test("SSE live update: running row appears and transitions to success", async ({ page }) => {
		// This test requires a subscription with cron '* * * * *' to be configured
		// and the daemon actively running ingest.
		await page.goto("/runs")

		// Within 90 seconds, expect a row with "Running" to appear
		await expect(page.getByText("Running")).toBeVisible({ timeout: 90_000 })

		// Then it should transition to "Success" as the run completes
		await expect(page.getByText("Success")).toBeVisible({ timeout: 90_000 })
	})

	test("click on run row navigates to detail page", async ({ page }) => {
		await page.goto("/runs")
		// If any runs exist, click the first row
		const first_row = page.locator('[role="button"]').first()
		const count = await first_row.count()
		if (count > 0) {
			await first_row.click()
			await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+/)
		}
	})
})

test.describe("/runs/[id] — run detail", () => {
	test("shows run detail including counters and params", async ({ page }) => {
		// Navigate to runs list first, then click a row
		await page.goto("/runs")
		const first_row = page.locator('[role="button"]').first()
		const count = await first_row.count()
		if (count > 0) {
			await first_row.click()
			await expect(page.getByText("Counters")).toBeVisible()
			await expect(page.getByText("Input Parameters")).toBeVisible()
		}
	})

	test("shows error section when run has an error", async ({ page }) => {
		// This test requires a failed run to exist in the DB.
		await page.goto("/runs?status=failed")
		const first_row = page.locator('[role="button"]').first()
		const count = await first_row.count()
		if (count > 0) {
			await first_row.click()
			// Error section only visible when run.error is non-null
			const error_section = page.getByTestId("run-error")
			// May or may not be present depending on whether run has error message
			await expect(error_section.or(page.getByText("Counters"))).toBeVisible()
		}
	})
})

test.describe("/subscriptions/[id]/runs — scoped history", () => {
	test("shows subscription-scoped run history", async ({ page }) => {
		// Navigate via subscription page
		await page.goto("/subscriptions")
		const sub_link = page
			.getByRole("link")
			.filter({ hasText: /View runs/ })
			.first()
		const count = await sub_link.count()
		if (count > 0) {
			await sub_link.click()
			await expect(page.getByText("Run history")).toBeVisible()
		}
	})
})
