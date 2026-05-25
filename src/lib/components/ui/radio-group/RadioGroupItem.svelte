<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui"

	interface Props {
		value: string
		disabled?: boolean
		class?: string
		id?: string
	}

	let { value, disabled = false, class: klass = "", id }: Props = $props()
</script>

<RadioGroupPrimitive.Item
	{value}
	{disabled}
	{id}
	class="aspect-square h-4 w-4 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 {klass}"
>
	{#snippet children({ checked })}
		{#if checked}
			<span class="flex items-center justify-center">
				<svg viewBox="0 0 24 24" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
					<circle cx="12" cy="12" r="6" />
				</svg>
			</span>
		{/if}
	{/snippet}
</RadioGroupPrimitive.Item>
