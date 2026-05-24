<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements"

	interface Props extends HTMLAttributes<HTMLDivElement> {
		class?: string
	}

	let { class: className = "", ...rest }: Props = $props()
</script>

<div
	class="animate-pulse rounded-md {className}"
	style="background: var(--color-surface-hi);"
	{...rest}
></div>
