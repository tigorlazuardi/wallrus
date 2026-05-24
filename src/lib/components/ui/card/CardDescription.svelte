<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLParagraphElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<p class="text-sm {className}" style="color: var(--color-fg-muted);" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</p>
