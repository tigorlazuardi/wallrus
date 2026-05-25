<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements"

	type Props = HTMLLabelAttributes & {
		class?: string
	}

	let { class: klass = "", children, ...rest }: Props = $props()
</script>

<label
	class="text-sm font-medium leading-none text-[var(--color-fg)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70 {klass}"
	{...rest}
>
	{@render children?.()}
</label>
