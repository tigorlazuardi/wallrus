<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui"
	import type { Snippet } from "svelte"

	interface Props {
		class?: string
		placeholder?: string
		children?: Snippet
	}

	let { class: klass = "", placeholder, children }: Props = $props()
</script>

<SelectPrimitive.Trigger
	class="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-[var(--radius)] border border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 {klass}"
>
	{#if children}
		{@render children()}
	{:else}
		<span class="text-[var(--fg-muted)]">{placeholder ?? "Select..."}</span>
	{/if}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-4 w-4 opacity-50"
		aria-hidden="true"
	>
		<path d="m7 15 5 5 5-5"></path>
		<path d="m7 9 5-5 5 5"></path>
	</svg>
</SelectPrimitive.Trigger>
