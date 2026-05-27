<script lang="ts">
	import { untrack } from "svelte"
	import type { Image } from "$lib/schemas/images/Image"
	import { Badge } from "$lib/components/ui/badge"
	import { useImageMutation } from "$lib/client/images/use-image-mutation.svelte"

	interface Props {
		image: Image
		/** Called when card is clicked (to open modal) */
		onclick?: (image: Image) => void
	}

	let { image, onclick }: Props = $props()

	// Aspect ratio determines row span in the grid.
	// Each row is 8px tall. col width is approximated as 280px.
	const aspect_ratio = $derived(
		image.aspect_ratio ?? (image.width / image.height === 0 ? 1 : image.width / image.height),
	)

	// Row span: ceil(rendered_height / 8) + small buffer for the caption overlay.
	const row_span = $derived(Math.ceil(280 / aspect_ratio / 8) + 2)

	// Landscape images (AR > 1.2) span 2 columns for a Pinterest feel.
	const is_landscape = $derived(aspect_ratio > 1.2)

	const card_style = $derived(
		`grid-row: span ${row_span};` + (is_landscape ? " grid-column: span 2;" : ""),
	)

	const thumbnail_url = $derived(`/api/v1/images/${image.id}/thumbnail`)

	// Favorite toggle state: local, starts from the prop's initial value.
	// untrack() reads the prop without creating a reactive dependency so Svelte
	// doesn't warn about "captures the initial value of image".
	let favorited = $state(untrack(() => image.favorited))
	let favorite_loading = $state(false)

	async function toggle_favorite(e: MouseEvent) {
		e.stopPropagation()
		if (favorite_loading) return
		// Optimistic flip: update UI immediately, revert on failure.
		const new_favorited = !favorited
		favorited = new_favorited
		favorite_loading = true
		try {
			await useImageMutation().toggleFavorite(image.id, new_favorited)
		} catch {
			// Revert optimistic update on error.
			favorited = !new_favorited
		} finally {
			favorite_loading = false
		}
	}

	async function delete_image(e: MouseEvent) {
		e.stopPropagation()
		const confirmed = window.confirm(
			"Delete this image? It will be soft-deleted and removed from all device directories.",
		)
		if (!confirmed) return
		await useImageMutation().softDelete(image.id)
		// Parent should invalidate/refetch.
	}
</script>

<article
	class="group relative overflow-hidden rounded-[var(--radius-card)] focus-within:ring-2"
	style="{card_style} background: var(--color-bg-elev); ring-color: var(--color-ring);"
	data-nsfw={image.nsfw}
>
	<!-- Clickable image area -->
	<button
		class="block h-full w-full cursor-pointer border-0 p-0 text-left"
		style="background: transparent;"
		onclick={() => onclick?.(image)}
		aria-label={`Open ${image.title || "untitled"}`}
		type="button"
	>
		<img
			src={thumbnail_url}
			alt={image.title || "untitled"}
			loading="lazy"
			decoding="async"
			width={image.width}
			height={image.height}
			class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
			class:blur-xl={image.nsfw === "nsfw"}
			style="display: block;"
		/>
	</button>

	<!-- Hover overlay — pointer-events-none so the button underneath stays clickable -->
	<div
		class="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
		style="background: linear-gradient(to top, rgb(0 0 0 / 0.75) 0%, transparent 60%);"
		aria-hidden="true"
	>
		<div class="flex items-end justify-between gap-2">
			<div class="min-w-0 flex-1">
				{#if image.title}
					<p
						class="truncate text-sm font-medium leading-tight"
						style="color: #e8e8ec;"
						title={image.title}
					>
						{image.title}
					</p>
				{/if}
				<Badge variant="secondary" class="mt-1 text-xs">
					{image.source_slug}
				</Badge>
			</div>
		</div>
	</div>

	<!-- Action buttons — separate overlay with pointer-events-auto, appear on hover -->
	<div
		class="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
	>
		<!-- Favorite button -->
		<button
			class="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors"
			style="background: rgb(0 0 0 / 0.4);"
			onclick={toggle_favorite}
			aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
			disabled={favorite_loading}
			title={favorited ? "Remove from favorites" : "Add to favorites"}
			type="button"
		>
			{#if favorited}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="#f59e0b"
					stroke="#f59e0b"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
					/>
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#e8e8ec"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
					/>
				</svg>
			{/if}
		</button>

		<!-- Delete button -->
		<button
			class="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors"
			style="background: rgb(0 0 0 / 0.4);"
			onclick={delete_image}
			aria-label="Delete image"
			title="Delete image"
			type="button"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="#e8e8ec"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M3 6h18" />
				<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
				<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
			</svg>
		</button>
	</div>
</article>
