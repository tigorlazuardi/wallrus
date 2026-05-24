<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string
	}

	let { class: className = "", children, ...rest }: Props = $props()
</script>

<div
	class="rounded-[var(--radius-card)] border shadow-sm {className}"
	style="background: var(--color-bg-elev); border-color: var(--color-glass-border);"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</div>
