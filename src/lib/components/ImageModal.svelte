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

	interface Props {
		image: Image | null
		onClose?: () => void
	}

	let { image, onClose }: Props = $props()

	const is_open = $derived(image !== null)

	function handle_open_change(open: boolean) {
		if (!open) onClose?.()
	}

	const file_url = $derived(image ? `/api/v1/images/${image.id}/file` : "")

	const display_title = $derived(image?.title || "Untitled")
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
		</DialogContent>
	</Dialog>
{/if}
