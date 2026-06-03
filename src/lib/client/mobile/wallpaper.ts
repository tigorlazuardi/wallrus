import { registerPlugin } from "@capacitor/core"

export interface WallpaperPlugin {
	setWallpaper(opts: {
		imageUrl: string
		target: "home" | "lock" | "both" // Android only; iOS ignores target
	}): Promise<{ success: boolean; note?: string }>
}

export const Wallpaper = registerPlugin<WallpaperPlugin>("Wallpaper")
