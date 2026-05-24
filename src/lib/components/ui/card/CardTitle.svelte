<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<h3
	class="text-lg font-semibold leading-none tracking-tight {className}"
	style="color: var(--color-fg);"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</h3>
