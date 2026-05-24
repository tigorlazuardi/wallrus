<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<h5 class="mb-1 font-medium leading-none tracking-tight {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</h5>
