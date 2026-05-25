<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui"

	interface Props {
		value: string
		label?: string
		disabled?: boolean
		class?: string
	}

	let { value, label, disabled = false, class: klass = "" }: Props = $props()
</script>

<SelectPrimitive.Item
	{value}
	{label}
	{disabled}
	class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-[var(--color-surface-hi)] focus:text-[var(--color-fg)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 {klass}"
>
	{#snippet children({ selected })}
		{#if selected}
			<span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-3.5 w-3.5"
					aria-hidden="true"
				>
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
			</span>
		{/if}
		{label ?? value}
	{/snippet}
</SelectPrimitive.Item>
