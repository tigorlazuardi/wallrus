import { expect, test } from "@playwright/test"

/**
 * Gallery e2e smoke tests.
 *
 * These tests run against a dev server started with AUTH_ENABLE=false.
 * They verify the gallery page renders (possibly empty) and the API
 * thumbnail/file endpoints return the expected status codes.
 *
 * NOTE: Tests are intentionally lenient — the gallery may have 0 images
 * in CI environments that haven't seeded any data. The key assertion is
 * that the page renders without a 5xx error.
 */

test("gallery page renders without errors", async ({ page }) => {
	await page.goto("/")

	// Either the gallery wrapper or the heading is visible.
	const gallery = page.locator("[data-testid=gallery]")
	await expect(gallery).toBeVisible({ timeout: 10_000 })
})

test("thumbnail endpoint returns 404 for missing image", async ({ request }) => {
	const res = await request.get("/api/v1/images/nonexistent-id/thumbnail")
	expect(res.status()).toBe(404)
	const body = await res.json()
	expect(body).toHaveProperty("error")
})

test("file endpoint returns 404 for missing image", async ({ request }) => {
	const res = await request.get("/api/v1/images/nonexistent-id/file")
	expect(res.status()).toBe(404)
	const body = await res.json()
	expect(body).toHaveProperty("error")
})
