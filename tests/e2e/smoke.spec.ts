import { expect, test } from "@playwright/test"

// Smoke test — homepage renders with the wallrus nav brand link.
test("homepage renders the wallrus title", async ({ page }) => {
	await page.goto("/")
	// The (app) layout renders "wallrus" as a nav link, not an h1.
	await expect(page.getByRole("link", { name: "wallrus" })).toBeVisible()
})
