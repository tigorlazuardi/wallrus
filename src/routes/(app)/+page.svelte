<script lang="ts">
	import { page } from "$app/stores"
	import { goto, invalidateAll } from "$app/navigation"
	import type { Image } from "$lib/schemas/images/Image"
	import { useImages } from "$lib/client/images/use-images.svelte"
	import Masonry from "$lib/components/Masonry.svelte"
	import ImageCard from "$lib/components/ImageCard.svelte"
	import FilterChips from "$lib/components/FilterChips.svelte"
	import ImageModal from "$lib/components/ImageModal.svelte"
	import { Skeleton } from "$lib/components/ui/skeleton"
	import type { GalleryData } from "./+page"

	let { data }: { data: GalleryData } = $props()

	// Gallery hook owns cursor pagination state.
	// `data.images` may be null when the load returned an error — the hook
	// accepts undefined as "start empty".
	const gallery = useImages(data.images ?? undefined, () => $page.url.searchParams.toString())

	// Derive unique source slugs from loaded items for the filter chips.
	const sources = $derived([...new Set(gallery.state.items.map((img: Image) => img.source_slug))])

	// When the URL changes (filter change), SvelteKit reruns load() and `data`
	// updates. Reset the hook state with the fresh first page from the server.
	$effect(() => {
		if (data.images) {
			gallery.reset(data.images)
		}
	})

	// Filter signature for keying the sentinel. When filters change, the
	// sentinel element is replaced, resetting the IntersectionObserver.
	const filter_sig = $derived($page.url.searchParams.toString())

	// Infinite scroll: sentinel ref.
	let sentinel = $state<HTMLElement | null>(null)

	let selected_image = $state<Image | null>(null)

	$effect(() => {
		// Re-register observer whenever sentinel element changes (filter change keys it).
		if (!sentinel) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					gallery.loadMore()
				}
			},
			{ rootMargin: "200px" },
		)
		observer.observe(sentinel)

		return () => observer.disconnect()
	})

	function open_image(image: Image) {
		selected_image = image
	}

	function close_modal() {
		selected_image = null
	}
</script>

<svelte:head>
	<title>Gallery — wallrus</title>
</svelte:head>

<div class="mx-auto max-w-screen-2xl px-4 py-6" data-testid="gallery">
	<!-- Filter chips bar -->
	<FilterChips devices={data.devices} {sources} />

	<!-- Error state -->
	{#if data.error}
		<div
			class="mt-4 rounded-lg border p-4"
			style="background: rgb(239 68 68 / 0.1); border-color: rgb(239 68 68 / 0.3); color: #ef4444;"
			role="alert"
		>
			<p class="font-medium">Failed to load images</p>
			<p class="mt-1 text-sm">{data.error}</p>
			<button
				class="mt-3 rounded px-3 py-1 text-sm font-medium transition-colors"
				style="background: rgb(239 68 68 / 0.2); color: #ef4444;"
				onclick={() => invalidateAll()}
				type="button"
			>
				Retry
			</button>
		</div>
	{:else if gallery.state.items.length === 0}
		<!-- Empty state -->
		<div class="mt-16 flex flex-col items-center gap-4 text-center">
			<div class="text-5xl" aria-hidden="true">🖼</div>
			<div>
				<h2 class="text-lg font-semibold" style="color: var(--color-fg);">No images yet</h2>
				<p class="mt-1 text-sm" style="color: var(--color-fg-muted);">
					{#if $page.url.searchParams.toString()}
						No images match the current filters.
						<button
							class="ml-1 underline"
							style="color: var(--color-accent);"
							onclick={() => goto("/")}
							type="button"
						>
							Clear filters
						</button>
					{:else}
						Add a subscription to start collecting wallpapers.
						<a
							href="/subscriptions/new"
							class="ml-1 underline"
							style="color: var(--color-accent);"
						>
							Add subscription
						</a>
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<!-- Gallery grid -->
		<div class="mt-4">
			<Masonry items={gallery.state.items}>
				{#snippet item(img)}
					<ImageCard image={img} onclick={open_image} />
				{/snippet}
			</Masonry>
		</div>

		<!-- Infinite scroll sentinel — keyed on filter_sig so it remounts on filter change -->
		{#key filter_sig}
			<div bind:this={sentinel} class="h-1 w-full" aria-hidden="true"></div>
		{/key}

		<!-- Loading skeleton for next page -->
		{#if gallery.state.loading}
			<div
				class="mt-4 grid gap-4"
				style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"
			>
				{#each { length: 6 } as _, i (i)}
					<Skeleton class="h-48 w-full rounded-xl" />
				{/each}
			</div>
		{/if}

		<!-- End-of-list indicator -->
		{#if !gallery.state.next_cursor && !gallery.state.loading}
			<p class="mt-8 pb-4 text-center text-xs" style="color: var(--color-fg-muted);">
				{gallery.state.items.length} image{gallery.state.items.length === 1 ? "" : "s"} total
			</p>
		{/if}
	{/if}
</div>

<!-- Image detail modal -->
<ImageModal image={selected_image} onClose={close_modal} />
