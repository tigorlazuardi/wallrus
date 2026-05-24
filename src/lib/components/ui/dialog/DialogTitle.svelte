<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui"

	interface Props {
		class?: string
		children?: import("svelte").Snippet
	}

	let { class: className = "", children }: Props = $props()
</script>

<DialogPrimitive.Title
	class="text-lg font-semibold leading-none tracking-tight {className}"
	style="color: var(--color-fg);"
>
	{#if children}
		{@render children()}
	{/if}
</DialogPrimitive.Title>
