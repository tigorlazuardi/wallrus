<script lang="ts" generics="T">
	import type { Snippet } from "svelte"

	interface Props {
		items: T[]
		gap?: number
		/** Snippet receives (item, index) */
		item?: Snippet<[T, number]>
	}

	let { items, gap = 4, item }: Props = $props()

	// CSS Grid masonry: `grid-auto-rows: 8px` + `grid-auto-flow: dense`.
	// Column count is controlled by CSS custom property --cols set via inline style
	// on breakpoint-aware parent. Here we use auto-fill with 280px min.
	const grid_style = $derived(`
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		grid-auto-rows: 8px;
		grid-auto-flow: dense;
		gap: ${gap}px;
	`)
</script>

<div style={grid_style} role="list">
	{#each items as it, i (i)}
		<div role="listitem">
			{#if item}
				{@render item(it, i)}
			{/if}
		</div>
	{/each}
</div>
