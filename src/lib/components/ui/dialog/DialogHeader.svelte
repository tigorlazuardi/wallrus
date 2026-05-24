<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<div class="flex flex-col space-y-1.5 text-center sm:text-left {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
