<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from "bits-ui"

	interface Props {
		checked?: boolean
		indeterminate?: boolean
		disabled?: boolean
		class?: string
		id?: string
		onCheckedChange?: (checked: boolean) => void
	}

	let {
		checked = $bindable(false),
		indeterminate = false,
		disabled = false,
		class: klass = "",
		id,
		onCheckedChange,
	}: Props = $props()
</script>

<CheckboxPrimitive.Root
	bind:checked
	{indeterminate}
	{disabled}
	{id}
	{onCheckedChange}
	class="peer h-4 w-4 shrink-0 rounded-sm border border-[var(--color-accent)] shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:text-[var(--color-accent-fg)] {klass}"
>
	{#snippet children({ checked: c })}
		{#if c}
			<span class="flex items-center justify-center text-current">
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
	{/snippet}
</CheckboxPrimitive.Root>
