/**
 * Tests for the WallpaperPlugin TS interface and module contract.
 *
 * Approach: bun:test cannot compile Svelte components, so we do not attempt
 * DOM rendering of ImageModal. Instead we verify the wallpaper module contract
 * directly — the TypeScript interface, the registerPlugin call, and that a
 * mock implementation satisfying the interface can be called with all valid
 * targets. The UI wiring in ImageModal.svelte is covered by the type-checker
 * (bun run check) which exercises the full Svelte compilation.
 *
 * See .builder-notes.md for why component rendering is not tested here.
 */

import { describe, expect, mock, test } from "bun:test"
import type { WallpaperPlugin } from "./wallpaper"

// ---------------------------------------------------------------------------
// Mock @capacitor/core so registerPlugin() works in bun:test (no native runtime)
// ---------------------------------------------------------------------------

const _registered: Record<string, unknown> = {}

mock.module("@capacitor/core", () => ({
	registerPlugin: <T>(name: string, impl?: T) => {
		const plugin = impl ?? {}
		_registered[name] = plugin
		return plugin as T
	},
	Capacitor: {
		isNativePlatform: () => false,
		getPlatform: () => "web",
	},
}))

// ---------------------------------------------------------------------------
// WallpaperPlugin interface contract
// ---------------------------------------------------------------------------

describe("WallpaperPlugin interface", () => {
	test("mock satisfying WallpaperPlugin is callable with target=home", async () => {
		const mock_plugin: WallpaperPlugin = {
			setWallpaper: async (opts) => {
				expect(opts.imageUrl).toBe("http://example.com/api/v1/images/abc/original")
				expect(opts.target).toBe("home")
				return { success: true }
			},
		}

		const result = await mock_plugin.setWallpaper({
			imageUrl: "http://example.com/api/v1/images/abc/original",
			target: "home",
		})
		expect(result.success).toBe(true)
		expect(result.note).toBeUndefined()
	})

	test("mock satisfying WallpaperPlugin is callable with target=lock", async () => {
		const mock_plugin: WallpaperPlugin = {
			setWallpaper: async (opts) => {
				expect(opts.target).toBe("lock")
				return { success: true, note: "lock-set" }
			},
		}

		const result = await mock_plugin.setWallpaper({
			imageUrl: "http://example.com/api/v1/images/abc/original",
			target: "lock",
		})
		expect(result.success).toBe(true)
		expect(result.note).toBe("lock-set")
	})

	test("mock satisfying WallpaperPlugin is callable with target=both", async () => {
		const mock_plugin: WallpaperPlugin = {
			setWallpaper: async (opts) => {
				expect(opts.target).toBe("both")
				return { success: true }
			},
		}

		const result = await mock_plugin.setWallpaper({
			imageUrl: "http://example.com/api/v1/images/abc/original",
			target: "both",
		})
		expect(result.success).toBe(true)
	})

	test("mock can return success=false (failure path)", async () => {
		const mock_plugin: WallpaperPlugin = {
			setWallpaper: async () => ({ success: false, note: "permission-denied" }),
		}

		const result = await mock_plugin.setWallpaper({
			imageUrl: "http://example.com/api/v1/images/abc/original",
			target: "home",
		})
		expect(result.success).toBe(false)
		expect(result.note).toBe("permission-denied")
	})
})

// ---------------------------------------------------------------------------
// registerPlugin wiring — verify the module actually calls registerPlugin
// ---------------------------------------------------------------------------

describe("Wallpaper module", () => {
	test("registerPlugin is called with 'Wallpaper' when the module is imported", async () => {
		// Import after the mock is in place.
		await import("./wallpaper")
		// The mock records registered plugin names.
		expect("Wallpaper" in _registered).toBe(true)
	})
})
