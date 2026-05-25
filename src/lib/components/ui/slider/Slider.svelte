<script lang="ts">
	import { Slider as SliderPrimitive } from "bits-ui"

	interface Props {
		value?: number[]
		min?: number
		max?: number
		step?: number
		disabled?: boolean
		class?: string
		onValueChange?: (value: number[]) => void
	}

	let {
		value = $bindable([0]),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		class: klass = "",
		onValueChange,
	}: Props = $props()
</script>

<SliderPrimitive.Root
	type="multiple"
	bind:value
	{min}
	{max}
	{step}
	{disabled}
	{onValueChange}
	class="relative flex w-full touch-none select-none items-center {klass}"
>
	{#snippet children({ thumbs })}
		<span
			class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--color-surface-hi)]"
		>
			<SliderPrimitive.Range class="absolute h-full bg-[var(--color-accent)]" />
		</span>
		{#each thumbs as index (index)}
			<SliderPrimitive.Thumb
				{index}
				class="block h-4 w-4 rounded-full border border-[var(--color-accent)] bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
