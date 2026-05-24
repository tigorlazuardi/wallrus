<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui"

	interface Props {
		class?: string
		children?: import("svelte").Snippet
	}

	let { class: className = "", children }: Props = $props()
</script>

<DialogPrimitive.Description class="text-sm {className}" style="color: var(--color-fg-muted);">
	{#if children}
		{@render children()}
	{/if}
</DialogPrimitive.Description>
