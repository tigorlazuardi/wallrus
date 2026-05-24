<script lang="ts">
	import { Toggle as TogglePrimitive } from "bits-ui"

	interface Props {
		pressed?: boolean
		class?: string
		children?: import("svelte").Snippet
		onPressedChange?: (pressed: boolean) => void
	}

	let {
		pressed = $bindable(false),
		class: className = "",
		children,
		onPressedChange,
	}: Props = $props()
</script>

<TogglePrimitive.Root
	bind:pressed
	{onPressedChange}
	class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors
		data-[state=on]:bg-[var(--color-surface-hi)]
		hover:bg-[var(--color-surface)]
		{className}"
	style="color: var(--color-fg-muted); data-[state=on]: color: var(--color-fg);"
>
	{#if children}
		{@render children()}
	{/if}
</TogglePrimitive.Root>
