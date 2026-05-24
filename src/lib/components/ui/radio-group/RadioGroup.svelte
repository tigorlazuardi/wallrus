<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui"
	import type { Snippet } from "svelte"

	interface Props {
		value?: string
		disabled?: boolean
		class?: string
		children?: Snippet
		onValueChange?: (value: string) => void
	}

	let {
		value = $bindable(""),
		disabled = false,
		class: klass = "",
		children,
		onValueChange,
	}: Props = $props()
</script>

<RadioGroupPrimitive.Root bind:value {disabled} {onValueChange} class="grid gap-2 {klass}">
	{@render children?.()}
</RadioGroupPrimitive.Root>
