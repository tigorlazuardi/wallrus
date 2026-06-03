/**
 * Single seam for bun:test to mock.
 * Web always returns false; native (Capacitor) returns true when running
 * in an iOS/Android WebView.
 */

import { Capacitor } from "@capacitor/core"

export function isNativePlatform(): boolean {
	return Capacitor.isNativePlatform()
}
