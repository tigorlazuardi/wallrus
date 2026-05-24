<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
