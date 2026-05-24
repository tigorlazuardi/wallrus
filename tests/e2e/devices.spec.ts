import { expect, test } from "@playwright/test"

/**
 * Device management e2e smoke tests.
 *
 * Tests the full device lifecycle: create → list → view detail →
 * edit filter criteria → soft-delete.
 *
 * NOTE: These tests are DEFERRED. The Playwright webServer in
 * playwright.config.ts uses `bun run dev` (Vite dev server) which does NOT
 * call set_runtime(), so every request 500s with:
 *   "runtime_ref() called before set_runtime()"
 * This is the same blocker as gallery.spec.ts (slice 011).
 *
 * Resolution: a Playwright-bootstrap slice must rewire `webServer` to run
 * `bun run src/cli.ts serve` (or a test-mode equivalent) before these
 * specs can execute.
 */

test.describe("devices", () => {
	test("device list page renders", async ({ page }) => {
		await page.goto("/devices")
		await expect(page).toHaveURL("/devices")

		// Page heading is visible
		await expect(page.getByRole("heading", { name: "Devices" })).toBeVisible({
			timeout: 10_000,
		})
	})

	test("create device — happy path", async ({ page }) => {
		await page.goto("/devices/new")
		await expect(page.getByRole("heading", { name: "New device" })).toBeVisible()

		// Fill the form
		await page.getByLabel("Slug").fill("test-device-e2e")
		await page.getByLabel("Name").fill("Test Device E2E")

		// Submit
		await page.getByRole("button", { name: "Create device" }).click()

		// Expect redirect to the new device detail page
		await expect(page).toHaveURL("/devices/test-device-e2e", { timeout: 5_000 })
		await expect(page.getByRole("heading", { name: "Test Device E2E" })).toBeVisible()
	})

	test("edit device filter criteria", async ({ page }) => {
		// Assumes test-device-e2e was created in a prior test
		await page.goto("/devices/test-device-e2e/edit")
		await expect(page.getByRole("heading", { name: /edit/i })).toBeVisible()

		// Change the name
		const name_input = page.getByLabel("Name")
		await name_input.fill("Test Device E2E (updated)")

		// Submit
		await page.getByRole("button", { name: "Save changes" }).click()

		// Expect redirect back to detail page
		await expect(page).toHaveURL("/devices/test-device-e2e", { timeout: 5_000 })
	})

	test("soft-delete device", async ({ page }) => {
		// Navigate to detail page
		await page.goto("/devices/test-device-e2e")

		// Click delete button (should be visible on detail page)
		const delete_btn = page.getByRole("button", { name: /delete/i })
		await expect(delete_btn).toBeVisible()

		// Accept confirm dialog
		page.on("dialog", (dialog) => dialog.accept())
		await delete_btn.click()

		// Expect redirect to devices list
		await expect(page).toHaveURL("/devices", { timeout: 5_000 })
	})
})
