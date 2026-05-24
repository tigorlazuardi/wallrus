import { expect, test } from "@playwright/test"

/**
 * Subscription management e2e smoke tests.
 *
 * Tests the full subscription lifecycle: create → list → edit → link device →
 * toggle enable/disable → soft-delete.
 *
 * NOTE: These tests are DEFERRED. The Playwright webServer in
 * playwright.config.ts uses `bun run dev` (Vite dev server) which does NOT
 * call set_runtime(), so every request 500s with:
 *   "runtime_ref() called before set_runtime()"
 * This is the same blocker as gallery.spec.ts (slice 011) and devices.spec.ts.
 *
 * Resolution: a Playwright-bootstrap slice must rewire `webServer` to run
 * `bun run src/cli.ts serve` (or a test-mode equivalent) before these
 * specs can execute.
 */

test.describe("subscriptions", () => {
	test("subscription list page renders", async ({ page }) => {
		await page.goto("/subscriptions")
		await expect(page).toHaveURL("/subscriptions")

		await expect(page.getByRole("heading", { name: "Subscriptions" })).toBeVisible({
			timeout: 10_000,
		})
	})

	test("new subscription page renders with source select", async ({ page }) => {
		await page.goto("/subscriptions/new")
		await expect(page.getByRole("heading", { name: "New subscription" })).toBeVisible()

		// Source select should be visible
		await expect(page.getByLabel("Source")).toBeVisible()

		// Cron field should be present
		await expect(page.getByLabel("Schedule (cron)")).toBeVisible()
	})

	test("create subscription with reddit source — happy path", async ({ page }) => {
		await page.goto("/subscriptions/new")

		// Fill subscription name
		await page.getByLabel("Name").fill("r/wallpapers hot e2e")

		// Select source
		// (Bits-ui select requires clicking trigger first, then selecting item)
		await page.getByLabel("Source").click()
		await page.getByRole("option", { name: "Reddit" }).click()

		// Fill reddit params
		await page.locator("#param_subreddit").fill("wallpapers")

		// Set cron
		const cron_input = page.locator("input[placeholder='0 * * * *']")
		await cron_input.fill("0 6 * * *")

		// Submit
		await page.getByRole("button", { name: "Create subscription" }).click()

		// Expect redirect to subscription detail page
		await expect(page).toHaveURL(/\/subscriptions\/[0-9a-f-]+$/, { timeout: 5_000 })
		await expect(page.getByText("r/wallpapers hot e2e")).toBeVisible()
	})

	test("toggle subscription enable/disable", async ({ page }) => {
		// Navigate to list and click first subscription
		await page.goto("/subscriptions")
		await page.locator("a[href^='/subscriptions/']").first().click()
		await page.waitForLoadState("networkidle")

		// Toggle the subscription status
		const toggle_btn = page.getByRole("button", { name: /disable|enable/i })
		await expect(toggle_btn).toBeVisible()
		const initial_text = await toggle_btn.textContent()
		await toggle_btn.click()

		// Status should have changed
		await page.waitForLoadState("networkidle")
		const new_text = await toggle_btn.textContent()
		expect(new_text).not.toEqual(initial_text)
	})

	test("soft-delete subscription", async ({ page }) => {
		// Navigate to list and click first subscription
		await page.goto("/subscriptions")
		await page.locator("a[href^='/subscriptions/']").first().click()
		await page.waitForLoadState("networkidle")

		// Click delete button
		const delete_btn = page.getByRole("button", { name: /delete/i })
		await expect(delete_btn).toBeVisible()

		page.on("dialog", (dialog) => dialog.accept())
		await delete_btn.click()

		// Expect redirect to subscriptions list
		await expect(page).toHaveURL("/subscriptions", { timeout: 5_000 })
	})

	test("show deleted subscriptions toggle", async ({ page }) => {
		await page.goto("/subscriptions")

		// Initially doesn't show deleted
		const show_deleted_btn = page.getByRole("button", { name: "Show deleted" })
		await expect(show_deleted_btn).toBeVisible()

		await show_deleted_btn.click()

		// URL should now have include_deleted=true
		await expect(page).toHaveURL("/subscriptions?include_deleted=true", { timeout: 3_000 })

		// Button text should change to "Hide deleted"
		await expect(page.getByRole("button", { name: "Hide deleted" })).toBeVisible()
	})
})
