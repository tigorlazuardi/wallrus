<script lang="ts">
	import type { Image } from "$lib/schemas/images/Image"
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogClose,
	} from "$lib/components/ui/dialog"
	import { Badge } from "$lib/components/ui/badge"
	import { isNativePlatform } from "$lib/client/mobile/platform"
	import { Wallpaper } from "$lib/client/mobile/wallpaper"
	import { Capacitor } from "@capacitor/core"
	import { api_base } from "$lib/client/config"

	interface Props {
		image: Image | null
		onClose?: () => void
	}

	let { image, onClose }: Props = $props()

	const is_open = $derived(image !== null)
	const is_native = isNativePlatform()
	const is_ios = $derived(is_native && Capacitor.getPlatform() === "ios")

	function handle_open_change(open: boolean) {
		if (!open) {
			wallpaper_status = null
			ios_dialog_open = false
			onClose?.()
		}
	}

	const file_url = $derived(image ? `/api/v1/images/${image.id}/file` : "")

	const display_title = $derived(image?.title || "Untitled")

	// Wallpaper: full original URL (not the thumbnail/file shortcut)
	const wallpaper_url = $derived(image ? `${api_base()}/api/v1/images/${image.id}/original` : "")

	let wallpaper_status = $state<string | null>(null)
	let ios_dialog_open = $state(false)

	async function set_wallpaper(target: "home" | "lock" | "both") {
		if (!image) return
		wallpaper_status = null
		try {
			const result = await Wallpaper.setWallpaper({ imageUrl: wallpaper_url, target })
			wallpaper_status = result.note ?? (result.success ? "Done." : "Failed.")
		} catch {
			wallpaper_status = "Failed to set wallpaper."
		}
	}

	function open_ios_dialog() {
		ios_dialog_open = true
	}

	function confirm_ios_wallpaper() {
		ios_dialog_open = false
		set_wallpaper("both")
	}
</script>

{#if image}
	<Dialog open={is_open} onOpenChange={handle_open_change}>
		<DialogContent class="max-w-4xl p-4">
			<DialogHeader>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<DialogTitle class="truncate">{display_title}</DialogTitle>
						<DialogDescription class="mt-1 flex flex-wrap gap-2">
							<Badge variant="secondary">{image.source_slug}</Badge>
							{#if image.nsfw !== "sfw"}
								<Badge variant={image.nsfw === "nsfw" ? "destructive" : "outline"}>
									{image.nsfw}
								</Badge>
							{/if}
							<span>{image.width}×{image.height}</span>
							<span>{(image.file_size / 1024).toFixed(0)} KB</span>
						</DialogDescription>
					</div>
					<DialogClose>
						<button
							class="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
							style="background: var(--color-surface-hi); color: var(--color-fg);"
							aria-label="Close"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</button>
					</DialogClose>
				</div>
			</DialogHeader>

			<!-- Full-resolution image -->
			<div class="mt-4 overflow-hidden rounded-lg">
				<img
					src={file_url}
					alt={display_title}
					loading="lazy"
					decoding="async"
					class="h-auto max-h-[70dvh] w-full object-contain"
					style="background: var(--color-surface);"
				/>
			</div>

			<!-- Source link -->
			{#if image.source_url}
				<div class="mt-3">
					<a
						href={image.source_url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs underline"
						style="color: var(--color-accent);"
					>
						View original source
					</a>
				</div>
			{/if}

			<!-- Set as wallpaper — native only -->
			{#if is_native}
				<div class="mt-4 border-t pt-4" style="border-color: var(--color-glass-border);">
					{#if is_ios}
						<!-- iOS: explainer first, then call plugin -->
						{#if !ios_dialog_open}
							<button
								class="rounded px-4 py-2 text-sm font-medium transition-colors"
								style="background: var(--color-accent); color: var(--color-accent-fg);"
								onclick={open_ios_dialog}
								type="button"
							>
								Set as wallpaper
							</button>
						{:else}
							<div
								class="rounded-lg p-4 text-sm"
								style="background: var(--color-surface); color: var(--color-fg);"
							>
								<p class="font-medium">Save to Photos first</p>
								<p class="mt-1" style="color: var(--color-fg-muted);">
									wallrus will save this image to your Photos library. Open the
									Photos app, find the image, tap Share, then "Use as Wallpaper".
								</p>
								<div class="mt-3 flex gap-2">
									<button
										class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
										style="background: var(--color-accent); color: var(--color-accent-fg);"
										onclick={confirm_ios_wallpaper}
										type="button"
									>
										Save to Photos
									</button>
									<button
										class="rounded px-3 py-1.5 text-sm transition-colors"
										style="background: var(--color-surface-hi); color: var(--color-fg);"
										onclick={() => (ios_dialog_open = false)}
										type="button"
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}
					{:else}
						<!-- Android / unknown: target picker -->
						<p class="mb-2 text-xs font-medium" style="color: var(--color-fg-muted);">
							Set as wallpaper
						</p>
						<div class="flex flex-wrap gap-2">
							<button
								class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
								style="background: var(--color-surface-hi); color: var(--color-fg);"
								onclick={() => set_wallpaper("home")}
								type="button"
							>
								Home screen
							</button>
							<button
								class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
								style="background: var(--color-surface-hi); color: var(--color-fg);"
								onclick={() => set_wallpaper("lock")}
								type="button"
							>
								Lock screen
							</button>
							<button
								class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
								style="background: var(--color-accent); color: var(--color-accent-fg);"
								onclick={() => set_wallpaper("both")}
								type="button"
							>
								Both
							</button>
						</div>
					{/if}

					{#if wallpaper_status}
						<p class="mt-2 text-xs" style="color: var(--color-fg-muted);">
							{wallpaper_status}
						</p>
					{/if}
				</div>
			{/if}
		</DialogContent>
	</Dialog>
{/if}
