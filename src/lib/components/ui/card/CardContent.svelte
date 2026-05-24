<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<div class="p-6 pt-0 {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
