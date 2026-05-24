<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui"

	interface Props {
		class?: string
		children?: import("svelte").Snippet
	}

	let { class: className = "", children }: Props = $props()
</script>

<DialogPrimitive.Portal>
	<DialogPrimitive.Overlay
		class="fixed inset-0 z-50"
		style="background: rgb(0 0 0 / 0.6); backdrop-filter: blur(2px);"
	/>
	<DialogPrimitive.Content
		class="glass fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[var(--radius-card)] border p-6 shadow-xl {className}"
		style="
			background: var(--color-glass);
			backdrop-filter: blur(20px) saturate(180%);
			-webkit-backdrop-filter: blur(20px) saturate(180%);
			border-color: var(--color-glass-border);
			color: var(--color-fg);
		"
	>
		{#if children}
			{@render children()}
		{/if}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
