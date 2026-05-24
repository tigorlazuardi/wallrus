<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui"

	interface Props {
		class?: string
		children?: import("svelte").Snippet
	}

	let { class: className = "", children }: Props = $props()
</script>

<DialogPrimitive.Close class={className}>
	{#if children}
		{@render children()}
	{/if}
</DialogPrimitive.Close>
