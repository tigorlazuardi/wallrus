<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements"

	type Props = Omit<HTMLInputAttributes, "value"> & {
		class?: string
		value?: string | number | readonly string[] | null
	}

	let { class: klass = "", value = $bindable(), ...rest }: Props = $props()
</script>

<input
	bind:value
	class="flex h-9 w-full rounded-[var(--radius)] border border-[var(--color-glass-border)] bg-[var(--color-surface)] px-3 py-1 text-sm text-[var(--color-fg)] shadow-sm transition-colors placeholder:text-[var(--color-fg-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 {klass}"
	{...rest}
/>
