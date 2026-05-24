import { expect, test } from "@playwright/test"

// Smoke test — placeholder homepage renders. Real e2e suites land alongside
// the gallery, auth, devices, and subscriptions surfaces.
test("homepage renders the wallrus title", async ({ page }) => {
	await page.goto("/")
	await expect(page.getByRole("heading", { level: 1, name: "wallrus" })).toBeVisible()
})
